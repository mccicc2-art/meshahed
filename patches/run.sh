#!/bin/bash
# Release R73 — payload: patches/r73-part-* = base64 of xz(git diff r72..r73), base 5e1fa22
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
cat "$D"/r73-part-* | tr -d '\n' | base64 -d | xz -d > /tmp/r73.diff
echo "466aa299fc999752042573cfee3c6d479df590947c766c085a50587ae5a0e2d2  /tmp/r73.diff" | sha256sum -c -
git apply --binary /tmp/r73.diff
