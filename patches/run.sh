#!/bin/bash
# Release R74 — payload: patches/r74-part-* = base64 of xz(git diff r73..r74), base 0c17528
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
cat "$D"/r74-part-* | tr -d '\n' | base64 -d | xz -d > /tmp/r74.diff
echo "76709d606385e16320425f91c25feeeae9d772bb0906103de201a99831ad4ec2  /tmp/r74.diff" | sha256sum -c -
git apply --binary /tmp/r74.diff
