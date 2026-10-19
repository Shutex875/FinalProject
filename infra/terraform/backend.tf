# Backend settings are supplied at init time via -backend-config flags
# (see .github/workflows/ci-cd.yml). Keeping this block empty lets
# `terraform init -reconfigure` and `-backend-config` take effect. Do NOT
# hardcode bucket/key/region here, or the CI flags will be ignored.
#
# For local use, run:
#   terraform init \
#     -backend-config="bucket=<state-bucket>" \
#     -backend-config="key=terraform.tfstate" \
#     -backend-config="region=eu-west-3" \
#     -backend-config="dynamodb_table=<lock-table>" \
#     -backend-config="encrypt=true"
terraform {
  backend "s3" {}
}

