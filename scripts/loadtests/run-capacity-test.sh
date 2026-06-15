#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RESULTS="$ROOT/scripts/loadtests/results"
mkdir -p "$RESULTS"
rm -f "$RESULTS"/vu*.json

export K6_BASE_URL="${K6_BASE_URL:-https://avolkovshop.ru/api}"
export K6_EMAIL="${K6_EMAIL:-loadtest-k6@example.com}"
export K6_PASSWORD="${K6_PASSWORD:-LoadTest123!}"

run_k6() {
  local vus=$1
  export K6_VUS=$vus
  echo "=== Testing $vus concurrent users ==="
  docker run --rm -i \
    -e K6_BASE_URL -e K6_EMAIL -e K6_PASSWORD -e K6_VUS \
    -v "$ROOT/scripts/loadtests:/scripts" \
    grafana/k6 run /scripts/k6-capacity.js
}

for vus in 5 10 15 20 25 30 35 40 45 50; do
  run_k6 "$vus"
  sleep 5
done

python3 << 'PY'
import json, glob, os

results = []
for path in sorted(glob.glob("scripts/loadtests/results/vu*.json"), key=lambda p: int(p.split("vu")[1].split(".")[0])):
    with open(path) as f:
        results.append(json.load(f))

comfortable = 0
degraded_max = 0

print("\n" + "=" * 72)
print(f"{'VUs':>4} {'p50':>6} {'p95':>6} {'p99':>6} {'fail%':>7} {'5xx%':>6} {'rps':>6}  verdict")
print("-" * 72)

for r in results:
    vus = r["vus"]
    p95 = r["p95_ms"]
    fail = r["failed_rate"] * 100
    e5 = r["errors_5xx_rate"] * 100

    if p95 < 500 and fail < 1 and e5 < 0.1:
        verdict = "OK comfortable"
        comfortable = vus
    elif p95 < 2000 and fail < 5 and e5 < 1:
        verdict = "degraded OK"
        degraded_max = vus
    elif e5 < 5 and fail < 15:
        verdict = "slow"
        degraded_max = max(degraded_max, vus)
    else:
        verdict = "FAIL"

    print(f"{vus:4d} {r['p50_ms']:6d} {p95:6d} {r['p99_ms']:6d} {fail:6.2f}% {e5:5.2f}% {r['rps']:6.1f}  {verdict}")

print("=" * 72)
print(f"Comfortable (p95<500ms, fail<1%):  {comfortable} users")
print(f"Max with delays (p95<2s, 5xx<1%):   {degraded_max} users")
print(f"Absolute last tested level:          {results[-1]['vus'] if results else 0} users")
PY
