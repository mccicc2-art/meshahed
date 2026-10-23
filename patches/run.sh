#!/bin/bash
# Release R84 — payload: patches/r84-part-* = base64 of xz(git diff r83..r84), base f44dcf0
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
cat "$D"/r84-part-* | tr -d '\n' | base64 -d | xz -d > /tmp/r84.diff
echo "2dc77c8a0f05a877117b4be6da313e943feabdf53aa87c30169f69abe3827a52  /tmp/r84.diff" | sha256sum -c -
git apply --binary /tmp/r84.diff
