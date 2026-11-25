#!/usr/bin/env bash
# R310 — T554 (Nuvio as its own device + add-on icon under /api/v1). الرقعةُ مضغوطةً بـbase64 في أجزاء (نصٌّ لا يُفسده النقل)،
# تُفكّ وتُفحص بصمتُها قبل التطبيق، ثمّ تُطبَّق على main والمسارُ يلتزم بـmessage.txt ([deploy]).
set -euo pipefail
P=/tmp/p/patches
cat "$P"/r310-part-* | base64 -d | xz -d > /tmp/r310.patch
echo "63c788f1c8286f6c591ce3370760244e4421d48d4797e47c052eeadc7edc55bf  /tmp/r310.patch" | sha256sum -c -
git apply --index /tmp/r310.patch
git status --short | head -50
