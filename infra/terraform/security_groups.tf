resource "aws_security_group" "ec2" {
  name        = "${local.name_prefix}-ec2-sg"
  description = "Public web ingress and limited outbound for the application host."
  vpc_id      = aws_vpc.main.id

  # Rules are defined as separate resources below for explicit directionality.
  ingress = []
  egress  = []

  tags = { Name = "${local.name_prefix}-ec2-sg" }
}

resource "aws_vpc_security_group_ingress_rule" "http_https" {
  for_each = toset(["80", "443"])

  security_group_id = aws_security_group.ec2.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = tonumber(each.key)
  to_port           = tonumber(each.key)
  ip_protocol       = "tcp"
  description       = "Public web traffic on TCP ${each.key}."
}

resource "aws_vpc_security_group_ingress_rule" "ssh" {
  for_each = var.ssh_ingress_cidr == null ? {} : {
    administrator = var.ssh_ingress_cidr
  }

  security_group_id = aws_security_group.ec2.id
  cidr_ipv4         = each.value
  from_port         = 22
  to_port           = 22
  ip_protocol       = "tcp"
  description       = "SSH from the explicitly configured administrator CIDR only."
}

moved {
  from = aws_vpc_security_group_ingress_rule.ssh[0]
  to   = aws_vpc_security_group_ingress_rule.ssh["administrator"]
}

resource "aws_vpc_security_group_egress_rule" "http_https" {
  for_each = toset(["80", "443"])

  security_group_id = aws_security_group.ec2.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = tonumber(each.key)
  to_port           = tonumber(each.key)
  ip_protocol       = "tcp"
  description       = "Outbound web traffic for package updates and SSM."
}

resource "aws_vpc_security_group_egress_rule" "postgres_to_rds" {
  security_group_id            = aws_security_group.ec2.id
  referenced_security_group_id = aws_security_group.rds.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
  description                  = "Application host to its PostgreSQL database."
}

resource "aws_security_group" "rds" {
  name        = "${local.name_prefix}-rds-sg"
  description = "PostgreSQL ingress only from the application EC2 security group."
  vpc_id      = aws_vpc.main.id

  ingress = []
  egress  = []

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
