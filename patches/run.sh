#!/usr/bin/env bash
# Release R290 — fixer tasks 527 (A-77) + 528 (A-78). Applies the combined zero-context diff to main.
set -euo pipefail
P="$(cd "$(dirname "$0")" && pwd)"
cat "$P"/r290-part-* | tr -d '\n' | base64 -d | xz -d > /tmp/r290.diff
echo "dd2cee6aa01466b194e1c41994180aa1b23e2bdd8e612708a4308ed35d59759c  /tmp/r290.diff" | sha256sum -c -
git apply --binary --unidiff-zero -C0 /tmp/r290.diff
git status --short
