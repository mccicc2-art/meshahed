#!/bin/bash
# Release R67 — payload in parts: patches/r67-part-* = base64 of xz(git diff origin/main..r67), base 218b1d6
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
cat "$D"/r67-part-* | tr -d '\n' | base64 -d | xz -d > /tmp/r67.diff
echo "3cff343774d8add568c5a2ce9bb7b87eb6bb9ae6d32dd5caf04d3405e98b1bc2  /tmp/r67.diff" | sha256sum -c -
git apply --binary /tmp/r67.diff
