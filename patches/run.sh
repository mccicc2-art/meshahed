#!/usr/bin/env bash
# D-1505 · task 205 — side drawer + watch history phase 2
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
cat "$D"/r102.b64.* | tr -d '\n' | base64 -d | xz -d -c > /tmp/d.diff
echo "a3a5e3a1536e94ae12a5416ec3b3df4fd770e469e5f133f54fa33a0e361d3c8a  /tmp/d.diff" | sha256sum -c -
git apply --binary /tmp/d.diff
