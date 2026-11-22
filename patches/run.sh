#!/usr/bin/env bash
# Release R284 (registry release 284): T519, T520 as git format-patch -k mbox
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
tr -d '\n' < "$D/r284-part-0.b64" | base64 -d | xz -d > /tmp/r284.mbox
echo "7a9885023d6b128a108147562d39922b3b15302bd523e6b09ac90d122f0b6795  /tmp/r284.mbox" | sha256sum -c -
git -c user.name=Claude -c user.email=noreply@anthropic.com am -3 -k /tmp/r284.mbox
git log --oneline -3
