#!/usr/bin/env bash
set -Eeuo pipefail

die() {
  printf 'deploy: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

quote_remote() {
  printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"
}

deploy_on_instance() {
  local release="$1"
  local release_prefix
  local account_id
  local registry
  local elapsed=0

  AWS_REGION="${AWS_REGION:-eu-west-3}"
  PROJECT_NAME="${PROJECT_NAME:-finalproject}"
  ENVIRONMENT="${ENVIRONMENT:-dev}"
  ARTIFACTS_BUCKET="${ARTIFACTS_BUCKET:-}"
  APP_DIR="${APP_DIR:-/opt/app}"
  HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-180}"

  [[ -n "$ARTIFACTS_BUCKET" ]] || die 'ARTIFACTS_BUCKET is required on the EC2 instance.'
  [[ "$release" == current || "$release" =~ ^[0-9a-f]{40}$ ]] || die 'Pass current or a full 40-character Git SHA.'
  require_command aws
  require_command docker

  release_prefix="${PROJECT_NAME}/${ENVIRONMENT}/config"
  if [[ "$release" != current ]]; then
    release_prefix+="/releases/${release}"
  else
    release_prefix+="/current"
  fi

  install -d -m 0750 "$APP_DIR"
  aws s3 cp "s3://${ARTIFACTS_BUCKET}/${release_prefix}/docker-compose.prod.yml" "$APP_DIR/docker-compose.prod.yml" --region "$AWS_REGION"
  aws s3 cp "s3://${ARTIFACTS_BUCKET}/${release_prefix}/.env" "$APP_DIR/.env" --region "$AWS_REGION"
  chmod 600 "$APP_DIR/.env"

  account_id="$(aws sts get-caller-identity --query Account --output text)"
  registry="${account_id}.dkr.ecr.${AWS_REGION}.amazonaws.com"
  aws ecr get-login-password --region "$AWS_REGION" \
    | docker login --username AWS --password-stdin "$registry"

  cd "$APP_DIR"
  docker compose --env-file .env -f docker-compose.prod.yml config --quiet
  docker compose --env-file .env -f docker-compose.prod.yml pull
  docker compose --env-file .env -f docker-compose.prod.yml up -d --remove-orphans

  until docker compose --env-file .env -f docker-compose.prod.yml exec -T server \
      node -e "fetch('http://127.0.0.1:5000/').then(r => process.exit(r.status < 500 ? 0 : 1)).catch(() => process.exit(1))"; do
    if (( elapsed >= HEALTH_TIMEOUT_SECONDS )); then
      docker compose --env-file .env -f docker-compose.prod.yml logs --tail=100 server >&2
      die "Health check on port 5000 failed after ${HEALTH_TIMEOUT_SECONDS} seconds."
    fi
    sleep 5
    elapsed=$((elapsed + 5))
  done

  printf 'Deployment healthy for release %s.\n' "$release"
}

if [[ $# -eq 1 && ( "$1" == current || "$1" =~ ^[0-9a-f]{40}$ ) ]]; then
  deploy_on_instance "$1"
  exit 0
fi

DEPLOY_METHOD="${DEPLOY_METHOD:-}"
if [[ -z "$DEPLOY_METHOD" ]]; then
  if [[ -n "${SSM_INSTANCE_ID:-}" ]]; then
    DEPLOY_METHOD=ssm
  else
    DEPLOY_METHOD=ssh
  fi
fi

AWS_REGION="${AWS_REGION:-eu-west-3}"
PROJECT_NAME="${PROJECT_NAME:-finalproject}"
ENVIRONMENT="${ENVIRONMENT:-production}"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/${PROJECT_NAME}/${ENVIRONMENT}}"
IMAGE_TAG="${IMAGE_TAG:-}"
ECR_REPO_URL="${ECR_REPO_URL:-}"
ENV_FILE="${ENV_FILE:-.env}"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-180}"

