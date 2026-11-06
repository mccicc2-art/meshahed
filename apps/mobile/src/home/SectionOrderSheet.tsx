import React, { useState } from "react";
import { Pressable, View } from "react-native";
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

/** كلماتُ القائمة المحلّيّة — `i18n.ts` محجوزٌ لمهمّةٍ أخرى في السجلّ (٢٧٤)، كـ`RATERS_WORDS` */
const ARRANGE_WORDS = {
  ar: { hidden: (n: number) => `مخفية · ${n}` },
  en: { hidden: (n: number) => `Hidden · ${n}` },
} as const;

/**
 * 🆕 D-1630 — **القائمةُ نفسُها في الصفحة وفي الورقة** (أحمد ٦ نوفمبر: «رتّب البطايق واختر الأقسام ابغاها موجوده ظاهره في
 * نفس الصفحة»). كانت `ArrangeSheet` ورقةً تُفتح من صفٍّ في «التخصيص»؛ صار جسمُها مكوّناً يُرسم في الصفحة مباشرةً
 * (أقسامُ الرئيسيّة · تبويباتُ الملفّ · أقسامُ نظرته العامّة) **والورقةُ تلفّه هو** — قائمتان بشكلين عطلٌ (القاعدة ٣).
 * ثلاثةُ تحسيناتٍ معتمدة:
 * - **المخفيُّ مطويٌّ** تحت «مخفية · n ▾»: القائمةُ تقول ما يظهر، والمخفيُّ ضغطةٌ لمن أراده.
 * - **آخرُ ظاهرٍ لا يُخفى** (`min`): صفحةٌ بلا قسمٍ واحد شاشةٌ فارغةٌ لا يعرف صاحبُها كيف وصلها.
 * - **أعلى/أسفل لقارئ الشاشة** (`accessibilityActions`): السحبُ إيماءةٌ لا يؤدّيها VoiceOver، فالترتيبُ له بفعلين.
 * `thumbs` يرسم صورةً مصغّرةً (رمزُ القسم في مربّعٍ ملوّن) أمام كلِّ صفّ — ما طلبه «ب»: لكلِّ خيارٍ معاينتُه.
 */
export function ArrangeList<K extends string>({
  all,
  picked,
  meta,
  min = 1,
  max,
  onChange,
  onDragChange,
  thumbs = false,
  maxHeight,
}: {
  all: readonly K[];
  picked: K[];
  meta: Record<K, { icon: string; label: string }>;
  min?: number;
  max?: number;
  onChange: (next: K[]) => void;
  onDragChange?: (dragging: boolean) => void;
  thumbs?: boolean;
  maxHeight?: number;
}) {
  const { t, tokens, locale } = useApp();
  const w = ARRANGE_WORDS[locale === "en" ? "en" : "ar"];
  const [showHidden, setShowHidden] = useState(false);
  const hidden = all.filter((k) => !picked.includes(k));
  const full = max !== undefined && picked.length >= max;
  const atMin = picked.length <= min;
  const move = (k: K, by: number) => {
    const i = picked.indexOf(k);
    const j = i + by;
    if (i < 0 || j < 0 || j >= picked.length) return;
    const next = [...picked];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const iconBtn = (name: "eye" | "eye-off", label: string, onPress: () => void, disabled = false) => (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={6} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.3 : 1 }}>
      <Icon name={name} size={18} color={tokens.fg} />
    </Pressable>
  );
  const label = (k: K, shown: boolean) => (
    <>
      {thumbs ? (
        <View style={{ width: 34, height: 34, borderRadius: radius.sm, backgroundColor: shown ? tokens.accent + "1F" : tokens.surface2, alignItems: "center", justifyContent: "center" }}>
          <Icon name={iconOr(meta[k].icon, "list")} size={17} color={shown ? tokens.accent : tokens.muted} />
        </View>
      ) : (
        <Icon name={iconOr(meta[k].icon, "list")} size={18} color={shown ? tokens.accent : tokens.muted} />
      )}
      <Text size={15} weight="600" numberOfLines={1} style={[{ flex: 1 }, shown ? null : { textDecorationLine: "line-through" }]}>{meta[k].label}</Text>
    </>
  );
  return (
    <View>
      {/* المفتاحُ يتبدّل مع ما ظهر وما خفي — فيعيد المحرّكُ مواضعَه من الترتيب الجديد */}
      <DragList
        key={picked.join("|")}
        keys={picked}
        rowHeight={56}
        maxHeight={maxHeight}
        onOrder={(next) => onChange(next as K[])}
        onDragChange={onDragChange}
        handleLabel={(k, i) => `${meta[k as K].label} — ${t.listPositionOf(i + 1, picked.length)}`}
        renderRow={(k) => (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}
              accessible
              accessibilityLabel={meta[k as K].label}
              accessibilityActions={[
                { name: "moveUp", label: t.custMoveUp },
                { name: "moveDown", label: t.custMoveDown },
              ]}
              onAccessibilityAction={(e) => move(k as K, e.nativeEvent.actionName === "moveUp" ? -1 : 1)}
            >
              {label(k as K, true)}
            </View>
            {iconBtn("eye-off", t.custHide, () => onChange(picked.filter((x) => x !== k)), atMin)}
          </View>
        )}
      />
      {hidden.length ? (
        <View style={{ paddingTop: 4 }}>
          <Pressable
            onPress={() => setShowHidden((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showHidden }}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10, paddingHorizontal: 12 }}
          >
            <Text size={13} weight="600" muted>{w.hidden(hidden.length)}</Text>
            <View style={{ transform: [{ rotate: showHidden ? "180deg" : "0deg" }] }}>
              <Icon name="chevron-down" size={14} color={tokens.muted} />
            </View>
          </Pressable>
          {showHidden ? (
            <View style={{ gap: 6, paddingHorizontal: 4, paddingBottom: 6 }}>
              {hidden.map((k) => (
                <View key={k} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingStart: 12, paddingEnd: 4, borderRadius: radius.md, backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.border, opacity: 0.6 }}>
                  {label(k, false)}
                  {iconBtn("eye", t.custShow, () => onChange([...picked, k]), full)}
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * 🆕 D-1112 — **الورقةُ نفسُها لكلِّ سجلٍّ يُرتَّب ويُخفى** — و🆕 D-1630 صار جسمُها `ArrangeList` أعلاه، فبقيت
 * ورقةُ رأس أقسام الرئيسيّة (`SectionOrderSheet`) والقائمةُ في «التخصيص» شيئاً واحداً بمسودّةٍ تُعتمد بـ«تم».
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
  const { t } = useApp();
  const [picked, setPicked] = useState<K[]>(initial);
  return (
    <Sheet title={title} onClose={onClose}>
      <Text size={12} muted style={{ paddingHorizontal: 16, marginBottom: 8 }}>{hint}</Text>
      <View style={{ paddingHorizontal: 12 }}>
        <ArrangeList all={all} picked={picked} meta={meta} min={min} max={max} onChange={setPicked} maxHeight={360} />
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
