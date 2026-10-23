#!/bin/bash
# Release R82 — payload: patches/r82-part-* = base64 of xz(git diff r81..r82), base e3beb3c
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
cat "$D"/r82-part-* | tr -d '\n' | base64 -d | xz -d > /tmp/r82.diff
echo "8e26da1b807e6b1977e397a6a346418b79413f4c474acbbbfc9116eecfe147e3  /tmp/r82.diff" | sha256sum -c -
git apply --binary /tmp/r82.diff