[[ -n "$IMAGE_TAG" ]] || die 'Set IMAGE_TAG to the immutable image tag to deploy.'
[[ "$IMAGE_TAG" =~ ^[A-Za-z0-9_.-]+$ ]] || die 'IMAGE_TAG may contain only letters, numbers, dots, underscores, and hyphens.'
[[ -n "$ECR_REPO_URL" ]] || die 'Set ECR_REPO_URL to the server ECR repository URL.'
[[ "$ECR_REPO_URL" =~ ^[0-9]{12}\.dkr\.ecr\.[a-z0-9-]+\.amazonaws\.com(/[A-Za-z0-9._/-]+)?$ ]] || die 'ECR_REPO_URL does not look like an AWS ECR repository URL.'
[[ "$AWS_REGION" =~ ^[a-z0-9-]+$ ]] || die 'AWS_REGION has an invalid format.'
[[ "$HEALTH_TIMEOUT_SECONDS" =~ ^[0-9]+$ ]] || die 'HEALTH_TIMEOUT_SECONDS must be a positive integer.'
[[ -f docker-compose.prod.yml ]] || die 'Run deploy.sh from the repository root.'
[[ -f "$ENV_FILE" ]] || die "Environment file not found: $ENV_FILE"
[[ -d client ]] || die 'Client build context directory not found.'

WORK_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

mkdir -p "$WORK_DIR/package"
cp docker-compose.prod.yml "$WORK_DIR/package/"
cp "$ENV_FILE" "$WORK_DIR/package/.env"
mkdir -p "$WORK_DIR/package/client"
tar -czf "$WORK_DIR/client.tar.gz" --exclude=node_modules --exclude=build --exclude=.git -C . client
tar -xzf "$WORK_DIR/client.tar.gz" -C "$WORK_DIR/package"

cat > "$WORK_DIR/package/deploy-remote.sh" <<'REMOTE'
#!/usr/bin/env bash
set -Eeuo pipefail

: "${APP_DIR:?APP_DIR is required}"
: "${AWS_REGION:?AWS_REGION is required}"
: "${ECR_REPO_URL:?ECR_REPO_URL is required}"
: "${IMAGE_TAG:?IMAGE_TAG is required}"
: "${HEALTH_TIMEOUT_SECONDS:?HEALTH_TIMEOUT_SECONDS is required}"

cd "$APP_DIR"
export ECR_REPO_URL IMAGE_TAG
docker compose --env-file .env -f docker-compose.prod.yml config --quiet

ECR_REGISTRY="${ECR_REPO_URL%%/*}"
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$ECR_REGISTRY"

docker compose --env-file .env -f docker-compose.prod.yml pull server
docker compose --env-file .env -f docker-compose.prod.yml up -d --build --remove-orphans

elapsed=0
until docker compose --env-file .env -f docker-compose.prod.yml exec -T server \
    node -e "fetch('http://127.0.0.1:5000/').then(r => process.exit(r.status < 500 ? 0 : 1)).catch(() => process.exit(1))"; do
  if (( elapsed >= HEALTH_TIMEOUT_SECONDS )); then
    docker compose --env-file .env -f docker-compose.prod.yml logs --tail=100 server >&2
    printf 'Health check on port 5000 failed after %s seconds.\n' "$HEALTH_TIMEOUT_SECONDS" >&2
    exit 1
  fi
  sleep 5
  elapsed=$((elapsed + 5))
done

printf 'Deployment healthy: %s:%s\n' "$ECR_REPO_URL" "$IMAGE_TAG"
REMOTE
chmod 700 "$WORK_DIR/package/deploy-remote.sh"

tar -czf "$WORK_DIR/deploy-package.tar.gz" -C "$WORK_DIR/package" .

