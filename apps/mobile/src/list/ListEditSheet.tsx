import React, { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Chip } from "../library/Chip";
import { Sheet } from "../library/Sheet";
import { Segmented } from "../library/ToolsSheet";
import { radius } from "../theme";
import type { ListDetailPayload, ListUpdateBody } from "../contracts";

/**
 * ====== ورقةُ تحرير قائمتي — D-1037 (L2) ======
 *
 * **لماذا**: الشريحةُ الأولى (D-1036) أبقت تحريرَ المالك بابَ ويب؛ أحمد سأل «وش يمنع يتحوّل أصليّ؟» —
 * ولا مانع: الدوالُّ الخادميّةُ قائمة. هذه الورقةُ تحمل ما في ورقة `ListDetail` الويبيّة: الاسمُ · النبذةُ ·
 * معلنةٌ/خاصّة · النوع · ثمّ أبوابُ الترتيب والغلاف والحذف.
 *
 * 🔑 **سفليّةٌ لا وسطيّة** (قاعدةُ D-1032): يفتحها صاحبُها بنفسه. **ولا عنصرَ جديداً**: `Sheet` ·
 * `Segmented` (مصدَّرةً من `ToolsSheet` — استخراجٌ لا نسخ) · `Chip` · `Button`؛ وحقلُ النصّ بمقاسات حقل
 * `SmartListSheet`. **ولا نصَّ جديداً**: مفاتيحُ القاموس مفاتيحُ الويب.
 * ⚖️ **الحذفُ بخطوتين في مكانه**: الضغطةُ الأولى تكشف نصَّ العاقبة وزرَّ التأكيد — لا حوارَ ثانياً فوق الورقة،
 * ولا حذفَ بلمسةٍ واحدة (لا رجعةَ فيه). القائمةُ الذكيّة لا نوعَ لها ولا ترتيب (تمتلئ وحدَها — D-823).
 */
export function ListEditSheet({
  list,
  busy,
  onSave,
  onReorder,
  onCover,
  onDelete,
  onClose,
}: {
  list: ListDetailPayload;
  busy: boolean;
  onSave: (v: Omit<ListUpdateBody, "listId">) => void;
  onReorder: () => void;
  onCover: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const { t, tokens } = useApp();
  const [name, setName] = useState(list.name);
  const [subtitle, setSubtitle] = useState(list.subtitle ?? "");
  const [pub, setPub] = useState(list.is_public);
  const [kind, setKind] = useState<"regular" | "ranked" | "watch_order">(list.kind === "ranked" || list.kind === "watch_order" ? list.kind : "regular");
  const [confirming, setConfirming] = useState(false);
  const field = { minHeight: 44, borderRadius: radius.control, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface2, paddingHorizontal: 12, fontSize: 14, color: tokens.fg } as const;
  const clean = name.trim();

  return (
    <Sheet title={t.listEditTitle} onClose={onClose}>
      <View style={{ gap: 6 }}>
        <Text size={12} weight="600" muted>{t.listNameLabel}</Text>
        <TextInput value={name} onChangeText={setName} maxLength={60} placeholder={t.listNamePlaceholder} placeholderTextColor={tokens.muted} style={field} />
      </View>
      <View style={{ gap: 6 }}>
        <Text size={12} weight="600" muted>{t.listSubtitleLabel}</Text>
        <TextInput value={subtitle} onChangeText={setSubtitle} maxLength={160} multiline placeholder={t.listSubtitlePlaceholder} placeholderTextColor={tokens.muted} textAlignVertical="top" style={[field, { minHeight: 66, paddingVertical: 10 }]} />
      </View>
      <View style={{ gap: 6 }}>
        <Segmented items={[{ id: "private", label: t.listPrivate }, { id: "public", label: t.listPublic }]} value={pub ? "public" : "private"} onChange={(v) => setPub(v === "public")} />
        {pub ? <Text size={12} muted>{t.listPublicHint}</Text> : null}
      </View>
      {list.smart ? null : (
        <View style={{ gap: 8 }}>
          <Text size={12} weight="600" muted>{t.listType}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Chip label={t.listTypeRegular} active={kind === "regular"} onPress={() => setKind("regular")} />
            <Chip label={t.listTypeRanked} active={kind === "ranked"} onPress={() => setKind("ranked")} />
            <Chip label={t.listTypeWatch} active={kind === "watch_order"} onPress={() => setKind("watch_order")} />
          </View>
          <Text size={12} muted>{kind === "ranked" ? t.listTypeRankedHint : kind === "watch_order" ? t.listTypeWatchHint : t.listTypeRegularHint}</Text>
        </View>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {list.smart || list.items.length < 2 ? null : <Button label={t.listReorder} variant="ghost" onPress={onReorder} />}
        {list.items.length === 0 ? null : <Button label={t.listCover} variant="ghost" onPress={onCover} />}
      </View>
      <Button
        label={t.doneLabel}
        busy={busy}
        disabled={!clean}
        onPress={() => onSave({ name: clean, isPublic: pub, subtitle: subtitle.trim() || null, ...(list.smart ? {} : { kind }) })}
      />
      <View style={{ borderTopWidth: 1, borderTopColor: tokens.divider, paddingTop: 16, gap: 10 }}>
        {confirming ? (
          <>
            <Text size={13} muted style={{ lineHeight: 20 }}>{t.listDeleteBody}</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button label={t.cancelLabel} variant="ghost" onPress={() => setConfirming(false)} />
              <Button label={t.listDeleteYes} variant="danger" busy={busy} style={{ flex: 1 }} onPress={onDelete} />
            </View>
          </>
        ) : (
          <Pressable onPress={() => setConfirming(true)} hitSlop={8} style={{ alignSelf: "center", paddingVertical: 4 }}>
            <Text size={13} color={tokens.error}>{t.listDeleteThis}</Text>
          </Pressable>
        )}
      </View>
    </Sheet>
  );
}
