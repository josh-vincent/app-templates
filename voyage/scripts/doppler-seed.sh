#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PROJECT="${DOPPLER_PROJECT_OVERRIDE:-voyage}"
CONFIG="${DOPPLER_CONFIG_OVERRIDE:-dev_personal}"

if ! command -v doppler >/dev/null 2>&1; then
  echo "doppler CLI is not installed." >&2
  exit 1
fi

if ! doppler me --json >/dev/null 2>&1; then
  echo "doppler is not authenticated." >&2
  exit 1
fi

required_keys=(
  "AI_GATEWAY_API_KEY"
  "DUFFEL_ACCESS_TOKEN"
)

optional_keys=(
  "EXPO_PUBLIC_API_BASE_URL"
)

missing_required=()

for key in "${required_keys[@]}"; do
  if [ -z "${!key:-}" ]; then
    missing_required+=("$key")
  fi
done

if [ "${#missing_required[@]}" -gt 0 ]; then
  echo "Missing required local env vars: ${missing_required[*]}" >&2
  echo "Export them in your shell, then rerun this script." >&2
  exit 1
fi

for key in "${required_keys[@]}" "${optional_keys[@]}"; do
  value="${!key:-}"
  if [ -n "$value" ]; then
    doppler secrets set "$key=$value" --project "$PROJECT" --config "$CONFIG"
  fi
done

echo "Seeded Doppler project '$PROJECT' config '$CONFIG'."
