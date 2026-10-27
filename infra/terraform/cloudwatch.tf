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

# CloudWatch Metric Alarm for high CPU utilization on the application EC2 instance
resource "aws_cloudwatch_metric_alarm" "app_instance_high_cpu" {
  alarm_name          = "${local.name_prefix}-app-instance-high-cpu"
  alarm_description   = "Triggers when average CPU utilization is > 85% for one 60s period."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  datapoints_to_alarm = 1
  threshold           = 85
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  statistic           = "Average"
  period              = 60
  actions_enabled     = true
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    InstanceId = aws_instance.app.id
  }

  treat_missing_data = "missing"

  tags = {
    Name    = "${local.name_prefix}-app-instance-high-cpu"
    Project = var.project_name
  }
}
resource "aws_sns_topic" "alerts" {
  name              = "${var.project_name}-alerts"
  kms_master_key_id = "alias/aws/sns"
}

resource "aws_sns_topic_policy" "alerts" {
  arn = aws_sns_topic.alerts.arn
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "cloudwatch.amazonaws.com" }
      Action    = "sns:Publish"
      Resource  = aws_sns_topic.alerts.arn
      Condition = {
        StringEquals = {
          "aws:SourceAccount" = data.aws_caller_identity.current.account_id
        }
        ArnEquals = {
          "aws:SourceArn" = aws_cloudwatch_metric_alarm.app_instance_high_cpu.arn
        }
      }
    }]
  })
}

resource "aws_iam_role" "telegram_alert" {
  name = "${local.name_prefix}-telegram-alert"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_cloudwatch_log_group" "telegram_alert" {
  name              = "/aws/lambda/${local.name_prefix}-telegram-alert"
  retention_in_days = 14
}

resource "aws_iam_role_policy" "telegram_alert_logs" {
  name = "lambda-logs"
  role = aws_iam_role.telegram_alert.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
      Resource = "${aws_cloudwatch_log_group.telegram_alert.arn}:*"
    }]
  })
}

data "archive_file" "telegram_alert" {
  type        = "zip"
  source_file = "${path.module}/files/telegram_alert.py"
  output_path = "${path.module}/.terraform/telegram-alert.zip"
}

resource "aws_lambda_function" "telegram_alert" {
  function_name    = "${local.name_prefix}-telegram-alert"
  role             = aws_iam_role.telegram_alert.arn
  runtime          = "python3.12"
  handler          = "telegram_alert.handler"
  filename         = data.archive_file.telegram_alert.output_path
  source_code_hash = data.archive_file.telegram_alert.output_base64sha256
  timeout          = 30
  memory_size      = 128

  environment {
    variables = {
      TELEGRAM_BOT_TOKEN = var.telegram_bot_token
      TELEGRAM_CHAT_ID   = var.telegram_chat_id
    }
  }

  depends_on = [aws_iam_role_policy.telegram_alert_logs]
}

resource "aws_lambda_permission" "sns_telegram" {
  statement_id   = "AllowSNS"
  action         = "lambda:InvokeFunction"
  function_name  = aws_lambda_function.telegram_alert.function_name
  principal      = "sns.amazonaws.com"
  source_arn     = aws_sns_topic.alerts.arn
  source_account = data.aws_caller_identity.current.account_id
}

resource "aws_sns_topic_subscription" "telegram" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.telegram_alert.arn

  depends_on = [aws_lambda_permission.sns_telegram]
}
