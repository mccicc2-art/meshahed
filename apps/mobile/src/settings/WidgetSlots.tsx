import React, { useState } from "react";
import { View } from "react-native";
import { useApp } from "../state";
import { Text } from "../ui";
import { haptic } from "../haptics";
import { Segmented } from "../library/ToolsSheet";
import { Group, ExpandRow, OptionRow } from "./ui";
import type { WidgetSectionKey, WidgetSize } from "@/core/widgetLayout";
import { SLOT_SECTIONS, SMALL_SECTIONS, slotsFor, type SlotSection, type WidgetSlot, type WidgetV3 } from "@/core/widgetSlots";

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
  onChange: commit,
}: {
  v3: WidgetV3;
  size: WidgetSize;
  names: Record<WidgetSectionKey, string>;
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

  /* 🆕 v4 — **ترتيبٌ واحدٌ لكلِّ المقاسات** (خاناتُ الكبير جداً)، والمتوسطُ يعرض الخانةَ الأولى وحدَها إن اختارها فوق */
  const all = v3.xl.slots;
  const shown = size === "medium" ? (v3.medium.top ? [] : [0]) : [0, 1];
  const used = (skip: string) =>
    all.flatMap((s, i) => (s.mode === "off" ? [] : s.mode === "pair" ? [[`${i}:a`, s.a.s], [`${i}:b`, s.b.s]] : [[`${i}:a`, s.a.s]])).filter(([id]) => id !== skip).map(([, k]) => k as SlotSection);
  const firstFree = (taken: SlotSection[]) => SLOT_SECTIONS.find((k) => !taken.includes(k)) ?? "act";

  const setSlot = (i: number, slot: WidgetSlot) => {
    const next: [WidgetSlot, WidgetSlot] = [...all];
    next[i] = slot;
    onChange({ ...v3, xl: { ...v3.xl, slots: next } });
  };

  /** اختيارُ قسمٍ في مكانٍ واحد: المستخدمُ في مكانٍ آخر رماديّ — بالأولويّة (خالد ٠٢:٠٤) */
  const picker = (id: string, label: string, current: SlotSection, pick: (k: SlotSection) => void) => {
    const taken = used(id);
    return (
      <ExpandRow key={id} title={label} value={names[current]} open={open === id} onToggle={() => toggle(id)}>
        {SLOT_SECTIONS.map((k) => {
          const busy = k !== current && taken.includes(k);
          return (
            <OptionRow
              key={k}
              selected={k === current}
              disabled={busy}
              title={names[k]}
              subtitle={busy ? t.widgetUsed : undefined}
              onSelect={() => {
                pick(k);
                setOpen(null);
              }}
            />
          );
        })}
      </ExpandRow>
    );
  };

  const slotBox = (i: number) => {
    const slot = all[i];
    const modes = [{ id: "full", label: t.widgetSlotFull }, { id: "pair", label: t.widgetSlotPair }, ...(i === 1 ? [{ id: "off", label: t.widgetSlotOff }] : [])];
    return (
      <View key={i} style={{ gap: 6 }}>
        <Text size={12} weight="600" muted style={{ paddingHorizontal: 4 }}>{shown.length > 1 ? t.widgetSlotN(i + 1) : t.widgetSlot}</Text>
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
          {slot.mode === "full" ? picker(`${i}:a`, t.widgetSection, slot.a.s, (k) => setSlot(i, { ...slot, a: { s: k, v: "poster" } })) : null}
          {slot.mode === "pair" ? picker(`${i}:a`, t.widgetSideA, slot.a.s, (k) => setSlot(i, { ...slot, a: { s: k, v: "poster" } })) : null}
          {slot.mode === "pair" ? picker(`${i}:b`, t.widgetSideB, slot.b.s, (k) => setSlot(i, { ...slot, b: { s: k, v: "poster" } })) : null}
        </Group>
      </View>
    );
  };

  const contTop = size !== "medium" || v3.medium.top;
  return (
    <View style={{ gap: 16 }}>
      {size === "medium" ? (
        <View style={{ gap: 6 }}>
          <Text size={12} weight="600" muted style={{ paddingHorizontal: 4 }}>{t.widgetTop}</Text>
          <Group>
            <View style={{ padding: 12 }}>
              {seg([{ id: "top", label: t.widgetContTop }, { id: "slot", label: t.widgetSlot }], v3.medium.top ? "top" : "slot", (v) => onChange({ ...v3, medium: { ...v3.medium, top: v === "top" } }))}
            </View>
          </Group>
        </View>
      ) : null}
      {contTop ? (
        <View style={{ gap: 6 }}>
          <Text size={12} weight="600" muted style={{ paddingHorizontal: 4 }}>{t.widgetContShape}</Text>
          <Group>
            <View style={{ padding: 12 }}>
              {seg([{ id: "cards", label: t.widgetContCards }, { id: "posters", label: t.widgetContPosters }], v3.cont === "posters" ? "posters" : "cards", (v) => onChange({ ...v3, cont: v === "posters" ? "posters" : "cards" }))}
            </View>
          </Group>
        </View>
      ) : null}
      {shown.map((i) => slotBox(i))}
    </View>
  );
}

/** سطرُ الملخّص في بطاقة الودجت: ما يظهر فيه بالترتيب لهذا الحجم */
export function v3Summary(v3: WidgetV3, size: WidgetSize, names: Record<WidgetSectionKey, string>): string {
  if (size === "small") return names[v3.small];
  const slots = slotsFor(v3, size);
  const parts: string[] = [];
  if (size !== "medium" || v3.medium.top) parts.push(names.cont);
  for (const s of size === "medium" && v3.medium.top ? [] : size === "medium" ? slots.slice(0, 1) : slots) parts.push(s.mode === "pair" ? `${names[s.a.s]} + ${names[s.b.s]}` : names[s.a.s]);
  return parts.join(" · ");
}
