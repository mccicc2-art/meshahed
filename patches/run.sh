#!/bin/bash
# Release R88 — payload: patches/r88-part-* = base64 of xz(git diff r87..r88), base 64fe3ec
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
cat "$D"/r88-part-* | tr -d '\n' | base64 -d | xz -d > /tmp/r88.diff
echo "3775476350f30ce887929435bdceab127bd6240c1383a1439eaddad72128f5f7  /tmp/r88.diff" | sha256sum -c -
git apply --binary /tmp/r88.diff
