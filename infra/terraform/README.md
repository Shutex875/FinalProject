# AWS Terraform deployment

This stack creates an IPv4 VPC, a public EC2 host, private PostgreSQL RDS, security groups, and an EC2 instance role for SSM/CloudWatch. It does not build or deploy the application image; EC2 user data installs Docker Engine and the Compose plugin so an app deployment can be added separately.

## Layout

- `bootstrap/`: creates the S3 bucket and DynamoDB table required before a remote state backend can be initialized. Its state stays local; keep that state file backed up and private.
- Root `.tf` files: the application network and compute/database stack. State is stored remotely in the bootstrap S3 bucket and locked with the DynamoDB table (and the S3 lockfile).

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
  -backend-config="encrypt=true" `
  -backend-config="use_lockfile=true"
```

Review the plan before applying:

```powershell
terraform -chdir=infra/terraform plan -out=tfplan
terraform -chdir=infra/terraform apply tfplan
terraform -chdir=infra/terraform output
```

The `db_password` input is marked sensitive in CLI output, but Terraform still records RDS credentials in state. The S3 bucket enables versioning and server-side encryption; restrict access to the bucket/table to the Terraform operators.

## Configure Terraform CI

The GitHub Actions plan reads its non-secret infrastructure inputs from repository Actions variables and the database password from the existing `RDS_PASSWORD` Actions secret. Configure these repository variables to match the inputs used to create the resources already recorded in the remote state:

- `TERRAFORM_PROJECT_NAME` (currently `deck-market`)
- `TERRAFORM_ENVIRONMENT` (currently `development`)
- `TERRAFORM_EC2_KEY_NAME` (currently `ec2-final-project` when SSH is enabled)
- `TERRAFORM_SSH_INGRESS_CIDR` (the currently authorized administrator IPv4 CIDR, such as a `/32`; CI requires this value so a missing variable cannot remove the rule)

The SSH ingress rule uses a stable `for_each` key, and the `moved` block maps the existing `ssh[0]` state address to that key without recreating the rule. The plan check fails if any managed resource would be deleted or replaced. This prevents a missing Actions variable or a Terraform change from silently passing CI with a destructive plan. Review the full plan and update the expected infrastructure configuration before changing this protection.

## Security and operational notes

- Only the web listener ports 80/443 are internet-facing. SSH is a separate optional ingress rule constrained to `ssh_ingress_cidr`; no SSH rule is created by default.
- RDS is not publicly accessible and its inbound PostgreSQL rule references only the EC2 security group. Private subnets have no internet route/NAT.
- EC2 has SSM and CloudWatch Agent managed policies. No ECR permissions are attached because no image/repository is configured here.
- The EC2 bootstrap installs Docker but does not deploy the React/Express application. Add an image/release deployment flow separately; do not put database credentials in user data.
- This is a development-oriented single-AZ RDS instance with deletion protection disabled and final snapshot skipped. Change those settings before using it for production data.
- HashiCorp documents DynamoDB locking as deprecated in favor of S3 lockfiles. This backend enables both to meet the requested DynamoDB locking requirement while allowing the S3 lockfile mechanism.

## Destroy the application stack

```powershell
terraform -chdir=infra/terraform destroy
```

Keep the bootstrap bucket and lock table after destroying the application stack while any remote Terraform state still uses them. The bucket intentionally refuses force deletion and the lock table has deletion protection enabled.
