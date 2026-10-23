#!/bin/bash
# Release R85 — payload: patches/r85-part-* = base64 of xz(git diff r84..r85), base 99f1fbe
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
cat "$D"/r85-part-* | tr -d '\n' | base64 -d | xz -d > /tmp/r85.diff
echo "cb1f6ce736c342f438d581f41de9e1a137ec9380da46611108e36739f16a885e  /tmp/r85.diff" | sha256sum -c -
git apply --binary /tmp/r85.diff
