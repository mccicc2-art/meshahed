#!/bin/bash
# Release R71 — payload: patches/r71-part-* = base64 of xz(git diff r70..r71), base 6ffd6ab
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
cat "$D"/r71-part-* | tr -d '\n' | base64 -d | xz -d > /tmp/r71.diff
echo "84bc7aed1b5289819796b68e03dbf7ed052f80bbaa3deecfdb87872a432eb78b  /tmp/r71.diff" | sha256sum -c -
git apply --binary /tmp/r71.diff
