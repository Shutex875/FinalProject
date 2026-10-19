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

Set `db_password` to a unique password (at least 16 characters). If SSH is needed, set `ssh_ingress_cidr` to your public IP in `/32` notation and `ec2_key_name` to an existing EC2 key pair. Leave SSH disabled by keeping the CIDR `null`; use SSM Session Manager instead. Do not commit `terraform.tfvars`.

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

Secrets: `RDS_USERNAME`, `RDS_PASSWORD` (also used as `TF_VAR_db_password`), `JWT_SECRET`, `JWT_REFRESH_SECRET`.

### Required IAM permissions for the deployer role

The role assumed by CI needs the permissions in `iam/github-actions-deployer-additional-policy.json` (ECR push, Terraform refresh reads, SSM send-command, KMS key management for S3 encryption). Attach it in addition to the baseline deployer policy and review it against the resources your stack creates.

The SSH ingress rule uses a stable `for_each` key, and the `moved` block maps the existing `ssh[0]` state address to that key without recreating the rule. The plan check fails if any managed resource would be deleted or replaced. This prevents a missing Actions variable or a Terraform change from silently passing CI with a destructive plan. Review the full plan and update the expected infrastructure configuration before changing this protection.

## Security and operational notes

- Only the web listener ports 80/443 are internet-facing. SSH is a separate optional ingress rule constrained to `ssh_ingress_cidr`; no SSH rule is created by default.
- RDS is not publicly accessible and its inbound PostgreSQL rule references only the EC2 security group. Private subnets have no internet route/NAT.
- EC2 has SSM and CloudWatch Agent managed policies plus scoped ECR pull and S3 access (including `kms:Decrypt`/`kms:GenerateDataKey` on the S3 key). It never receives the database credentials through user data.
- S3 buckets (`images`, `images_logs`, `artifacts`) are encrypted with a customer-managed KMS key (`aws_kms_key.s3`, rotation enabled); public access is blocked.
- Application deployment runs over SSM; the EC2 instance pulls images from ECR and manifests from S3. No SSH access is required.
- This is a development-oriented single-AZ RDS instance with deletion protection disabled and final snapshot skipped. Change those settings before using it for production data.
- State locking uses the DynamoDB table. `use_lockfile` is intentionally not set, so the workflow relies on DynamoDB locking only.

## Destroy the application stack

```powershell
terraform -chdir=infra/terraform destroy
```

Keep the bootstrap bucket and lock table after destroying the application stack while any remote Terraform state still uses them. The bucket intentionally refuses force deletion and the lock table has deletion protection enabled.
