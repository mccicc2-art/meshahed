#!/usr/bin/env bash
set -euo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cat "$D"/part-* | base64 -d | xz -d > /tmp/d.patch
echo "cf426c6dce66c71c842056dbc1d41593003bd3cc09ffbb7539116e9f8c797362  /tmp/d.patch" | sha256sum -c -
git apply --binary --whitespace=nowarn /tmp/d.patch
