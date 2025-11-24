#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/infrastructure/compose.yml"
DEFAULT_TARGETS=("web" "persona-api" "chat-api" "indexing-api")

usage() {
  cat <<'EOF'
Usage: scripts/build.sh [service...]

Services:
  web
  persona-api
  chat-api
  indexing-api
  all (default)

Environment:
  LOCAL_DOCKER_CACHE_ROOT   Required path for BuildKit cache mirrors.
  WEB_RUN_BUILD             Set to true to run `next build` inside the web image.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ -z "${LOCAL_DOCKER_CACHE_ROOT:-}" ]]; then
  echo "LOCAL_DOCKER_CACHE_ROOT is not set. See knowledge/build-cache.md." >&2
  exit 1
fi

mkdir -p "${LOCAL_DOCKER_CACHE_ROOT}/web" "${LOCAL_DOCKER_CACHE_ROOT}/python"

targets=("${DEFAULT_TARGETS[@]}")
if [[ $# -gt 0 && "${1}" != "all" ]]; then
  targets=("$@")
fi

for target in "${targets[@]}"; do
  echo "▶︎ Building ${target}"
  DOCKER_BUILDKIT=1 docker compose -f "${COMPOSE_FILE}" build "${target}"
done


