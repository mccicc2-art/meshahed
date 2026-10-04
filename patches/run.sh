#!/usr/bin/env bash
# D-1262 off — رقعةٌ مضغوطة (xz + base64) تُفحص ببصمتها قبل التطبيق
set -euo pipefail
base64 -d > /tmp/d1262off.diff.xz <<'B64'
/Td6WFoAAATm1rRGAgAhARwAAAAQz1jM4AJ7AYtdADIaSQnC/BF9UN4KT0fZJMXh0LepCE1uUEEo
KpnvIyPZMNeKsdFSDMVlZOxz4EKf6eLLIUWNb2vUUk7tqItoA8O63Tixza+38c4Qv+bkrd5scNJB
oxIbPVHSfCj8YYFC6xQUX6RaLullFwR+k2gSOqyr33RLU5AMxqr1SivWGZm2fixxOesLCi6Shm0Y
MzVU60Kjbo5F4VUzDsXmm6Tw9p5tdGAIBL3Cn2zrsRkux3Udr+4ppIN24yueymPp1uyOowWxoew1
IEcR6JyNsvKIbuewVCRi2yieD2ovrMoVYxxLqhwMngmEJbRTybxawBfGWRhp/2uSd1qtciIQS0IU
6MYNsKt0U9/xitla1/7TWWSEhMR2vaxcMbaEK3l0UiWcDGLNh3ojz2N+JTfhk0iOIHsc2ZyHX9XX
1mtk/TS0m5mwFSz3ZxNL+50Wua5RSwdHQ/oCP3MejtQKU/jAx/0XEVK9KOABjTnaoM0JFjte4HZm
Bnzs3aqWG/k8Ss6+qogDahNCd5SZkHUBVeIzAABGLBuyt5o6+gABpwP8BAAAmI5VS7HEZ/sCAAAA
AARZWg==
B64
xz -d -f /tmp/d1262off.diff.xz
echo "24581ed432faeb4535c037e1c938d05014b746406ff4c75aedb0fbe79e03e07a  /tmp/d1262off.diff" | sha256sum -c -
git apply --whitespace=nowarn /tmp/d1262off.diff
