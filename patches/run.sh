#!/bin/bash
# Release R86 — payload: patches/r86-part-* = base64 of xz(git diff r85..r86), base 656666d
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
cat "$D"/r86-part-* | tr -d '\n' | base64 -d | xz -d > /tmp/r86.diff
echo "f0da430192f82bb64df958f4a67ece50461ad84acee732f62cdd048a86d15f0d  /tmp/r86.diff" | sha256sum -c -
git apply --binary /tmp/r86.diff
