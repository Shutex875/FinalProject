# CloudWatch Logs group that receives application and system logs shipped by the
# Amazon CloudWatch Agent running on the application EC2 host.
#
# Retention is managed here explicitly rather than left to the agent's
# auto-create behaviour (which never expires logs). The agent writes with the
# CloudWatchAgentServerPolicy already attached to the EC2 role.
resource "aws_cloudwatch_log_group" "app" {
  name              = "/aws/ec2/${var.project_name}"
  retention_in_days = var.cloudwatch_log_retention_days

  tags = {
    Name    = "${local.name_prefix}-app-logs"
    Project = var.project_name
  }
}
