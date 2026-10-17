variable "aws_region" {
  description = "AWS region for Terraform state resources."
  type        = string
  default     = "eu-west-3"
}

variable "project_name" {
  description = "Prefix used for state resource names."
  type        = string
  default     = "deck-market"
}
