#!/bin/bash
# Release R87 — payload: patches/r87-part-* = base64 of xz(git diff r86..r87), base c699626
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
cat "$D"/r87-part-* | tr -d '\n' | base64 -d | xz -d > /tmp/r87.diff
echo "a174ac55b16c65b958f9a7ea03b19aa00f99f79d4525eabfe6c97e282d7b3a2d  /tmp/r87.diff" | sha256sum -c -
git apply --binary /tmp/r87.diff
