#!/usr/bin/env bash
# Release R28 - task 101 (D-1474). The format-patch travels xz+base64 in parts behind a sha256 guard.
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
cat "$D"/part-*.b64 | tr -d '\n' | base64 -d | xz -d > /tmp/r28.patch
echo "b25a598e18bd068d35830e873d2ce396e199c29096d20b0157c5a4cb761e0189  /tmp/r28.patch" | sha256sum -c -
git -c user.name=Claude -c user.email=noreply@anthropic.com am -3 /tmp/r28.patch
