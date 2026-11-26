import React, { useState } from "react";
import { TextInput, View } from "react-native";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Sheet } from "../library/Sheet";
import { Segmented } from "../library/ToolsSheet";
import { radius } from "../theme";
import type { ListDetailPayload, ListUpdateBody } from "../contracts";
import { SYSTEM_FONT_CAP } from "../fontScale";

/**
 * ====== ورقةُ تحرير قائمتي — D-1037 (L2) ======
 *
 * **لماذا**: الشريحةُ الأولى (D-1036) أبقت تحريرَ المالك بابَ ويب؛ أحمد سأل «وش يمنع يتحوّل أصليّ؟» —
 * ولا مانع: الدوالُّ الخادميّةُ قائمة. هذه الورقةُ تحمل ما في ورقة `ListDetail` الويبيّة: الاسمُ · النبذةُ ·
 * معلنةٌ/خاصّة · النوع. 🆕 T578 — أبوابُ الترتيب والغلاف والحذف انتقلت إلى ورقة «⋯» (`ListMoreSheet` — ت٣ «أ»).
 *
 * 🔑 **سفليّةٌ لا وسطيّة** (قاعدةُ D-1032): يفتحها صاحبُها بنفسه. **ولا عنصرَ جديداً**: `Sheet` ·
 * `Segmented` (مصدَّرةً من `ToolsSheet` — استخراجٌ لا نسخ) · `Chip` · `Button`؛ وحقلُ النصّ بمقاسات حقل
 * `SmartListSheet`. **ولا نصَّ جديداً**: مفاتيحُ القاموس مفاتيحُ الويب.
 * القائمةُ الذكيّة لا نوعَ لها ولا ترتيب (تمتلئ وحدَها — D-823).
 */
export function ListEditSheet({
  list,
  busy,
  onSave,
  onClose,
}: {
  list: ListDetailPayload;
  busy: boolean;
  onSave: (v: Omit<ListUpdateBody, "listId">) => void;
  onClose: () => void;
}) {
  const { t, tokens } = useApp();
  const [name, setName] = useState(list.name);
  const [subtitle, setSubtitle] = useState(list.subtitle ?? "");
  const [pub, setPub] = useState(list.is_public);
  const [kind, setKind] = useState<"regular" | "ranked" | "watch_order">(list.kind === "ranked" || list.kind === "watch_order" ? list.kind : "regular");
  const field = { minHeight: 44, borderRadius: radius.control, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface2, paddingHorizontal: 12, fontSize: 14, color: tokens.fg } as const;
  const clean = name.trim();

  return (
    <Sheet title={t.listEditTitle} onClose={onClose}>
      <View style={{ gap: 6 }}>
        <Text size={12} weight="600" muted>{t.listNameLabel}</Text>
        <TextInput maxFontSizeMultiplier={SYSTEM_FONT_CAP} value={name} onChangeText={setName} maxLength={60} placeholder={t.listNamePlaceholder} placeholderTextColor={tokens.muted} style={field} />
      </View>
      <View style={{ gap: 6 }}>
        <Text size={12} weight="600" muted>{t.listSubtitleLabel}</Text>
        <TextInput maxFontSizeMultiplier={SYSTEM_FONT_CAP} value={subtitle} onChangeText={setSubtitle} maxLength={160} multiline placeholder={t.listSubtitlePlaceholder} placeholderTextColor={tokens.muted} textAlignVertical="top" style={[field, { minHeight: 66, paddingVertical: 10 }]} />
      </View>
      <View style={{ gap: 6 }}>
        <Segmented items={[{ id: "private", label: t.listPrivate }, { id: "public", label: t.listPublic }]} value={pub ? "public" : "private"} onChange={(v) => setPub(v === "public")} />
        {pub ? <Text size={12} muted>{t.listPublicHint}</Text> : null}
      </View>
      {list.smart ? null : (
        <View style={{ gap: 8 }}>
          <Text size={12} weight="600" muted>{t.listType}</Text>
          {/* «ت٥أ» (أحمد ٢٦ نوفمبر): عائلةُ المقسّم كصفِّ «خاصّة/عامّة» فوقه — لا كبسولات */}
          <Segmented
            items={[
              { id: "regular", label: t.listTypeRegular },
              { id: "ranked", label: t.listTypeRanked },
              { id: "watch_order", label: t.listTypeWatch },
            ]}
            value={kind}
            onChange={(v) => setKind(v as typeof kind)}
          />
          <Text size={12} muted>{kind === "ranked" ? t.listTypeRankedHint : kind === "watch_order" ? t.listTypeWatchHint : t.listTypeRegularHint}</Text>
        </View>
      )}
      <Button
        label={t.doneLabel}
        busy={busy}
        disabled={!clean}
        onPress={() => onSave({ name: clean, isPublic: pub, subtitle: subtitle.trim() || null, ...(list.smart ? {} : { kind }) })}
      />
    </Sheet>
  );
}
