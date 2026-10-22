#!/bin/bash
# Release R79 — payload: patches/r79-part-* = base64 of xz(git diff r78..r79), base ffc9b34
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
cat "$D"/r79-part-* | tr -d '\n' | base64 -d | xz -d > /tmp/r79.diff
echo "ad755cbbc2a38f2f739713ca1f2b3c62e15e15c7c55a7e64445d910c11fc9ce2  /tmp/r79.diff" | sha256sum -c -
git apply --binary /tmp/r79.diff
