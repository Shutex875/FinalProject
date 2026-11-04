# AWS Terraform deployment

This stack creates an IPv4 VPC, a public EC2 host, private PostgreSQL RDS, security groups, and an EC2 instance role for SSM/CloudWatch. It does not build or deploy the application image; EC2 user data installs Docker Engine and the Compose plugin so an app deployment can be added separately.

## Layout

- `bootstrap/`: creates the S3 bucket and DynamoDB table required before a remote state backend can be initialized. Its state stays local; keep that state file backed up and private.
- Root `.tf` files: the application network, compute/database, S3/KMS and IAM stack. State is stored remotely in the bootstrap S3 bucket with server-side encryption and locked with the DynamoDB table.

## Prerequisites

- Terraform CLI 1.10 or newer and AWS CLI.
- AWS credentials configured with permission to create VPC, EC2, RDS, IAM, S3 and DynamoDB resources. Use an IAM Identity Center profile or another short-lived credential method where possible.
- An available AWS account and a unique S3 bucket name. The bootstrap bucket uses the account ID and region in its name.

Run the commands below from the repository root in PowerShell. The selected default region is `eu-west-3`, matching the EC2 and RDS deployment; override `TF_VAR_aws_region` only when intentionally deploying the stack elsewhere.

## 1. Create the remote-state resources

```powershell
terraform -chdir=infra/terraform/bootstrap init
terraform -chdir=infra/terraform/bootstrap apply

$stateBucket = terraform -chdir=infra/terraform/bootstrap output -raw state_bucket_name
$lockTable = terraform -chdir=infra/terraform/bootstrap output -raw lock_table_name
$stateRegion = terraform -chdir=infra/terraform/bootstrap output -raw aws_region
```

Bootstrap must run first because Terraform cannot use an S3 backend until its bucket and lock table exist. Its state is local at `infra/terraform/bootstrap/terraform.tfstate`; keep that file secure and backed up.

## 2. Configure the application stack

Create a local variables file and edit it. `terraform.tfvars` is ignored by Git.

```powershell
Copy-Item infra/terraform/terraform.tfvars.example infra/terraform/terraform.tfvars
notepad infra/terraform/terraform.tfvars
```


Set `db_password` to a unique password (at least 16 characters). If SSH is needed, set `ssh_ingress_cidrs` to a list of allowed public IPs in `/32` notation (for example `["203.0.113.10/32"]`) and `ec2_key_name` to an existing EC2 key pair. Keeping the list empty disables only configurable admin SSH rules; the separate mentor SSH rule remains active. Prefer SSM Session Manager. Do not commit `terraform.tfvars`.

Initialize the remote backend using the resources created above:

```powershell
terraform -chdir=infra/terraform init `
  -backend-config="bucket=$stateBucket" `
  -backend-config="key=finalproject/dev/terraform.tfstate" `
  -backend-config="region=$stateRegion" `
  -backend-config="dynamodb_table=$lockTable" `
  -backend-config="encrypt=true"
