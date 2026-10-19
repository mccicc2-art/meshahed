#!/usr/bin/env bash
# Release: task 105 (supabase/213_advisor_hardening.sql, already applied on production) +
# task 106 (D-1478 guest counters, src/lib/data.ts). Diff generated against main 4bbee1e.
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
base64 -d "$D/payload.b64" | xz -d > /tmp/r.diff
echo "7f851bd3b210d850ea768cb0f2fd082a07b164ddf721b8a518a50cb4bd4484fe  /tmp/r.diff" | sha256sum -c -
git apply --index /tmp/r.diff
