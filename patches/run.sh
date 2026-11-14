#!/bin/bash
# Release R228 (registry release 225): tasks 383 + 384 — the combined diff, xz + base64 in parts, sha256-checked before applying
set -euo pipefail
D=$(dirname "$0")
cat "$D"/r228-part-* | tr -d '\n' | base64 -d | xz -d > /tmp/r228.diff
echo "19753fa9318c6c435a4300cd1451f5ec9276617c37f14003dd9d32fe733d7fe9  /tmp/r228.diff" | sha256sum -c -
git apply --binary --whitespace=nowarn /tmp/r228.diff
