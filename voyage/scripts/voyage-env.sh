#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v doppler >/dev/null 2>&1; then
  echo "doppler CLI is not installed." >&2
  exit 1
fi

required_secrets=(
  "AI_GATEWAY_API_KEY"
  "DUFFEL_ACCESS_TOKEN"
)

optional_secrets=(
  "EXPO_PUBLIC_API_BASE_URL"
)

usage() {
  cat <<'EOF'
Usage:
  scripts/voyage-env.sh check
  scripts/voyage-env.sh run <command...>
  scripts/voyage-env.sh start [port]
  scripts/voyage-env.sh ios [port] [device]

Examples:
  scripts/voyage-env.sh check
  scripts/voyage-env.sh run env | rg AI_GATEWAY_API_KEY
  scripts/voyage-env.sh start 8082
  scripts/voyage-env.sh ios 8082 "iPhone 17 Pro"
EOF
}

ensure_doppler_auth() {
  if ! doppler me --json >/dev/null 2>&1; then
    echo "doppler is installed but not authenticated for this shell." >&2
    exit 1
  fi
}

ensure_doppler_project() {
  if ! doppler configs --json >/dev/null 2>&1; then
    echo "doppler is authenticated, but no project/config is selected for this repo." >&2
    echo "Run: doppler setup --project <project> --config <config>" >&2
    exit 1
  fi
}

check_secrets() {
  ensure_doppler_auth
  ensure_doppler_project

  local json
  json="$(doppler secrets download --no-file --format json)"

  node - "$json" <<'EOF'
const secrets = JSON.parse(process.argv[2]);
const required = ['AI_GATEWAY_API_KEY', 'DUFFEL_ACCESS_TOKEN'];
const optional = ['EXPO_PUBLIC_API_BASE_URL'];

const missingRequired = required.filter((key) => {
  const value = secrets[key];
  return typeof value !== 'string' || value.trim() === '';
});

const missingOptional = optional.filter((key) => {
  const value = secrets[key];
  return typeof value !== 'string' || value.trim() === '';
});

if (missingRequired.length) {
  console.error(`Missing required Doppler secrets: ${missingRequired.join(', ')}`);
  process.exit(1);
}

if (missingOptional.length) {
  console.warn(`Missing optional Doppler secrets: ${missingOptional.join(', ')}`);
}

console.log('Doppler access looks good for Voyage.');
console.log(`Required secrets present: ${required.join(', ')}`);
if (!missingOptional.length) {
  console.log(`Optional secrets present: ${optional.join(', ')}`);
}
EOF
}

run_with_doppler() {
  ensure_doppler_auth
  ensure_doppler_project
  doppler run -- "$@"
}

subcommand="${1:-}"

case "$subcommand" in
  check)
    check_secrets
    ;;
  run)
    shift
    if [ "$#" -eq 0 ]; then
      usage
      exit 1
    fi
    run_with_doppler "$@"
    ;;
  start)
    port="${2:-8082}"
    run_with_doppler npx expo start --dev-client --port "$port"
    ;;
  ios)
    port="${2:-8082}"
    device="${3:-}"
    if [ -n "$device" ]; then
      run_with_doppler npx expo run:ios --port "$port" --device "$device"
    else
      run_with_doppler npx expo run:ios --port "$port"
    fi
    ;;
  ""|-h|--help|help)
    usage
    ;;
  *)
    echo "Unknown subcommand: $subcommand" >&2
    usage
    exit 1
    ;;
esac
