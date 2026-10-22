#!/bin/bash
# Release R78 — payload: patches/r78-part-* = base64 of xz(git diff r77..r78), base 5dad4d2
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
cat "$D"/r78-part-* | tr -d '\n' | base64 -d | xz -d > /tmp/r78.diff
echo "ac89a68dd7e8b444e9612a0f926f75404f5958f0dbcafbd2a2d30d9541d998ac  /tmp/r78.diff" | sha256sum -c -
git apply --binary /tmp/r78.diff
