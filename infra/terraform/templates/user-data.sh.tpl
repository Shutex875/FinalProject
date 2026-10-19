#!/bin/bash
set -euo pipefail

exec > >(tee -a /var/log/user-data.log | logger -t user-data -s 2>/dev/console) 2>&1
export DEBIAN_FRONTEND=noninteractive

AWS_REGION="${aws_region}"
PROJECT_NAME="${project_name}"
ENVIRONMENT="${environment}"
ARTIFACTS_BUCKET="${artifacts_bucket}"
CONFIG_PREFIX="${config_prefix}"
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

install -d -m 0750 "$APP_DIR"
aws s3 sync "s3://$${ARTIFACTS_BUCKET}/$${CONFIG_PREFIX}/" "$${APP_DIR}/" --region "$${AWS_REGION}"

cd "$${APP_DIR}"
chmod 750 deploy.sh
./deploy.sh current
