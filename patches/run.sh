#!/usr/bin/env bash
set -euo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cat "$D"/part-* | base64 -d | xz -d > /tmp/d.patch
echo "e3d0599cfb489c5c32d87413319f04c576c6bb66a37ce8f999a75b7925eec5fc  /tmp/d.patch" | sha256sum -c -
git apply --binary --whitespace=nowarn /tmp/d.patch
