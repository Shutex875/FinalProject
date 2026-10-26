resource "aws_instance" "app" {
  ami                         = data.aws_ssm_parameter.ubuntu_2204_ami.value
  instance_type               = var.instance_type
  key_name                    = var.ec2_key_name
  subnet_id                   = aws_subnet.public[0].id
  associate_public_ip_address = true
  vpc_security_group_ids      = [aws_security_group.ec2.id]
  iam_instance_profile        = aws_iam_instance_profile.ec2.name
  monitoring                  = true

  user_data_replace_on_change = false

  user_data = templatefile("${path.module}/templates/user-data.sh.tpl", {
    aws_region        = var.aws_region
    project_name      = var.project_name
    environment       = var.environment
    artifacts_bucket  = aws_s3_bucket.artifacts.id
    config_prefix     = "${var.project_name}/${var.environment}/config/current"
    cw_log_group_name = aws_cloudwatch_log_group.app.name
    # Base64-encode the static CloudWatch Agent config so its ${aws:...}
    # placeholders are passed through verbatim (they are resolved by the agent,
    # not by Terraform's templatefile).
    cw_agent_config_b64  = filebase64("${path.module}/files/amazon-cloudwatch-agent.json")
    docker_bootstrap_b64 = filebase64("${path.module}/../../scripts/ensure-docker.sh")
    cw_bootstrap_b64     = filebase64("${path.module}/../../scripts/configure-cloudwatch.sh")
  })
  lifecycle {
    ignore_changes = [
      ami,
      user_data,
    ]
  }
  root_block_device {
    encrypted             = true
    volume_type           = "gp3"
    volume_size           = 20
    delete_on_termination = true
  }

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  tags = {
    Name     = "${local.name_prefix}-app"
    ImageTag = var.image_tag
    Project  = var.project_name
  }
}

