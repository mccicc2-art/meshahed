#!/usr/bin/env bash
# Release R283 (registry release 283): T516, T517, T518 as git format-patch -k mbox
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
cat "$D/r283-part-0.b64" "$D/r283-part-1.b64" | tr -d '\n' | base64 -d | xz -d > /tmp/r283.mbox
echo "3270f96fbc9b1c9f0278803c18c263f5c792e66cb0994e7e7c8de3bb230ee1f8  /tmp/r283.mbox" | sha256sum -c -
git -c user.name=Claude -c user.email=noreply@anthropic.com am -3 -k /tmp/r283.mbox
git log --oneline -4
