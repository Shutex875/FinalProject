#!/usr/bin/env bash
# Run as root: configure-cloudwatch.sh --install CONFIG_JSON [LOG_GROUP]
set -Eeuo pipefail
BASE=/etc/deck-market-monitoring
CTL=/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl
LIVE="$BASE/rendered.json"

if [[ "${1:-}" == --install ]]; then
  [[ $EUID -eq 0 ]]
  source_config=$(readlink -f "$2")
  log_group="${3:-/aws/ec2/deck-market}"
  export DEBIAN_FRONTEND=noninteractive
  if ! command -v python3 >/dev/null || ! command -v curl >/dev/null; then
    apt-get -o DPkg::Lock::Timeout=300 update
    apt-get -o DPkg::Lock::Timeout=300 install -y python3 curl ca-certificates
  fi
  if [[ ! -x "$CTL" ]]; then
    pkg=$(mktemp --suffix=.deb)
    trap 'rm -f "$pkg"' EXIT
    curl --retry 3 -fsSL "https://amazoncloudwatch-agent.s3.amazonaws.com/ubuntu/$(dpkg --print-architecture)/latest/amazon-cloudwatch-agent.deb" -o "$pkg"
    dpkg -i "$pkg"
  fi
  install -d -m 0750 "$BASE"
  python3 - "$source_config" "$BASE/template.json" "$log_group" <<'PY'
import json, sys
config = json.load(open(sys.argv[1]))
for entry in config["logs"]["logs_collected"]["files"]["collect_list"]:
    entry["log_group_name"] = sys.argv[3]
    entry.pop("retention_in_days", None)  # Terraform owns retention.
with open(sys.argv[2], "w") as output:
    json.dump(config, output, indent=2)
PY
  install -m 0750 "$(readlink -f "$0")" /usr/local/sbin/configure-app-cloudwatch
  cat >/etc/systemd/system/deck-market-cloudwatch-refresh.service <<'UNIT'
[Unit]
Description=Refresh server Docker log path for CloudWatch
After=docker.service network-online.target
Wants=network-online.target
[Service]
Type=oneshot
ExecStart=/usr/local/sbin/configure-app-cloudwatch --refresh
UNIT
  cat >/etc/systemd/system/deck-market-cloudwatch-refresh.timer <<'UNIT'
[Unit]
Description=Track server container recreation for CloudWatch logs
[Timer]
OnBootSec=30s
OnUnitActiveSec=30s
[Install]
WantedBy=timers.target
UNIT
  systemctl daemon-reload
  systemctl enable amazon-cloudwatch-agent
  systemctl enable --now deck-market-cloudwatch-refresh.timer
elif [[ "${1:-}" != --refresh ]]; then
  echo "Usage: $0 --install CONFIG_JSON [LOG_GROUP] | --refresh" >&2
  exit 2
fi

# Resolve exactly the server service; never glob unrelated container log files.
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
python3 - "$BASE/template.json" "$tmp" <<'PY'
import json, subprocess, sys
config = json.load(open(sys.argv[1]))
config["agent"]["run_as_user"] = "root"
entries = config["logs"]["logs_collected"]["files"]["collect_list"]
app = next(entry for entry in entries if entry["log_stream_name"].endswith("/server"))
ids = subprocess.check_output([
    "docker", "ps", "-q", "--filter", "label=com.docker.compose.service=server"
], text=True).split()
if len(ids) > 1:
    raise SystemExit("Multiple server services found; refusing ambiguous log collection")
if ids:
    container = json.loads(subprocess.check_output(["docker", "inspect", ids[0]]))[0]
    if container["HostConfig"]["LogConfig"]["Type"] != "json-file":
        raise SystemExit("server must use the json-file Docker logging driver")
    app["file_path"] = container["LogPath"]
    app["log_stream_name"] = "{instance_id}/server/" + container["Id"][:12]
else:
    entries.remove(app)  # Boot before deployment: collect system logs, retry on timer.
config["logs"]["force_flush_interval"] = 5
with open(sys.argv[2], "w") as output:
    json.dump(config, output, indent=2)
PY
if ! cmp -s "$tmp" "$LIVE" || ! systemctl is-active --quiet amazon-cloudwatch-agent; then
  install -m 0640 "$tmp" "$LIVE"
  "$CTL" -a fetch-config -m ec2 -s -c "file:$LIVE"
fi
for attempt in {1..15}; do
  if systemctl is-active --quiet amazon-cloudwatch-agent; then exit 0; fi
  sleep 1
done
echo "CloudWatch Agent failed to start" >&2
exit 1
