apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker

# ---------------------------------------------------------------------------
# Amazon CloudWatch Agent - collect system metrics and application logs.
# Logging is best-effort: a failure here must never block the app deployment,
# so these steps warn instead of aborting the whole bootstrap.
# ---------------------------------------------------------------------------
install_cloudwatch_agent() {
  if command -v /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl >/dev/null 2>&1; then
    echo "CloudWatch Agent already installed; skipping package install."
    return 0
  fi

  local arch pkg_url tmp_pkg os_id os_like family
  arch="$(uname -m)"
  tmp_pkg="$(mktemp)"

  # Detect the OS family so the same template works on Ubuntu/Debian and Amazon Linux/RHEL.
  os_id="$(. /etc/os-release && echo "$${ID:-}")"
  os_like="$(. /etc/os-release && echo "$${ID_LIKE:-}")"
  case " $${os_id} $${os_like} " in
    *" ubuntu "*|*" debian#!/bin/bash
set -euo pipefail

exec > >(tee -a /var/log/user-data.log | logger -t user-data -s 2>/dev/console) 2>&1
export DEBIAN_FRONTEND=noninteractive

AWS_REGION="${aws_region}"
PROJECT_NAME="${project_name}"
ENVIRONMENT="${environment}"
ARTIFACTS_BUCKET="${artifacts_bucket}"
CONFIG_PREFIX="${config_prefix}"
CW_AGENT_CONFIG_B64="${cw_agent_config_b64}"
APP_DIR="/opt/app"
export AWS_REGION PROJECT_NAME ENVIRONMENT ARTIFACTS_BUCKET

apt-get update
apt-get install -y ca-certificates curl awscli

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$${VERSION_CODENAME}") stable" > /etc/apt/sources.list.d/docker.list

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker

# ---------------------------------------------------------------------------
# Amazon CloudWatch Agent - collect system metrics and application logs.
# Logging is best-effort: a failure here must never block the app deployment,
# so these steps warn instead of aborting the whole bootstrap.
# ---------------------------------------------------------------------------
install_cloudwatch_agent() {
  if command -v /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl >/dev/null 2>&1; then
    echo "CloudWatch Agent already installed; skipping package install."
    return 0
  fi

  local arch pkg_url tmp_pkg os_id os_like family
  arch="$(uname -m)"
  tmp_pkg="$(mktemp)"

  # Detect the OS family so the same template works on Ubuntu/Debian and Amazon Linux/RHEL.
  os_id="$(. /etc/os-release && echo "$${ID:-}")"
  os_like="$(. /etc/os-release && echo "$${ID_LIKE:-}")"
  case " $${os_id} $${os_like} " in
    *" ubuntu "*|*" debian

install -d -m 0750 "$APP_DIR"
aws s3 sync "s3://$${ARTIFACTS_BUCKET}/$${CONFIG_PREFIX}/" "$${APP_DIR}/" --region "$${AWS_REGION}"

cd "$${APP_DIR}"
chmod 750 deploy.sh
./deploy.sh current


