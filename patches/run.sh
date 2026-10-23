#!/bin/bash
# Release R83 — payload: patches/r83-part-* = base64 of xz(git diff r82..r83), base 36cb1c4
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
cat "$D"/r83-part-* | tr -d '\n' | base64 -d | xz -d > /tmp/r83.diff
echo "6d21f2b78737c0b60c0a0ff929bc4526b406a5bb7e66deeaf5d3fd34ebf756df  /tmp/r83.diff" | sha256sum -c -
git apply --binary /tmp/r83.diff
