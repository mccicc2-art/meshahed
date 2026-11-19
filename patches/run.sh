#!/usr/bin/env bash
# Release R247 (T451): base64 part sits next to this script; sha256-checked before applying
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
cat "$D"/r247-part-*.b64 | base64 -d | xz -d > /tmp/d.patch
echo "7749008fba070f82111e97f8c1fc629f5cc46f233c29724c3dc9df58284a57f3  /tmp/d.patch" | sha256sum -c -
git apply --binary --whitespace=nowarn /tmp/d.patch
echo APPLY_OK
