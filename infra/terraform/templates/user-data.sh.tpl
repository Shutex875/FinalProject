#!/bin/bash
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

printf '%s' '${docker_bootstrap_b64}' | base64 --decode > /usr/local/sbin/ensure-app-docker
chmod 750 /usr/local/sbin/ensure-app-docker
bash /usr/local/sbin/ensure-app-docker
apt-get -o DPkg::Lock::Timeout=300 install -y awscli

# Monitoring failure must not prevent application deployment.
printf '%s' '${cw_bootstrap_b64}' | base64 --decode > /tmp/configure-cloudwatch.sh
printf '%s' "$CW_AGENT_CONFIG_B64" | base64 --decode > /tmp/cloudwatch-agent.json
if ! bash /tmp/configure-cloudwatch.sh --install /tmp/cloudwatch-agent.json '${cw_log_group_name}'; then
  echo 'Warning: CloudWatch setup failed; continuing application bootstrap.' >&2
fi

install -d -m 0750 "$APP_DIR"
aws s3 sync "s3://$${ARTIFACTS_BUCKET}/$${CONFIG_PREFIX}/" "$${APP_DIR}/" --region "$${AWS_REGION}"
cd "$${APP_DIR}"
chmod 750 deploy.sh
./deploy.sh current
