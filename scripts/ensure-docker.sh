#!/usr/bin/env bash
set -Eeuo pipefail
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

if (( EUID != 0 )); then
  exec sudo -n bash "$0" "$@"
fi

if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  . /etc/os-release
  case "$ID" in
    ubuntu|debian) ;;
    *) printf 'Unsupported Docker bootstrap OS: %s\n' "$ID" >&2; exit 1 ;;
  esac
  export DEBIAN_FRONTEND=noninteractive
  apt-get -o DPkg::Lock::Timeout=300 -o Acquire::Retries=3 update
  apt-get -o DPkg::Lock::Timeout=300 install -y ca-certificates curl
  install -m 0755 -d /etc/apt/keyrings
  curl --retry 3 -fsSL "https://download.docker.com/linux/$ID/gpg" -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/%s %s stable\n' \
    "$(dpkg --print-architecture)" "$ID" "${UBUNTU_CODENAME:-$VERSION_CODENAME}" > /etc/apt/sources.list.d/docker.list
  apt-get -o DPkg::Lock::Timeout=300 -o Acquire::Retries=3 update
  apt-get -o DPkg::Lock::Timeout=300 install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

systemctl enable --now docker
docker info >/dev/null
docker compose version
