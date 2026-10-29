import React, { useState } from "react";
import { View } from "react-native";
import { useApp } from "../state";
import { Text } from "../ui";
import { haptic } from "../haptics";
import { Segmented } from "../library/ToolsSheet";
import { Group, Row, ExpandRow, OptionRow } from "./ui";
import type { WidgetSectionKey, WidgetSize } from "@/core/widgetLayout";
import {
  POSTER_ONLY,
  SLOT_SECTIONS,
  SMALL_SECTIONS,
  slotsFor,
  upInSlots,
  usedKeys,
  type SlotPart,
  type SlotSection,
  type WidgetSlot,
  type WidgetV3,
} from "@/core/widgetSlots";

/**
 * ====== 🆕 محرّرُ الخانات (الودجت v3، خالد ٢٨ أكتوبر) ======
 *
 * 🔑 **ما يقرّره الشخص فقط**: فوق (المتوسط وحده) · كلُّ خانة «قسم كامل» أو «نصّين» · كلُّ قسمٍ «قائمة» أو «بوستر» · والسطرُ الأخير
 * في الكبير جداً. لا ترتيبَ بالسحب ولا أعدادَ ولا أحجام — المقاساتُ ثابتةٌ في المحرّك (`widgetSlots.ts`).
 *
 * - **الاختيارُ ينفتح في مكانه** (`ExpandRow` — خالد ٢١:٤٣: «ما ابغى صفحة تنفك تحت ابغى نفس المكان تنفك»).
 * - **المستخدمُ رماديٌّ ومكتوبٌ جنبه «مستخدم»** — لا قسمَ مرّتين في ودجتٍ واحد.
 * - **عائلتا التحكّم وحدَهما** (القاعدة ٣): مقطّعٌ (`Segmented`) وصفوفُ الاختيار (`OptionRow`).
 */
export function SlotEditor({
  v3,
  size,
  names,
  onChange,
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

  const used = usedKeys(v3, size);
  const slots = slotsFor(v3, size);
  const upMoved = size !== "medium" && upInSlots(slots);

  /** يكتب الخانةَ رقم `i` في الحجم المعروض */
  const setSlot = (i: number, slot: WidgetSlot) => {
    if (size === "medium") return onChange({ ...v3, medium: { ...v3.medium, slot } });
    if (size === "large") return onChange({ ...v3, large: { slot } });
    const next: [WidgetSlot, WidgetSlot] = [...v3.xl.slots];
    next[i] = slot;
    onChange({ ...v3, xl: { ...v3.xl, slots: next } });
  };

  /** اختيارُ قسمٍ في مكانٍ واحد: المستخدمُ في مكانٍ آخر رماديّ، والحاليُّ مختار */
  const picker = (id: string, label: string, current: SlotSection, pick: (k: SlotSection) => void) => (
    <ExpandRow title={label} value={names[current]} open={open === id} onToggle={() => toggle(id)}>
      {SLOT_SECTIONS.map((k) => {
        const busy = k !== current && used.includes(k);
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

  const side = (i: number, slot: WidgetSlot, which: "a" | "b", label: string) => {
    const p: SlotPart = slot[which];
    return (
      <View key={which}>
        {picker(`${i}:${which}`, label, p.s, (k) => setSlot(i, { ...slot, [which]: { s: k, v: POSTER_ONLY.includes(k) ? "poster" : p.v } }))}
        <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
          {POSTER_ONLY.includes(p.s) ? (
            /* فيلمُ الليلة والسينما بوسترٌ دائماً (D-1571) */
            <Text size={12} muted>{p.s === "cine" ? t.widgetCinemaPoster : t.widgetTonightPoster}</Text>
          ) : (
            seg([{ id: "list", label: t.widgetList }, { id: "poster", label: t.widgetPoster }], p.v, (v) => setSlot(i, { ...slot, [which]: { ...p, v: v as SlotPart["v"] } }))
          )}
        </View>
      </View>
    );
  };

  const slotBox = (i: number, slot: WidgetSlot, title: string) => (
    <View key={i} style={{ gap: 6 }}>
      <Text size={12} weight="600" muted style={{ paddingHorizontal: 4 }}>{title}</Text>
      <Group>
        <View style={{ padding: 12 }}>
          {seg([{ id: "full", label: t.widgetSlotFull }, { id: "pair", label: t.widgetSlotPair }], slot.mode, (v) => {
            const mode = v as WidgetSlot["mode"];
            /* «نصّين» والنصفُ الثاني مستخدمٌ في مكانٍ آخر: يأخذ أوّلَ قسمٍ حرّ */
            let b = slot.b;
            if (mode === "pair" && (b.s === slot.a.s || used.filter((k) => k !== slot.a.s).includes(b.s))) {
              const free = SLOT_SECTIONS.find((k) => k !== slot.a.s && !used.includes(k));
              if (free) b = { s: free, v: POSTER_ONLY.includes(free) ? "poster" : "list" };
            }
            setSlot(i, { ...slot, mode, b });
          })}
        </View>
        {side(i, slot, "a", slot.mode === "pair" ? t.widgetSideA : t.widgetSection)}
        {slot.mode === "pair" ? side(i, slot, "b", t.widgetSideB) : null}
      </Group>
    </View>
  );

  return (
    <View style={{ gap: 16 }}>
      {size === "medium" ? (
        <View style={{ gap: 6 }}>
          <Text size={12} weight="600" muted style={{ paddingHorizontal: 4 }}>{t.widgetTop}</Text>
          <Group>
            <View style={{ padding: 12 }}>
              {seg([{ id: "top", label: t.widgetTopCont }, { id: "slot", label: t.widgetSlot }], v3.medium.top ? "top" : "slot", (v) => onChange({ ...v3, medium: { ...v3.medium, top: v === "top" } }))}
            </View>
          </Group>
        </View>
      ) : (
        <View style={{ gap: 6 }}>
          <Group>
            <Row title={upMoved ? t.widgetContOnly : t.widgetTopCont} trailing={<Text size={12} muted>{t.widgetFixedTop}</Text>} />
          </Group>
          {upMoved ? <Text size={12} muted style={{ paddingHorizontal: 4, lineHeight: 18 }}>{t.widgetUpMoved}</Text> : null}
        </View>
      )}
      {slots.map((slot, i) => slotBox(i, slot, slots.length > 1 ? t.widgetSlotN(i + 1) : t.widgetSlot))}
      {size === "xl" ? (
        <View style={{ gap: 6 }}>
          <Text size={12} weight="600" muted style={{ paddingHorizontal: 4 }}>{t.widgetLastLine}</Text>
          <Group>{picker("line", t.widgetSection, v3.xl.line, (k) => onChange({ ...v3, xl: { ...v3.xl, line: k } }))}</Group>
          <Text size={12} muted style={{ paddingHorizontal: 4, lineHeight: 18 }}>{upMoved ? t.widgetLastLineTwo : t.widgetLastLineHint}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** سطرُ الملخّص في بطاقة الودجت: ما يظهر فيه بالترتيب لهذا الحجم */
export function v3Summary(v3: WidgetV3, size: WidgetSize, names: Record<WidgetSectionKey, string>): string {
  if (size === "small") return names[v3.small];
  const slots = slotsFor(v3, size);
  const parts: string[] = [];
  if (size !== "medium" || v3.medium.top) parts.push(names.cont);
  for (const s of slots) parts.push(s.mode === "pair" ? `${names[s.a.s]} + ${names[s.b.s]}` : names[s.a.s]);
  if (size === "xl") parts.push(names[v3.xl.line]);
  return parts.join(" · ");
}
