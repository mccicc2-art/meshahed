import React, { useState } from "react";
import { View } from "react-native";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Sheet } from "../library/Sheet";
import { deviceName } from "./api";
import type { DeviceKind } from "@/core/contracts/deviceLinks";

/**
 * 🆕 **تأكيدُ الفكّ الواحد** (خطّةُ Loopz+ v2: «فكُّ الربط يُؤكَّد: الـN عملاً تبقى في مكتبتك، ويتوقف تسجيل الجديد، وتنفتح خانة»).
 * من الضغط المطوَّل في المدار ومن «ألغِ الربط» في صفحة الجهاز — ورقةٌ واحدةٌ لا اثنتان (القاعدة ٣).
 */
/* 🆕 `name` — منصّةُ بثٍّ (نتفليكس، هجرة ٢٦٥) بالورقة نفسِها: اسمُ منتجٍ لا جهاز */
export function UnlinkSheet({ kind, name, works, onClose, onConfirm }: { kind?: DeviceKind; name?: string; works: number; onClose: () => void; onConfirm: () => Promise<void> }) {
  const { t } = useApp();
  const [busy, setBusy] = useState(false);
  return (
    <Sheet title={t.linksUnlink} onClose={onClose} placement="center">
      <View style={{ gap: 14 }}>
        <Text size={14} style={{ lineHeight: 22 }}>{t.linksUnlinkConfirm(name ?? (kind ? deviceName(kind) : ""), works)}</Text>
        <Button
          label={t.linksUnlink}
          variant="danger"
          busy={busy}
          onPress={() => {
            setBusy(true);
            void onConfirm().finally(() => setBusy(false));
          }}
        />
      </View>
    </Sheet>
  );
}
