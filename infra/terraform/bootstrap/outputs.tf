output "state_bucket_name" {
  description = "S3 bucket for the application Terraform state."
  value       = aws_s3_bucket.terraform_state.id
}

output "lock_table_name" {
  description = "DynamoDB table for Terraform state locks."
  value       = aws_dynamodb_table.terraform_locks.name
}

output "aws_region" {
  description = "Region containing the state bucket and lock table."
  value       = var.aws_region
}
