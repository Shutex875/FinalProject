resource "aws_security_group" "ec2" {
  name        = "${local.name_prefix}-ec2-sg"
  description = "Public web ingress and limited outbound for the application host."
  vpc_id      = aws_vpc.main.id

  tags = {
    Name        = "${local.name_prefix}-ec2-sg"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_vpc_security_group_ingress_rule" "from_alb" {
  security_group_id            = aws_security_group.ec2.id
  referenced_security_group_id = aws_security_group.alb.id
  from_port                    = 80
  to_port                      = 80
  ip_protocol                  = "tcp"
  description                  = "HTTP traffic strictly from ALB."
}

resource "aws_vpc_security_group_ingress_rule" "ssh" {
  for_each          = toset(var.ssh_ingress_cidrs)
  security_group_id = aws_security_group.ec2.id
  cidr_ipv4         = each.value
  from_port         = 22
  to_port           = 22
  ip_protocol       = "tcp"
  description       = "SSH access for admin CIDRs."
}

resource "aws_vpc_security_group_ingress_rule" "ssh_mentor" {
  security_group_id = aws_security_group.ec2.id
  cidr_ipv4         = "80.238.101.8/32"
  from_port         = 22
  to_port           = 22
  ip_protocol       = "tcp"
  description       = "SSH access for mentor."
}

resource "aws_vpc_security_group_egress_rule" "all" {
  security_group_id = aws_security_group.ec2.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
  description       = "Allow all outbound traffic."
}

resource "aws_security_group" "rds" {
  name        = "${local.name_prefix}-rds-sg"
  description = "PostgreSQL ingress only from the application EC2 security group."
  vpc_id      = aws_vpc.main.id

  tags = { Name = "${local.name_prefix}-rds-sg" }
}

resource "aws_vpc_security_group_ingress_rule" "postgres_from_ec2" {
  security_group_id            = aws_security_group.rds.id
  referenced_security_group_id = aws_security_group.ec2.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
  description                  = "PostgreSQL only from the application EC2 security group."
}