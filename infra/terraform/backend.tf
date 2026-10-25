# Defaults for the existing deck-market remote state. CI can override these
# values with -backend-config flags; empty overrides must be rejected by CI.
terraform {
  backend "s3" {
    bucket         = "deck-market-tfstate-394567896469-eu-west-3"
    key            = "terraform.tfstate"
    region         = "eu-west-3"
    dynamodb_table = "deck-market-terraform-locks"
    encrypt        = true
  }
}