case "$DEPLOY_METHOD" in
  ssh)
    require_command ssh
    require_command scp
    SSH_TARGET="${SSH_TARGET:-}"
    [[ -n "$SSH_TARGET" ]] || die 'Set SSH_TARGET, for example ubuntu@host.'
    SSH_KEY_PATH="${SSH_KEY_PATH:-}"
    SSH_ARGS=(-o BatchMode=yes -o StrictHostKeyChecking=yes)
    if [[ -n "$SSH_KEY_PATH" ]]; then
      [[ -f "$SSH_KEY_PATH" ]] || die "SSH key not found: $SSH_KEY_PATH"
      SSH_ARGS+=(-i "$SSH_KEY_PATH" -o IdentitiesOnly=yes)
    fi
    REMOTE_PACKAGE="/tmp/deploy-${IMAGE_TAG}.tar.gz"
    scp "${SSH_ARGS[@]}" "$WORK_DIR/deploy-package.tar.gz" "${SSH_TARGET}:${REMOTE_PACKAGE}"

    REMOTE_COMMAND="mkdir -p $(quote_remote "$DEPLOY_DIR") && tar -xzf $(quote_remote "$REMOTE_PACKAGE") -C $(quote_remote "$DEPLOY_DIR") && rm -f $(quote_remote "$REMOTE_PACKAGE") && env APP_DIR=$(quote_remote "$DEPLOY_DIR") AWS_REGION=$(quote_remote "$AWS_REGION") ECR_REPO_URL=$(quote_remote "$ECR_REPO_URL") IMAGE_TAG=$(quote_remote "$IMAGE_TAG") HEALTH_TIMEOUT_SECONDS=$(quote_remote "$HEALTH_TIMEOUT_SECONDS") bash $(quote_remote "$DEPLOY_DIR/deploy-remote.sh")"
    ssh "${SSH_ARGS[@]}" "$SSH_TARGET" "$REMOTE_COMMAND"
    ;;

  ssm)
    require_command aws
    require_command jq
    SSM_INSTANCE_ID="${SSM_INSTANCE_ID:-}"
    ARTIFACTS_BUCKET="${ARTIFACTS_BUCKET:-}"
    [[ -n "$SSM_INSTANCE_ID" ]] || die 'Set SSM_INSTANCE_ID for SSM deployment.'
    [[ "$SSM_INSTANCE_ID" =~ ^i-[0-9a-f]+$ ]] || die 'SSM_INSTANCE_ID must be an EC2 instance ID.'
    [[ -n "$ARTIFACTS_BUCKET" ]] || die 'Set ARTIFACTS_BUCKET for SSM package upload.'
    S3_KEY="${PROJECT_NAME}/${ENVIRONMENT}/config/releases/${IMAGE_TAG}.tar.gz"
    S3_URI="s3://${ARTIFACTS_BUCKET}/${S3_KEY}"
    aws s3 cp "$WORK_DIR/deploy-package.tar.gz" "$S3_URI" --region "$AWS_REGION"

    REMOTE_COMMAND="set -eu; if ! command -v aws >/dev/null 2>&1; then export DEBIAN_FRONTEND=noninteractive; apt-get update; apt-get install -y awscli; fi; aws s3 cp $(quote_remote "$S3_URI") /tmp/deploy-${IMAGE_TAG}.tar.gz --region $(quote_remote "$AWS_REGION"); mkdir -p $(quote_remote "$DEPLOY_DIR"); tar -xzf /tmp/deploy-${IMAGE_TAG}.tar.gz -C $(quote_remote "$DEPLOY_DIR"); rm -f /tmp/deploy-${IMAGE_TAG}.tar.gz; env APP_DIR=$(quote_remote "$DEPLOY_DIR") AWS_REGION=$(quote_remote "$AWS_REGION") ECR_REPO_URL=$(quote_remote "$ECR_REPO_URL") IMAGE_TAG=$(quote_remote "$IMAGE_TAG") HEALTH_TIMEOUT_SECONDS=$(quote_remote "$HEALTH_TIMEOUT_SECONDS") bash $(quote_remote "$DEPLOY_DIR/deploy-remote.sh")"
    INPUT_JSON="$(jq -n --arg instance "$SSM_INSTANCE_ID" --arg command "$REMOTE_COMMAND" '{DocumentName:"AWS-RunShellScript",InstanceIds:[$instance],Parameters:{commands:[$command]},TimeoutSeconds:600}')"
    COMMAND_ID="$(aws ssm send-command --cli-input-json "$INPUT_JSON" --region "$AWS_REGION" --query 'Command.CommandId' --output text)"
    printf 'SSM command %s sent to %s\n' "$COMMAND_ID" "$SSM_INSTANCE_ID"

    elapsed=0
    while (( elapsed < 600 )); do
      STATUS="$(aws ssm get-command-invocation --command-id "$COMMAND_ID" --instance-id "$SSM_INSTANCE_ID" --region "$AWS_REGION" --query 'Status' --output text 2>/dev/null || true)"
      case "$STATUS" in
        Success)
          aws ssm get-command-invocation --command-id "$COMMAND_ID" --instance-id "$SSM_INSTANCE_ID" --region "$AWS_REGION" --query 'StandardOutputContent' --output text
          exit 0
          ;;
        Failed|Cancelled|TimedOut|DeliveryTimedOut|ExecutionTimedOut)
          aws ssm get-command-invocation --command-id "$COMMAND_ID" --instance-id "$SSM_INSTANCE_ID" --region "$AWS_REGION" --query 'StandardErrorContent' --output text >&2 || true
          die "SSM deployment ended with status: $STATUS"
          ;;
      esac
      sleep 5
      elapsed=$((elapsed + 5))
    done
    die "Timed out waiting for SSM command $COMMAND_ID."
    ;;

  *)
    die 'DEPLOY_METHOD must be ssh or ssm.'
    ;;
esac
