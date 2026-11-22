#!/usr/bin/env bash
# Release R286 (registry release 286): T521, T522 as git format-patch -k mbox
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
cat "$D/r286-part-0.b64" "$D/r286-part-1.b64" | tr -d '\n' | base64 -d | xz -d > /tmp/r286.mbox
echo "bb85888c2b94a6f217942fcac9bf9bfa68bb95d1f06886de096adaaf731a0cb2  /tmp/r286.mbox" | sha256sum -c -
git -c user.name=Claude -c user.email=noreply@anthropic.com am -3 -k /tmp/r286.mbox
git log --oneline -3
