import React from "react";
import { View } from "react-native";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Sheet } from "../library/Sheet";
import { MSG_UNSEND_WINDOW_MS } from "@/core/contracts/messages";
import type { MsgDeleteBody, MsgDeletePayload } from "../contracts";
import { write } from "../api";

/**
 * ====== 🆕 D-1441 — «حذف» من شريط التحديد — ورقةٌ واحدةٌ للخاص والقروب ======
 *
 * أحمد ١٦ أكتوبر: «أحتاج أقدر أحذف محادثة أو رسالة داخل محادثة أنا راسلها» — «١ ب»: «حذف للجميع» خلال مهلة، كالواتس.
 * - «حذف للجميع» يظهر حين تكون المحدَّدةُ كلُّها رسائلي وفي المهلة (ساعتان) — الفحصُ الحقيقيُّ في القاعدة (`message_unsend`)،
 *   وهذا لإخفاء خيارٍ سيُرفض فقط.
 * - «حذف عندي» دائماً — يختفي من عندي وحدي.
 * ورقةٌ وسطى كتأكيد الحظر: الحذفُ لا يُتراجع عنه بضغطة.
 */
export function canUnsend(items: { mine: boolean; created_at: string }[], now = Date.now()): boolean {
  return items.length > 0 && items.every((e) => e.mine && now - Date.parse(e.created_at) < MSG_UNSEND_WINDOW_MS);
}

export function DeleteSheet({ count, canAll, onMe, onAll, onClose }: { count: number; canAll: boolean; onMe: () => void; onAll: () => void; onClose: () => void }) {
  const { t } = useApp();
  return (
    <Sheet title={t.msgDeleteTitle(count)} onClose={onClose} placement="center">
      {canAll ? <Text size={13} muted style={{ lineHeight: 20, marginBottom: 14 }}>{t.msgDeleteForAllHint}</Text> : null}
      <View style={{ gap: 10 }}>
        {canAll ? <Button label={t.msgDeleteForAll} variant="danger" onPress={onAll} /> : null}
        <Button label={t.msgDeleteForMe} variant={canAll ? "ghost" : "danger"} onPress={onMe} />
        <Button label={t.cancelLabel} variant="ghost" onPress={onClose} />
      </View>
    </Sheet>
  );
}

/** النداءُ الواحد — ما رفضته القاعدةُ يعود في `refused` فيبقى في الشاشة */
export async function deleteRemote(body: MsgDeleteBody): Promise<MsgDeletePayload> {
  return (await write<MsgDeletePayload>("/api/v1/me/messages/delete", body)) as MsgDeletePayload;
}
