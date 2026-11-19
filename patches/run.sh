#!/usr/bin/env bash
# Release R268 (T482): base64 parts sit next to this script; sha256-checked before applying
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
cat "$D"/r268-part-*.b64 | tr -d '\n' | base64 -d | xz -d > /tmp/d.patch
echo "32ce3208edca7e2cbb3bea1be8814aada5411aa7530d56d1d69c14c1f261d7ec  /tmp/d.patch" | sha256sum -c -
git apply --binary --whitespace=nowarn /tmp/d.patch
echo APPLY_OK
