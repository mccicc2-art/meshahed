#!/bin/bash
# Release R80 — payload: patches/r80-part-* = base64 of xz(git diff r79..r80), base 66c3de6
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
cat "$D"/r80-part-* | tr -d '\n' | base64 -d | xz -d > /tmp/r80.diff
echo "2f7b15cf2db115c6a5c836d4bd8a466294b0d83266895e9df2fea6598a48c12e  /tmp/r80.diff" | sha256sum -c -
git apply --binary /tmp/r80.diff
