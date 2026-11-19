import React, { useState } from "react";
import { View } from "react-native";
import { useApp } from "../state";
import { Text } from "../ui";
import { haptic } from "../haptics";
import { Segmented } from "../library/ToolsSheet";
import { Group, ExpandRow, OptionRow } from "./ui";
import type { WidgetSectionKey, WidgetSize } from "@/core/widgetLayout";
import { SLOT_SECTIONS, SMALL_SECTIONS, contOff, editorSlots, slotsFor, type SlotSection, type WidgetSlot, type WidgetV3 } from "@/core/widgetSlots";

/**
 * ====== 🆕 محرّرُ الخانات (الودجت v3، خالد ٢٨ أكتوبر) ======
 *
 * 🔑 **ما يقرّره الشخص فقط**: فوق (المتوسط وحده) · أكملُ المشاهدة بطاقتان أو ٣ بوسترات · كلُّ خانة «قسم كامل» أو «نصّين» (والثانيةُ
 * «بدون»). 🆕 v4 — «المعمل» (٣٠ أكتوبر): بوستراتٌ فقط فلا «قائمة/بوستر»، ولا سطرَ أخير. المقاساتُ في المحرّك (`widgetTiles.ts`).
 *
 * - **الاختيارُ ينفتح في مكانه** (`ExpandRow` — خالد ٢١:٤٣: «ما ابغى صفحة تنفك تحت ابغى نفس المكان تنفك»).
 * - **المستخدمُ رماديٌّ ومكتوبٌ جنبه «مستخدم»** — لا قسمَ مرّتين في ودجتٍ واحد.
 * - **عائلتا التحكّم وحدَهما** (القاعدة ٣): مقطّعٌ (`Segmented`) وصفوفُ الاختيار (`OptionRow`).
 */
