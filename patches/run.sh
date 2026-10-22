#!/bin/bash
# Release R70 — payload: patches/r70-part-* = base64 of xz(git diff r69..r70), base 47a32b4
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
cat "$D"/r70-part-* | tr -d '\n' | base64 -d | xz -d > /tmp/r70.diff
echo "3d310be32aa7e977ca7a051b3e7037eb3c045dd95b4b520378d0c83198ab4242  /tmp/r70.diff" | sha256sum -c -
git apply --binary /tmp/r70.diff
