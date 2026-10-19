variable "aws_region" {
  description = "AWS region for the stack."
  type        = string
  default     = "eu-west-3"
}

variable "project_name" {
  description = "Short project prefix used in resource names."
  type        = string
  default     = "deck-market"
}

variable "environment" {
  description = "Environment name, for example dev or staging."
  type        = string
  default     = "dev"
}

variable "vpc_cidr" {
  description = "IPv4 CIDR block for the VPC."
  type        = string
  default     = "10.40.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "Two public IPv4 subnet CIDRs in distinct availability zones."
  type        = list(string)
  default     = ["10.40.1.0/24", "10.40.2.0/24"]

  validation {
    condition     = length(var.public_subnet_cidrs) == 2
    error_message = "Provide exactly two public subnet CIDRs."
  }
}

variable "private_subnet_cidrs" {
  description = "Two private IPv4 subnet CIDRs for the RDS subnet group."
  type        = list(string)
  default     = ["10.40.11.0/24", "10.40.12.0/24"]

  validation {
    condition     = length(var.private_subnet_cidrs) == 2
    error_message = "Provide exactly two private subnet CIDRs."
  }
}

variable "instance_type" {
  description = "EC2 instance type."
  type        = string
  default     = "t3.micro"
}

variable "db_instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t3.micro"
}

variable "db_name" {
  description = "Initial PostgreSQL database name."
  type        = string
  default     = "appdb"
}

variable "db_username" {
  description = "RDS master username."
  type        = string
  default     = "appuser"
}

variable "db_password" {
  description = "RDS master password. Terraform state contains this value; protect the remote state."
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.db_password) >= 16
    error_message = "Use a unique RDS password at least 16 characters long."
  }
}

variable "cloudfront_distribution_arn" {
  description = "ARN of the CloudFront distribution allowed to read from the images bucket. Empty string disables the OAC policy."
  type        = string
  default     = ""
}

variable "image_tag" {
  description = "Git commit SHA used to tag the application container images."
  type        = string
  default     = "bootstrap"
}

variable "ssh_ingress_cidrs" {
  description = "Optional list of IPv4 CIDRs allowed to SSH, e.g. [\"198.51.100.25/32\"]. Empty list disables SSH (recommended; use SSM instead)."
  type        = list(string)
  default     = []
  nullable    = false

  validation {
    condition = alltrue([
      for cidr in var.ssh_ingress_cidrs :
      can(cidrnetmask(cidr)) && cidr != "0.0.0.0/0"
    ])
    error_message = "Each SSH CIDR must be a valid, non-public IPv4 CIDR (the world-open 0.0.0.0/0 is not allowed)."
  }
}

variable "ec2_key_name" {
  description = "Existing EC2 key pair name. Required only when ssh_ingress_cidrs is non-empty."
  type        = string
  default     = null
  nullable    = true

  validation {
    condition     = length(var.ssh_ingress_cidrs) == 0 || var.ec2_key_name != null
    error_message = "Set ec2_key_name when enabling SSH ingress; otherwise leave SSH disabled and use SSM."
  }
}

