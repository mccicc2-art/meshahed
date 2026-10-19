#!/usr/bin/env bash
# Release R27 - task 100 (D-1473). The format-patch travels xz+base64 in four parts behind a sha256 guard.
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
cat "$D"/part-00.b64 "$D"/part-01.b64 "$D"/part-02.b64 "$D"/part-03.b64 | tr -d '\n' | base64 -d | xz -d > /tmp/r27.patch
echo "48219c903b2aa033f1cca2ee85b5b09e490c554d81a6eb922ac77dc18c8472eb  /tmp/r27.patch" | sha256sum -c -
git -c user.name=Claude -c user.email=noreply@anthropic.com am -3 /tmp/r27.patch
