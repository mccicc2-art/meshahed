#!/bin/bash
# Release R89 — payload: patches/r89-part-* = base64 of xz(git diff r88..r89), base 985c10d
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
cat "$D"/r89-part-* | tr -d '\n' | base64 -d | xz -d > /tmp/r89.diff
echo "526c60f2d767adf5646626f2ee2f398277fe9b3fe3c8fd23b731f4e17d4605e0  /tmp/r89.diff" | sha256sum -c -
git apply --binary /tmp/r89.diff
