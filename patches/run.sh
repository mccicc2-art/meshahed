#!/usr/bin/env bash
# D-1493..D-1496 · Release R43 — task 123 (الرقعةُ في أجزاء r43.b64.* لأنّ أداة الدفع تحمل ملفّاً كبيراً بصعوبة)
set -euo pipefail
cat /tmp/p/patches/r43.b64.* | base64 -d > /tmp/d.xz
xz -d -c /tmp/d.xz > /tmp/d.diff
echo "22408998f174873d86cf6aef0c18eebbe34138e8673f369f7f4cfb9f63b14068  /tmp/d.diff" | sha256sum -c -
git apply --binary /tmp/d.diff
