#!/usr/bin/env bash
# Release R279 — T504 + T506. Applies the combined zero-context diff to main.
set -euo pipefail
P="$(cd "$(dirname "$0")" && pwd)"
cat "$P"/r279-part-* | tr -d '\n' | base64 -d | xz -d > /tmp/r279.diff
echo "4062e8c33ed011cf9b7003c20c51ac649b424d467a9c91eb27f42e71f5e5307e  /tmp/r279.diff" | sha256sum -c -
git apply --binary --unidiff-zero -C0 /tmp/r279.diff
git status --short
