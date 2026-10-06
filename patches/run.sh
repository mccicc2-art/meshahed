#!/usr/bin/env bash
set -euo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cat "$D"/part-* | base64 -d | xz -d > /tmp/d.patch
echo "d06d6a2c51a4100d5f40ec07320263ab18d873a2fb3d3dc387b5046d6bdfab4a  /tmp/d.patch" | sha256sum -c -
git apply --binary --whitespace=nowarn /tmp/d.patch
