#!/bin/bash
# Release R76 — payload: patches/r76-part-* = base64 of xz(git diff r75..r76), base db7cbfb
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
cat "$D"/r76-part-* | tr -d '\n' | base64 -d | xz -d > /tmp/r76.diff
echo "b11ecfec81b93e03a76c2e0f5d77640b77d689bd1b499ae365d70bf7572365bd  /tmp/r76.diff" | sha256sum -c -
git apply --binary /tmp/r76.diff
