import React, { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useApp } from "../state";
import { Text, Button } from "../ui";
import { Icon, iconOr } from "../icons";
import { Sheet } from "../library/Sheet";
import { DragList } from "../library/DragList";
import { radius } from "../theme";
import { HOME_SECTIONS, homeSectionMeta, type HomeSection } from "@/core/homePrefs";

/**
 * ورقةُ ترتيب أقسام الرئيسية — `HomeSectionsOrder` + `SectionOrderList` الويبيّتان
 * (Phase 11-H · H4، D-595): السجلُّ كاملاً، الظاهرُ بترتيبه أوّلاً وله «أعلى/أسفل»
 * و«إخفاء»، والمخفيُّ مشطوباً في الذيل وله «إظهار» — ولا يُحذف قسمٌ من السجلّ
 * (يعود بضغطة). ⚖️ **🆕 ١٤ أكتوبر: السحبُ بدل السهمين** (أحمد: «شيل الاسهم ما يحتاج دام اقدر اسحبها»، ثمّ «١أ»
 * — الترتيبُ كلُّه في التطبيق بالسحب) — نقضٌ مسجَّلٌ لـ«أسهمٌ لا سحب»، والمحرّكُ `DragList` نفسُه الذي يرتّب
 * طابورَ «للمشاهدة» وأقسامَ ودجت لوبز. الحفظُ للمشترك (D-791): الخادمُ يرفض
 * `needsPlus` والشاشةُ تفتح `/plus`.
 */
/**
 * 🆕 D-1112 — **الورقةُ نفسُها لكلِّ سجلٍّ يُرتَّب ويُخفى** (أقسامُ الرئيسيّة · خاناتُ الأرقام · تبويباتُ
 * الملفّ · أقسامُ نظرته العامّة) — `SettingsArrangeSheet` الويبيّةُ واحدةٌ لأربعتها، **فورقتان هنا بشكلين
 * عطلٌ** (القاعدة ٣). `min`/`max` حدّا خانات الأرقام (٢–٤): الإخفاءُ يتوقّف عند الأدنى، والإظهارُ عند الأعلى.
 */
export function ArrangeSheet<K extends string>({
  title,
  hint,
  all,
  picked: initial,
  meta,
  min = 1,
  max,
  onClose,
  onDone,
}: {
  title: string;
  hint: string;
  all: readonly K[];
  picked: K[];
  meta: Record<K, { icon: string; label: string }>;
  min?: number;
  max?: number;
  onClose: () => void;
  onDone: (next: K[]) => void;
}) {
  const { t, tokens } = useApp();
  const [picked, setPicked] = useState<K[]>(initial);
  const hidden = all.filter((k) => !picked.includes(k));
  const full = max !== undefined && picked.length >= max;
  const iconBtn = (name: "eye" | "eye-off", label: string, onPress: () => void, disabled = false) => (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={6} accessibilityRole="button" accessibilityLabel={label} style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.3 : 1 }}>
      <Icon name={name} size={18} color={tokens.fg} />
    </Pressable>
  );
  const label = (k: K, shown: boolean) => (
    <>
      <Icon name={iconOr(meta[k].icon, "list")} size={18} color={shown ? tokens.accent : tokens.muted} />
      <Text size={15} weight="600" numberOfLines={1} style={[{ flex: 1 }, shown ? null : { textDecorationLine: "line-through" }]}>{meta[k].label}</Text>
    </>
  );
  return (
    <Sheet title={title} onClose={onClose}>
      <Text size={12} muted style={{ paddingHorizontal: 16, marginBottom: 8 }}>{hint}</Text>
      <View style={{ paddingHorizontal: 12 }}>
        {/* المفتاحُ يتبدّل مع ما ظهر وما خفي — فيعيد المحرّكُ مواضعَه من الترتيب الجديد */}
        <DragList
          key={picked.join("|")}
          keys={picked}
          rowHeight={56}
          maxHeight={360}
          onOrder={(next) => setPicked(next as K[])}
          handleLabel={(k, i) => `${meta[k as K].label} — ${t.listPositionOf(i + 1, picked.length)}`}
          renderRow={(k) => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              {label(k as K, true)}
              {iconBtn("eye-off", t.custHide, () => setPicked(picked.filter((x) => x !== k)), picked.length <= min)}
            </View>
          )}
        />
        {hidden.length ? (
          <ScrollView style={{ maxHeight: 160 }} contentContainerStyle={{ paddingHorizontal: 4, gap: 6, paddingTop: 6 }}>
            {hidden.map((k) => (
              <View key={k} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingStart: 12, paddingEnd: 4, borderRadius: radius.md, backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.border, opacity: 0.55 }}>
                {label(k, false)}
                {iconBtn("eye", t.custShow, () => setPicked([...picked, k]), full)}
              </View>
            ))}
          </ScrollView>
        ) : null}
      </View>
      <View style={{ padding: 16 }}>
        <Button label={t.listDone} onPress={() => onDone(picked)} />
      </View>
    </Sheet>
  );
}

/** ترتيبُ أقسام الرئيسيّة من رأس أقسامها — الورقةُ العامّةُ بسجلّ `HOME_SECTIONS` */
export function SectionOrderSheet({ order, onClose, onDone }: { order: HomeSection[]; onClose: () => void; onDone: (next: HomeSection[]) => void }) {
  const { t } = useApp();
  return <ArrangeSheet title={t.custArrange} hint={t.custOrderHint} all={HOME_SECTIONS} picked={order} meta={homeSectionMeta(t)} onClose={onClose} onDone={onDone} />;
}
