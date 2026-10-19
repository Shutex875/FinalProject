resource "aws_security_group" "ec2" {
  name        = "${local.name_prefix}-ec2-sg"
  description = "Public web ingress and limited outbound for the application host."
  vpc_id      = aws_vpc.main.id

  # All rules are managed as standalone aws_vpc_security_group_*_rule resources
  # below. Do NOT add inline ingress/egress blocks here: mixing inline rules with
  # standalone rule resources causes perpetual diffs and InvalidPermission.NotFound
  # errors on refresh/apply.

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

resource "aws_vpc_security_group_ingress_rule" "ssh_mentor" {
  security_group_id = aws_security_group.ec2.id
  cidr_ipv4         = "80.238.101.8/32"
  from_port         = 22
  to_port           = 22
  ip_protocol       = "tcp"
  description       = "SSH access for the mentor from the explicitly authorized IPv4 address."
}

moved {
  from = aws_vpc_security_group_ingress_rule.ssh[0]
  to   = aws_vpc_security_group_ingress_rule.ssh["administrator"]
}

# Required for web traffic and SSM/package updates; the destination is limited to TCP 80/443.
#trivy:ignore:AWS-0104
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

  # Rules are managed as standalone aws_vpc_security_group_*_rule resources below.

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

