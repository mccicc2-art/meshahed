#!/usr/bin/env bash
set -euo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cat "$D"/part-* | base64 -d | xz -d > /tmp/d.patch
echo "639d5c0ec260862700679c454047c01b8eff252be2a9a78f0a67afd9c47e87e4  /tmp/d.patch" | sha256sum -c -
git apply --binary --whitespace=nowarn /tmp/d.patch
