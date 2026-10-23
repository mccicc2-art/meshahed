#!/bin/bash
# Release R90 — payload: patches/r90-part-* = base64 of xz(git diff r89..r90), base c21f0e3
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
cat "$D"/r90-part-* | tr -d '\n' | base64 -d | xz -d > /tmp/r90.diff
echo "aa3f3eed56865f12e4468e9c1304d6f2a47b60cc2198a8e74bd7264476cac34e  /tmp/r90.diff" | sha256sum -c -
git apply --binary /tmp/r90.diff
