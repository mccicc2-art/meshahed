#!/usr/bin/env bash
# Release R244 (T440 + T443): base64 parts sit next to this script; sha256-checked before applying
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
cat "$D"/r244-part-*.b64 | base64 -d | xz -d > /tmp/d.patch
echo "11cceadbd4ededeec39ce4013f83a043ba19f7c6d0aa22972366810f5520e7b1  /tmp/d.patch" | sha256sum -c -
git apply --binary --whitespace=nowarn /tmp/d.patch
echo APPLY_OK
