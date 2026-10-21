import React, { useState } from "react";
import { Platform, TextInput, View } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { write, ApiError } from "../api";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { radius } from "../theme";
import { haptic } from "../haptics";
import { SYSTEM_FONT_CAP } from "../fontScale";
import { BUILD_TAG } from "../ota";
import { Sheet } from "../library/Sheet";
import { Segmented } from "../library/ToolsSheet";
import { FEEDBACK_MAX, feedbackReady, type FeedbackBody, type FeedbackKind } from "@/core/contracts/feedback";

/**
 * ====== «أرسل مشكلة أو اقتراح» — التطبيق (D-1499) ======
 *
 * أحمد (٢١ أكتوبر): «نبي مكان يقدر الشخص يكتب مشكلة او اقتراح ويرفعها بشكل سريع». لمستان وجملة:
 * النوعُ (المقسّمُ الواحد `Segmented`) والنصّ ثمّ «إرسال» — في الورقة الواحدة (`Sheet`) بألوان الثيم
 * الملبوس كلِّها (`tokens`) لا بلونٍ مكتوب. ويُرفق ما يعيد المشكلةَ دون أن يكتبه أحد: المنصّةُ والنسخةُ
 * (`BUILD_TAG` = الإصدار + التحديث الجاري) والجهاز. البريدُ باقٍ في «المساعدة» لمن يرفق ملفّاً («ب»).
 */
function deviceLabel(): string {
  const c = Platform.constants as unknown as { Brand?: string; Model?: string };
  return Platform.OS === "android"
    ? [c.Brand, c.Model, `Android ${Platform.Version}`].filter(Boolean).join(" · ")
    : `iOS ${Platform.Version}`;
}

export function FeedbackSheet({ onClose, onSent }: { onClose: () => void; onSent: (text: string) => void }) {
  const { t, tokens } = useApp();
  const [kind, setKind] = useState<FeedbackKind>("bug");
  const [body, setBody] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const ready = feedbackReady(body);
  const send = useMutation({
    mutationFn: () =>
      write<{ ok: true }>("/api/v1/feedback", {
        kind,
        body: body.trim(),
        platform: Platform.OS === "ios" ? "ios" : "android",
        appVersion: BUILD_TAG,
        device: deviceLabel(),
        screen: "settings",
      } satisfies FeedbackBody),
    onSuccess: () => {
      haptic.success();
      onSent(t.fbSent);
      onClose();
    },
    /* الفشلُ يُقال داخل الورقة لا في مضيف الشاشة (الورقةُ فوقه فيُحجب)، والنصُّ يبقى في الحقل: لا يُعاد كتابةُ ما كُتب */
    onError: (e) => setErr(e instanceof ApiError && e.error.code === "rate_limited" ? t.fbRateLimited : t.fbFailed),
  });
  return (
    <Sheet title={t.fbTitle} onClose={onClose}>
      <Segmented
        items={[
          { id: "bug", label: t.fbKindBug },
          { id: "idea", label: t.fbKindIdea },
        ]}
        value={kind}
        onChange={(v) => setKind(v === "idea" ? "idea" : "bug")}
      />
      <View>
        <TextInput
          maxFontSizeMultiplier={SYSTEM_FONT_CAP}
          autoFocus
          multiline
          value={body}
          onChangeText={setBody}
          maxLength={FEEDBACK_MAX}
          placeholder={kind === "bug" ? t.fbPlaceholderBug : t.fbPlaceholderIdea}
          placeholderTextColor={tokens.muted}
          textAlignVertical="top"
          accessibilityLabel={t.fbTitle}
          style={{ minHeight: 140, maxHeight: 220, borderRadius: radius.control, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface2, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: tokens.fg, textAlign: "auto" }}
        />
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, marginTop: 6, paddingHorizontal: 2 }}>
          <Text size={12} muted style={{ flexShrink: 1 }}>{t.fbAuto}</Text>
          <Text size={12} muted>{`${body.length} / ${FEEDBACK_MAX}`}</Text>
        </View>
      </View>
      <Button label={t.fbSend} disabled={!ready} busy={send.isPending} onPress={() => { setErr(null); send.mutate(); }} />
      {err ? <Text size={13} weight="600" color={tokens.error} style={{ textAlign: "center", marginTop: -8 }}>{err}</Text> : null}
    </Sheet>
  );
}
