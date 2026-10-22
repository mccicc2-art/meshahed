#!/bin/bash
# Release R68 — payload in parts: patches/r68-part-* = base64 of xz(git diff c5d2098..r68), base c5d2098
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
cat "$D"/r68-part-* | tr -d '\n' | base64 -d | xz -d > /tmp/r68.diff
echo "616c64d8cba4b21e46fd2840bf5fbfe0be6b844ceefd092f224a067734cfcb41  /tmp/r68.diff" | sha256sum -c -
git apply --binary /tmp/r68.diff
