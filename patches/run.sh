#!/bin/bash
# Release R72 — payload: patches/r72-part-* = base64 of xz(git diff r71..r72), base f2f8c37
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
cat "$D"/r72-part-* | tr -d '\n' | base64 -d | xz -d > /tmp/r72.diff
echo "51306f7d1d4b0b16df9cc4b4ec72a2c5d77edbc267ddd593fa3239251b2ec97d  /tmp/r72.diff" | sha256sum -c -
git apply --binary /tmp/r72.diff
