import React, { useState } from "react";
import { TextInput, View } from "react-native";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { radius } from "../theme";
import { Sheet } from "../library/Sheet";
import { REPLY_MAX } from "@/core/communityActs";

/**
 * ====== صندوقُ الردّ الأصليّ الواحد — نسخةُ `Composer.tsx` (الويب) · Phase 11-M · M2 ======
 *
 * 🔑 **حقلٌ واحدٌ لكلِّ ردٍّ في التطبيق** (خطّة 11-M §٥، القاعدة ٣): يولد هنا لتعليق البطاقة في «مجتمعي» (`RowComment`
 * و`NewsComment`)، **ويُكمَّل في M3 بالصورة والـGIF و«فيها حرق»** ليصير حقلَ النقاش نفسَه — لا صندوقَ ثانٍ.
 * الحدُّ حدُّ الفعل (ألفُ حرف)، و«أرسل» معطّلٌ على الفراغ (`ready` في الويب)، والحقلُ يتّجه من نصّه (`dir="auto"`).
 *
 * ⚖️ **منبثقٌ في الوسط لا مفتوحٌ في مكانه** — الويبُ يفتح الصندوقَ تحت الصفّ (D-227: «في نفس المكان»)، **والنيّةُ
 * نفسُها محفوظة هنا**: لا صفحةَ تُفتح ولا يضيع موضعُ القراءة. أمّا حقلٌ داخل قائمةٍ افتراضيّة فتغطّيه لوحةُ المفاتيح
 * ويُعاد تدويرُه مع التمرير — **والورقةُ الوسطى هي موضعُ «كتابة تعليق» بكلمة أحمد (D-1032)**، ولوحةُ المفاتيح فيها
 * محلولةٌ مرّةً (D-1005).
 */
export function Composer({
  title,
  hint,
  onSend,
  onClose,
}: {
  title: string;
  /** سطرٌ فوق الحقل يقول لمن الردّ — `hint` في الويب */
  hint?: string;
  /** يعيد `true` إن أُرسل فتُغلق الورقة؛ والفشلُ يُبقيها بنصّها (رسالتُه عند المستدعي) */
  onSend: (body: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const { t, tokens } = useApp();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const ready = body.trim().length > 0;
  const send = async () => {
    if (!ready || busy) return;
    setBusy(true);
    const ok = await onSend(body.trim());
    setBusy(false);
    if (ok) onClose();
  };
  return (
    <Sheet title={title} onClose={onClose} placement="center">
      <View style={{ gap: 12 }}>
        {hint ? <Text size={12} muted numberOfLines={1}>{hint}</Text> : null}
        <TextInput
          value={body}
          onChangeText={(v) => setBody(v.slice(0, REPLY_MAX))}
          multiline
          autoFocus
          maxLength={REPLY_MAX}
          placeholder={t.shareReplyPlaceholder}
          placeholderTextColor={tokens.muted}
          accessibilityLabel={t.shareReplyPlaceholder}
          textAlignVertical="top"
          style={{ minHeight: 3 * 22 + 24, maxHeight: 6 * 22 + 24, borderRadius: radius.control, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface2, padding: 12, fontSize: 15, lineHeight: 22, color: tokens.fg, textAlign: "left" }}
        />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Button label={t.cancelLabel} variant="ghost" onPress={onClose} />
          <Button label={t.shareReplySend} busy={busy} disabled={!ready} style={{ flex: 1 }} onPress={() => void send()} />
        </View>
      </View>
    </Sheet>
  );
}
