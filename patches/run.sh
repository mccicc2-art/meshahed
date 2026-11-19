#!/usr/bin/env bash
# Release R246 (T442): base64 part sits next to this script; sha256-checked before applying
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
cat "$D"/r246-part-*.b64 | base64 -d | xz -d > /tmp/d.patch
echo "6d28c005ba80bb1347cc7b44a1a7f6cb768c22e1d1960c2d63d7f34afdf04c49  /tmp/d.patch" | sha256sum -c -
git apply --binary --whitespace=nowarn /tmp/d.patch
echo APPLY_OK
