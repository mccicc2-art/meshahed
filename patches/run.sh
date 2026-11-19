#!/usr/bin/env bash
# Release R269 (T483): base64 parts sit next to this script; sha256-checked before applying
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
cat "$D"/r269-part-*.b64 | tr -d '\n' | base64 -d | xz -d > /tmp/d.patch
echo "23395ca65bb8836db654d061b571781f7f6f7d0e67a27b49e854dfdb6df04741  /tmp/d.patch" | sha256sum -c -
git apply --binary --whitespace=nowarn /tmp/d.patch
echo APPLY_OK