export function SlotEditor({
  v3,
  size,
  names,
  fit,
  onChange: commit,
}: {
  v3: WidgetV3;
  size: WidgetSize;
  names: Record<WidgetSectionKey, string>;
  /**
   * 🆕 ١٩ نوفمبر — أيُّ الخانات تُرسم في حجم هذا الودجت (`slotsFit`، بترتيب الخانات الظاهرة بلا «بدون»). ما لا يتّسع يبقى ظاهراً **باهتاً
   * مقفلاً على «بدون»** ولا يحسب أقسامَه «مستخدمة» (أحمد «ب»: «واذا سار لها مساحة ينفك وتدخل مباشرة»). بلاه: كلُّها تتّسع.
   */
  fit?: boolean[];
  onChange: (next: WidgetV3) => void;
}) {
  const { t } = useApp();
  /* أيُّ اختيارٍ مفتوحٌ الآن — واحدٌ في كلِّ مرّة */
  const [open, setOpen] = useState<string | null>(null);
  const toggle = (id: string) => setOpen((o) => (o === id ? null : id));
  /* 🆕 v4 — كلُّ تعديلٍ يعلّم الإعدادَ «معدَّلاً»: قبلها يأخذ ٤×٣ افتراضيَّه (أصدقاؤك ٣ بوسترات — خالد ٠١:٣٦) */
  const onChange = (next: WidgetV3) => commit({ ...next, edited: true });
  const seg = (items: { id: string; label: string }[], value: string, change: (v: string) => void) => (
    <Segmented items={items} value={value} onChange={(v) => { haptic.pick(); change(v); }} />
  );

  if (size === "small") {
    return (
      <Group label={t.widgetSmallShows}>
        {SMALL_SECTIONS.map((k) => (
          <OptionRow key={k} selected={v3.small === k} title={names[k]} onSelect={() => onChange({ ...v3, small: k })} />
        ))}
      </Group>
    );
  }

  /* 🆕 v4 — **ترتيبٌ واحدٌ لكلِّ المقاسات** (خاناتُ الكبير جداً): المحرّرُ يعدّلها، والمعاينةُ فوقه تعرض ما يتّسع للحجم */
  /*
   * 🆕 ١٩ نوفمبر — **«أكمل المشاهدة» محتوى الخانة ١ لا قسمٌ ثابتٌ فوقها** (لقطةُ أحمد: «اول واحد لا يكون اجباري اكمل المشاهدة خله سلوت ١
   * … و رتب الارقام»). الخاناتُ مرقّمةٌ ١ ٢ ٣ في كلِّ حجم:
   * - الخانة ١ «أكمل المشاهدة» (الافتراضيّ): شكلُه بطاقتان أو ٣ بوسترات، وبعدها خانتا الإعداد ٢ و٣ (والثالثةُ قد تكون «بدون»).
   * - الخانة ١ قسمٌ آخر (`cont: "off"`): الخاناتُ الثلاثُ لازمة — قسمٌ كاملٌ أو نصّان (أحمد: «يجبر الواحد يحط ثلاث صفوف او يقسم لاثنين»).
   * التبديلُ بينهما لا يحرّك ما في الخانتين ٢ و٣: البيانُ يُزاح تحت الأرقام (`toOff` / `toCont`) فيبقى ما يراه الشخصُ في مكانه.
   */
  const off = contOff(v3);
  const all: WidgetSlot[] = editorSlots(v3);
  /* رقمُ الخانة على الشاشة: «أكمل المشاهدة» يأخذ الأوّل حين يكون فيها */
  const numOf = (i: number) => (off ? i + 1 : i + 2);
  /* موضعُ كلِّ خانةٍ في قائمة `fit` (تتخطّى «بدون» التي اختارها الشخص) — وما لا يتّسع لا مكانَ له: يبهت ولا يُحسب */
  const noRoom = (i: number): boolean => {
    if (!fit || all[i].mode === "off") return false;
    const live = all.slice(0, i).filter((s) => s.mode !== "off").length;
    return fit[live] === false;
  };
  const used = (skip: string) =>
    all.flatMap((s, i) => (s.mode === "off" || noRoom(i) ? [] : s.mode === "pair" ? [[`${i}:a`, s.a.s], [`${i}:b`, s.b.s]] : [[`${i}:a`, s.a.s]])).filter(([id]) => id !== skip).map(([, k]) => k as SlotSection);
  const firstFree = (taken: SlotSection[]) => SLOT_SECTIONS.find((k) => !taken.includes(k)) ?? "act";

  const setSlot = (i: number, slot: WidgetSlot) => {
    const next = [...all];
    next[i] = slot;
    /* الثالثةُ تُحفظ وحدَها (`slot3`) — والأوليان في مكانهما، فالرجوعُ إلى أكمل المشاهدة يجدهما */
    onChange({ ...v3, xl: { ...v3.xl, slots: [next[0], next[1]] }, ...(next[2] ? { slot3: next[2] } : {}) });
  };
  /** الخانة ١ تصير قسماً: ما كان في ٢ و٣ يبقى في ٢ و٣ */
  const toOff = (k: SlotSection) => {
    const [s2, s3] = v3.xl.slots;
    const rest: WidgetV3 = { ...v3 };
    delete rest.slot3;
    onChange({
      ...rest,
      cont: "off",
      xl: { ...v3.xl, slots: [{ mode: "full", a: { s: k, v: "poster" }, b: { s: firstFree([k]), v: "poster" } }, s2] },
      ...(s3.mode === "off" ? {} : { slot3: s3 }),
    });
  };
  /** الخانة ١ تعود «أكمل المشاهدة»: ٢ و٣ في مكانهما، وما كان في ١ يُحفظ (`slot3`) فيرجع إن رجعت */
  const toCont = (shape: "cards" | "posters") => {
    const [s1, s2, s3] = all;
    onChange({ ...v3, cont: shape, xl: { ...v3.xl, slots: [s2, s3] }, slot3: s1 });
  };

  /** اختيارُ قسمٍ في مكانٍ واحد: المستخدمُ في مكانٍ آخر رماديّ — بالأولويّة (خالد ٠٢:٠٤). والخانة ١ وحدَها فيها «أكمل المشاهدة» أوّلاً */
  const picker = (id: string, label: string, current: SlotSection | "cont", pick: (k: SlotSection | "cont") => void, withCont = false) => {
    const taken = used(id);
    const keys: (SlotSection | "cont")[] = withCont ? ["cont", ...SLOT_SECTIONS] : [...SLOT_SECTIONS];
    return (
      <ExpandRow key={id} title={label} value={names[current]} open={open === id} onToggle={() => toggle(id)}>
        {keys.map((k) => {
          const busy = k !== current && k !== "cont" && taken.includes(k);
          return (
            <OptionRow
              key={k}
              selected={k === current}
              disabled={busy}
              title={names[k]}
              subtitle={busy ? t.widgetUsed : undefined}
              onSelect={() => {
                setOpen(null);
                if (k !== current) pick(k);
              }}
            />
          );
        })}
      </ExpandRow>
    );
  };

  const label = (n: number) => <Text size={12} weight="600" muted style={{ paddingHorizontal: 4 }}>{t.widgetSlotN(n)}</Text>;

  /** الخانة ١ وفيها «أكمل المشاهدة»: شكلُه، والقسمُ يُبدَّل منها */
  const contBox = () => (
    <View key="cont" style={{ gap: 6 }}>
      {label(1)}
      <Group>
        <View style={{ padding: 12 }}>
          {seg([{ id: "cards", label: t.widgetContCards }, { id: "posters", label: t.widgetContPosters }], v3.cont === "posters" ? "posters" : "cards", (v) => onChange({ ...v3, cont: v === "posters" ? "posters" : "cards" }))}
        </View>
        {picker("c:a", t.widgetSection, "cont", (k) => (k === "cont" ? undefined : toOff(k)), true)}
      </Group>
    </View>
  );

  const slotBox = (i: number) => {
    const slot = all[i];
    const n = numOf(i);
    /* 🆕 ١٩ نوفمبر — لا مكانَ لها في هذا الحجم: ظاهرةٌ باهتةٌ مقفلةٌ على «بدون» — وتنفكّ وحدَها حين يتّسع لها الودجت */
    if (noRoom(i)) {
      return (
        <View key={i} style={{ gap: 6 }} pointerEvents="none">
          <Text size={12} weight="600" muted style={{ paddingHorizontal: 4 }}>{`${t.widgetSlotN(n)} · ${t.widgetSlotNoRoom}`}</Text>
          <View style={{ opacity: 0.4 }}>
            <Group>
              <View style={{ padding: 12 }}>
                {seg([{ id: "full", label: t.widgetSlotFull }, { id: "pair", label: t.widgetSlotPair }, { id: "off", label: t.widgetSlotOff }], "off", () => {})}
              </View>
            </Group>
          </View>
        </View>
      );
    }
    /* «بدون» للخانة ٣ وحدَها وفي الأولى «أكمل المشاهدة» */
    const modes = [{ id: "full", label: t.widgetSlotFull }, { id: "pair", label: t.widgetSlotPair }, ...(i === 1 && !off ? [{ id: "off", label: t.widgetSlotOff }] : [])];
    /* الخانة ١ (وأكملُ المشاهدة خارجها): «أكمل المشاهدة» أوّلُ ما في اختيار قسمها */
    const first = off && i === 0;
    const pickA = (k: SlotSection | "cont") => (k === "cont" ? toCont("cards") : setSlot(i, { ...slot, a: { s: k, v: "poster" } }));
    return (
      <View key={i} style={{ gap: 6 }}>
        {label(n)}
        <Group>
          <View style={{ padding: 12 }}>
            {seg(modes, slot.mode, (v) => {
              const mode = v as WidgetSlot["mode"];
              let { a, b } = slot;
              /* من «بدون» أو إلى «نصّين»: القسمُ الناقصُ يأخذ أوّلَ قسمٍ حرٍّ بالأولويّة */
              if (slot.mode === "off" && mode !== "off") a = { s: firstFree(used(`${i}:a`).concat(used(`${i}:b`))), v: "poster" };
              if (mode === "pair" && (slot.mode !== "pair" || b.s === a.s)) b = { s: firstFree([...used(`${i}:b`).filter((k) => k !== slot.a.s), a.s, ...used(`${i}:a`)]), v: "poster" };
              setSlot(i, { mode, a, b });
            })}
          </View>
          {slot.mode === "full" ? picker(`${i}:a`, t.widgetSection, slot.a.s, pickA, first) : null}
          {slot.mode === "pair" ? picker(`${i}:a`, t.widgetSideA, slot.a.s, pickA, first) : null}
          {slot.mode === "pair" ? picker(`${i}:b`, t.widgetSideB, slot.b.s, (k) => (k === "cont" ? undefined : setSlot(i, { ...slot, b: { s: k, v: "poster" } }))) : null}
        </Group>
      </View>
    );
  };

  return (
    <View style={{ gap: 16 }}>
      {off ? null : contBox()}
      {all.map((_, i) => slotBox(i))}
    </View>
  );
}

/** سطرُ الملخّص في بطاقة الودجت: ما يظهر فيه بالترتيب لهذا الحجم */
export function v3Summary(v3: WidgetV3, size: WidgetSize, names: Record<WidgetSectionKey, string>): string {
  if (size === "small") return names[v3.small];
  const slots = slotsFor(v3, size);
  const parts: string[] = [];
  const off = contOff(v3);
  if (!off && (size !== "medium" || v3.medium.top)) parts.push(names.cont);
  for (const s of size === "medium" && v3.medium.top && !off ? [] : size === "medium" ? slots.slice(0, 1) : slots) parts.push(s.mode === "pair" ? `${names[s.a.s]} + ${names[s.b.s]}` : names[s.a.s]);
  return parts.join(" · ");
}
