#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="$ROOT/scripts/loadtests/k6-full-app.js"

export K6_BASE_URL="${K6_BASE_URL:-https://avolkovshop.ru/api}"
export K6_EMAIL="${K6_EMAIL:-loadtest-k6@example.com}"
export K6_PASSWORD="${K6_PASSWORD:-LoadTest123!}"

echo "Target: $K6_BASE_URL"
echo "User:   $K6_EMAIL"
echo ""

if command -v k6 >/dev/null 2>&1; then
  k6 run "$SCRIPT" "$@"
else
  docker run --rm -i \
    -e K6_BASE_URL -e K6_EMAIL -e K6_PASSWORD \
    -v "$ROOT/scripts/loadtests:/scripts" \
    grafana/k6 run /scripts/k6-full-app.js "$@"
fi
