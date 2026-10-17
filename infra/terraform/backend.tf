# Configure with terraform init -backend-config after bootstrap/ has created
# the S3 bucket and DynamoDB lock table. Backend blocks cannot use variables.
terraform {
  backend "s3" {
    bucket = "finalproject-deck-market-terraform-394567896469-eu-west-3-an"
    key    = "terraform.tfstate"
    region = "eu-west-3"
  }
}
