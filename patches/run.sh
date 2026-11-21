#!/usr/bin/env bash
# Release R277 (T499): base64 parts sit next to this script; sha256-checked before applying
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
cat "$D"/r277-part-*.b64 | tr -d '\n' | base64 -d | xz -d > /tmp/d.patch
echo "f3abfc034e0f6260541db8d4a2b9c3238e761d1102d72b9a2d1ef67c63eb3b68  /tmp/d.patch" | sha256sum -c -
git apply --binary --whitespace=nowarn /tmp/d.patch
echo APPLY_OK
