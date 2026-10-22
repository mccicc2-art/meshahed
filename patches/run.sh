#!/bin/bash
# Release R75 — payload: patches/r75-part-* = base64 of xz(git diff r74..r75), base b051880
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
cat "$D"/r75-part-* | tr -d '\n' | base64 -d | xz -d > /tmp/r75.diff
echo "6876b54be0cc76338d6d10bc9a524a9c41da02ed058a57995410f15f345deef8  /tmp/r75.diff" | sha256sum -c -
git apply --binary /tmp/r75.diff
