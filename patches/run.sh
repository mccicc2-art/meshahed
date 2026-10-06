#!/usr/bin/env bash
set -euo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cat "$D"/part-* | base64 -d | xz -d > /tmp/d.patch
echo "dc6cb1d46989d9df10aae832e59fba04067d9011fcb58ea56564ca9df49bc07d  /tmp/d.patch" | sha256sum -c -
git apply --binary --whitespace=nowarn /tmp/d.patch