```

Review the plan before applying:

```powershell
terraform -chdir=infra/terraform plan -out=tfplan
terraform -chdir=infra/terraform apply tfplan
terraform -chdir=infra/terraform output
```

The `db_password` input is marked sensitive in CLI output, but Terraform still records RDS credentials in state. The S3 bucket enables versioning and server-side encryption; restrict access to the bucket/table to the Terraform operators.

## How CI/CD deploys (`.github/workflows/ci-cd.yml`)

Deployment is fully automated by GitHub Actions; no local machine is involved in the normal release flow.

- The `release` job runs only on `push` or `workflow_dispatch` targeting `main`/`master`. Pull requests and feature branches only run the check jobs (`terraform-check`, `backend-check`, `frontend-check`).
- CI authenticates to AWS via GitHub OIDC (`id-token: write`); there are no long-lived AWS keys.
- Flow: `terraform init -backend-config=...` → ensure ECR repos + artifacts bucket → build/push images to ECR (tag = commit SHA) → upload rendered manifests and `.env` to S3 → `terraform apply` → deploy on the EC2 host through AWS Systems Manager (`AWS-RunShellScript` send-command).
- The EC2 host runs `deploy.sh <sha>`, pulls the image from ECR, starts `docker compose`, and waits for a health check. No SSH is required (SSH ingress is optional and disabled unless configured).

### Required repository Actions variables (env of `release`)

Non-secret inputs are read from Actions **variables**; the database password comes from the **`RDS_PASSWORD`** secret. Configure them to match the resources already recorded in the remote state:

- `AWS_ROLE_ARN` — IAM role assumed through OIDC.
- `AWS_REGION` (default `eu-west-3`).
- `PROJECT_NAME` (currently `deck-market`).
- `ENVIRONMENT` (currently `development`; defaults to `development` if unset). Mirrored into `TF_VAR_environment`.
- `TF_STATE_BUCKET`, `TF_STATE_KEY` (default `terraform.tfstate`), `TF_LOCK_TABLE` — remote backend for CI.
- `ARTIFACTS_BUCKET` — S3 bucket holding release manifests; must equal `${PROJECT_NAME}-${ENVIRONMENT}-artifacts-<account-id>`.
- `RDS_HOST`, `RDS_DB_NAME`, `CLIENT_URL` — runtime application configuration.

Secrets: `TF_VAR_TELEGRAM_BOT_TOKEN`, `TF_VAR_TELEGRAM_CHAT_ID`, `RDS_USERNAME`, `RDS_PASSWORD` (also used as `TF_VAR_db_password`), `JWT_SECRET`, `JWT_REFRESH_SECRET`.

### Required IAM permissions for the deployer role

The role assumed by CI needs the permissions in `iam/github-actions-deployer-additional-policy.json` (ECR push, Terraform refresh reads, SSM send-command, KMS key management for S3 encryption). Attach it in addition to the baseline deployer policy and review it against the resources your stack creates.
The SSH ingress rule uses a stable `for_each` key, and the `moved` block maps the existing `ssh[0]` state address to that key without recreating the rule. The plan check fails if any managed resource would be deleted or replaced. This prevents a missing Actions variable or a Terraform change from silently passing CI with a destructive plan. Review the full plan and update the expected infrastructure configuration before changing this protection.

## Security and operational notes

- Only the web listener ports 80/443 are internet-facing. SSH is a separate optional ingress rule constrained to the CIDRs in `ssh_ingress_cidrs`; the separate mentor SSH rule remains active even with an empty admin CIDR list.
- RDS is not publicly accessible and its inbound PostgreSQL rule references only the EC2 security group. Private subnets have no internet route/NAT.
- EC2 has SSM and CloudWatch Agent managed policies plus scoped ECR pull and S3 access (including `kms:Decrypt`/`kms:GenerateDataKey` on the S3 key). It never receives the database credentials through user data.
- S3 buckets (`images`, `images_logs`, `artifacts`) use SSE-S3 (AES256); public access is blocked. The key named `aws_kms_key.s3` currently encrypts SNS alerts.
- Application deployment runs over SSM; the EC2 instance pulls images from ECR and manifests from S3. No SSH access is required.
- This is a development-oriented single-AZ RDS instance with deletion protection disabled and final snapshot skipped. Change those settings before using it for production data.
- State locking uses the DynamoDB table. `use_lockfile` is intentionally not set, so the workflow relies on DynamoDB locking only.

## Destroy the application stack

```powershell
terraform -chdir=infra/terraform destroy
```

Keep the bootstrap bucket and lock table after destroying the application stack while any remote Terraform state still uses them. The bucket intentionally refuses force deletion and the lock table has deletion protection enabled.

---

## Infrastructure review and reading guide

All `.tf` files in this directory form one root module. File names organize
the code; they do not define execution order. Terraform builds dependencies
from references between resources.

## Reading order

1. `versions.tf`: Terraform CLI and provider version constraints.
2. `providers.tf`: AWS region, shared tags, and existing AWS data sources.
3. `backend.tf` and `bootstrap/`: remote state and locking infrastructure.
4. `variables.tf` and `locals.tf`: external inputs and derived shared values.
5. `vpc.tf` and `security_groups.tf`: subnets, routes, and access rules.
6. `ec2.tf`, `rds.tf`, and `alb.tf`: application host, database, HTTPS, and DNS.
7. `ecr.tf`, `s3.tf`, and `artifacts.tf`: images, application storage, release files.
8. `iam.tf` and `cloudwatch.tf`: host permissions, logs, alarms, Telegram Lambda.
9. `outputs.tf`: values consumed by deployment tooling and operators.

## Shared configuration

- `providers.tf` owns `Project`, `Environment`, and `ManagedBy` default tags.
  Resource `tags` contain only resource-specific values such as `Name`.
- `local.name_prefix` keeps existing project/environment resource names consistent.
- Subnet counts follow the input lists. Input validation currently requires
  exactly two public and two private subnets; this is not arbitrary-size support.
- `domain_name` defaults to the existing application domain. The configuration
  expects its public hosted zone and issued ACM certificate to already exist.
- `bootstrap/` is an independent root module, with a separate provider and state.
  The application provider's default tags do not apply there.

## Local checks

```sh
terraform -chdir=infra/terraform fmt -check -recursive
terraform -chdir=infra/terraform validate
```

Validation requires initialized providers. It does not prove that an AWS plan
will be empty or that IAM permissions and notification delivery work.
Review an authenticated plan before applying changes. Do not rename resource
addresses or introduce `for_each` over existing resources without a state
migration strategy.

## Remaining operational review

- `rds.tf`: one-day backups, single AZ, deletion protection disabled, and no
  final snapshot. Choose the recovery requirements before changing these.
- `s3.tf`: `force_destroy = true` permits deletion of image and access-log data.
- `security_groups.tf`: the separate mentor SSH rule remains active even with
  an empty `ssh_ingress_cidrs` list; the variable's current description is incomplete.
- `cloudwatch.tf`: SNS uses a customer KMS key without an explicit CloudWatch
  service grant in the key policy. Verify encrypted alarm delivery, not just apply.
- `s3.tf` / `iam.tf`: the key named `s3` actually encrypts SNS; current buckets
  use AES256. Review the redundant KMS grants and misleading key description
  together with the notification policy. Keep the resource address until migrated.
- `ec2.tf`: ignored AMI and user-data updates require a separate host-update process.
- `backend.tf`: DynamoDB state locking migration requires coordination with CI
  and IAM; do not delete the table as cosmetic cleanup.
- `alb.tf`: ALB egress currently permits all destinations and protocols.

The initial cleanup preserves resource addresses and existing default values.
It is not a completed production hardening review.
