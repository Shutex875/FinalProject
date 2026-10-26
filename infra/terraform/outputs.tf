output "ec2_public_ip" {
  description = "Public IPv4 address of the application host."
  value       = aws_instance.app.public_ip
}

output "ec2_public_dns" {
  description = "Public DNS name of the application host."
  value       = aws_instance.app.public_dns
}

output "instance_id" {
  description = "EC2 instance ID used by SSM deployments."
  value       = aws_instance.app.id
}

output "rds_endpoint" {
  description = "Private PostgreSQL endpoint (reachable from inside the VPC only)."
  value       = aws_db_instance.postgres.address
}

output "rds_port" {
  description = "PostgreSQL port."
  value       = aws_db_instance.postgres.port
}

output "vpc_id" {
  description = "VPC ID."
  value       = aws_vpc.main.id
}

output "ec2_security_group_id" {
  description = "Application EC2 security group ID."
  value       = aws_security_group.ec2.id
}

output "rds_security_group_id" {
  description = "Private RDS security group ID."
  value       = aws_security_group.rds.id
}

output "server_ecr_repository_url" {
  description = "URL of the server ECR repository."
  value       = aws_ecr_repository.server.repository_url
}

output "client_ecr_repository_url" {
  description = "URL of the client ECR repository."
  value       = aws_ecr_repository.client.repository_url
}

output "artifacts_bucket_name" {
  description = "Name of the versioned artifacts S3 bucket."
  value       = aws_s3_bucket.artifacts.id
}

output "cpu_alarm_name" {
  value = aws_cloudwatch_metric_alarm.app_instance_high_cpu.alarm_name
}
