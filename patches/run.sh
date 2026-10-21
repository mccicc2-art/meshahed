#!/usr/bin/env bash
# D-1500 · task 144 — widget XL (iOS 27) + page arrows + Spotlight search (الرقعةُ في أجزاء r144.b64.*)
set -euo pipefail
cat /tmp/p/patches/r144.b64.* | base64 -d > /tmp/d.xz
xz -d -c /tmp/d.xz > /tmp/d.diff
echo "012c65514174f632dc5b8ec90e3d815e5e0f370abc4dc0524b14469cfb0d0b5b  /tmp/d.diff" | sha256sum -c -
git apply --binary /tmp/d.diff
