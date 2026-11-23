#!/usr/bin/env bash
# Release R294 (registry release 294): T535 as git format-patch -k mbox
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
cat "$D/r294-part-0.b64" "$D/r294-part-1.b64" "$D/r294-part-2.b64" | tr -d '\n' | base64 -d | xz -d > /tmp/r294.mbox
echo "056253849b3e65c3e17c6c78910dffce56cd3e3e5ad6d55a1de6b3cc8ce2d094  /tmp/r294.mbox" | sha256sum -c -
git -c user.name=Claude -c user.email=noreply@anthropic.com am -3 -k /tmp/r294.mbox
git log --oneline -3
