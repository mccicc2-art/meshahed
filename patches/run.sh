#!/usr/bin/env bash
# Release R253 (registry release 253) - tasks 457, 463, 464, 466. Patch made against main 07396c3; every part and the patch are sha256-checked.
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"
cd "$D"
echo "f530bc8d6f211e71d2c26855db43a8147b8d3239c36e720adfa4232bd533e8f6  r253-part-0" | sha256sum -c -
echo "87b62edefdee74781fb2602fe6f9090c3f5a5feee0ac7860c2e50b7f3a046bcc  r253-part-1" | sha256sum -c -
echo "e28239ed1347de03f0c40c10e59adb00ff1e5b50642fd7732d610688bead53cd  r253-part-2" | sha256sum -c -
echo "820fc86ba6dde20501821981a1bb76c5aac511550303fc5661e9906b69636e25  r253-part-3" | sha256sum -c -
cat r253-part-0 r253-part-1 r253-part-2 r253-part-3 | base64 -d | xz -d > /tmp/r253.patch
echo "747ff3cbf93c98b7596534d96f9a6f875ad63c45485ede7b6515705c297ce21a  /tmp/r253.patch" | sha256sum -c -
cd "$GITHUB_WORKSPACE"
git apply --binary /tmp/r253.patch
