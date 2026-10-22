#!/bin/bash
# Release R77 — payload: patches/r77-part-* = base64 of xz(git diff r76..r77), base 154ab01
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
cat "$D"/r77-part-* | tr -d '\n' | base64 -d | xz -d > /tmp/r77.diff
echo "91bbb2a61e6087f5fb75a359317af832ddf965cc5b342092d91c6cd8ee8625e9  /tmp/r77.diff" | sha256sum -c -
git apply --binary /tmp/r77.diff
