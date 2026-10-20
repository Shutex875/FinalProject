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
  for_each = toset(var.ssh_ingress_cidrs)

  security_group_id = aws_security_group.ec2.id
  cidr_ipv4         = each.value
  from_port         = 22
  to_port           = 22
  ip_protocol       = "tcp"
  description       = "SSH from explicitly configured CIDR ${each.value}."
}

# Migrate the previously keyed "administrator" SSH rule to the CIDR-keyed address
# so the existing live security group rule is preserved (no destroy/recreate).
# Update the right-hand key if your configured ssh_ingress_cidr value differs.
moved {
  from = aws_vpc_security_group_ingress_rule.ssh["administrator"]
  to   = aws_vpc_security_group_ingress_rule.ssh["79.168.197.171/32"]
}

# The hardcoded mentor SSH rule is removed and folded into var.ssh_ingress_cidrs.
# To keep that access, add its CIDR to ssh_ingress_cidrs; otherwise it is dropped.
removed {
  from = aws_vpc_security_group_ingress_rule.ssh_mentor

  lifecycle {
    destroy = false
  }
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

