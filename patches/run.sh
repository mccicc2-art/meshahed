#!/bin/bash
# Release R69 — payload: patches/r69-part-* = base64 of xz(git diff r68..r69), base ef6d1b6
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
cat "$D"/r69-part-* | tr -d '\n' | base64 -d | xz -d > /tmp/r69.diff
echo "490d927415c128e7b17339aeeb9804b97319b4fbc4c1db955ee2e626956ce689  /tmp/r69.diff" | sha256sum -c -
git apply --binary /tmp/r69.diff
