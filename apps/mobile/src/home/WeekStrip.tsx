import React, { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { useApp } from "../state";
import { Sheet } from "../library/Sheet";
import { posterFor } from "../poster";
import { haptic } from "../haptics";
import { Text } from "../ui";
import { Icon } from "../icons";
import { PAGE_PAD } from "./Section";
import type { HomeWeekDay, HomeWeekEntry } from "../contracts";

/**
 * شريطُ الأسبوع — `WeekStrip.tsx` الويبيّة (Phase 11-H · H2) في أصله: ١٤ يوماً تُمرَّر (D-491)، اليومُ الأوّلُ بلون التمييز،
 * العنوانُ بابُ التقويم (D-378)، و«لا حلقات» على سطر العنوان حين يفرغ الأسبوع (D-1428).
 * 🆕 D-1587 — يومٌ بأكثر من عملٍ قال أوّلَها و«+ن»، وضغطتُه ورقةُ أعمال اليوم.
 * 🆕 D-1590 → D-1591 — **أيّامٌ بملصقات** (أحمد ٣٠ أكتوبر بعد بطاقات القادم: «غيّره، جرّب مقترح أ»): الأيّامُ كلُّها باقيةٌ في
 * صفّها، لكنّ **اليومَ الذي فيه عملٌ يتّسع ويحمل ملصقَه** (وملصقين متراكبين إن كانا أكثر)، واسمَ الأوّل على سطرين و«+ن» —
 * والفارغُ يضيق ويبهت. سبعُ خاناتٍ متساويةٌ كانت تعطي كلَّ يومٍ ٥٠ نقطةً لا تتّسع لاسم؛ الآن العرضُ لمن عنده ما يقوله.
 * ضغطةُ يومٍ بعملٍ واحدٍ تفتحه، وبأكثر ورقةُ اليوم (D-1587).
 */
const WIDE = 118;
const NARROW = 44;
const POSTER_W = 60;
const POSTER_H = 90;

export function WeekStrip({ days, entries, onDay, onCalendar }: { days: HomeWeekDay[]; entries: HomeWeekEntry[]; onDay: (showId: number) => void; onCalendar: () => void }) {
  const { t, tokens } = useApp();
  const [sheetDay, setSheetDay] = useState<HomeWeekDay | null>(null);
  const byDay = new Map<string, HomeWeekEntry[]>();
  for (const e of entries) {
    if (!byDay.has(e.date)) byDay.set(e.date, []);
    byDay.get(e.date)!.push(e);
  }
  const poster = (e: HomeWeekEntry | undefined, style: object) => {
    const url = e ? posterFor(e.poster_path ?? null, POSTER_W) : null;
    return (
      <View style={[{ width: POSTER_W, height: POSTER_H, borderRadius: 8, overflow: "hidden", backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }, style]}>
        {url ? <Image source={{ uri: url }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" /> : <Icon name="tv" size={16} color={tokens.muted} />}
      </View>
    );
  };
  return (
    <View>
      <View style={{ paddingHorizontal: PAGE_PAD, flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Pressable onPress={onCalendar} accessibilityRole="link" style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 }}>
          <Icon name="calendar" size={18} color={tokens.muted} />
          <Text size={20} weight="700" numberOfLines={1} style={{ flexShrink: 1 }}>{t.weekTitle}</Text>
          <Text size={16} muted>›</Text>
        </Pressable>
        {entries.length === 0 ? (
          <Text size={12} muted numberOfLines={1} style={{ flexShrink: 1 }}>{t.weekNothing}</Text>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: PAGE_PAD, gap: 6, alignItems: "stretch" }}>
        {days.map((d, i) => {
          const list = byDay.get(d.date) ?? [];
          const first = list[0];
          const numColor = i === 0 ? tokens.accent : tokens.fg;
          if (!first) {
            /* اليومُ الفارغ ضيّقٌ باهت: اسمُه ورقمُه فقط — الفراغُ معلومة (D-491) ولا يأخذ عرضاً */
            return (
              <View key={d.date} style={{ width: NARROW, borderRadius: 12, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, paddingVertical: 8, alignItems: "center", gap: 4, opacity: 0.7 }}>
                <Text size={10} muted numberOfLines={1}>{d.weekday}</Text>
                <Text size={14} weight="700" color={numColor} style={{ fontVariant: ["tabular-nums"] }}>{d.day_num}</Text>
              </View>
            );
          }
          const more = list.length > 1;
          return (
            <Pressable
              key={d.date}
              onPress={() => { if (more) { haptic.pick(); setSheetDay(d); } else onDay(first.show_id); }}
              accessibilityRole="link"
              accessibilityLabel={`${d.weekday} ${d.day_num} · ${list.map((e) => e.title).join("، ")}`}
              style={({ pressed }) => ({ width: WIDE, borderRadius: 14, borderWidth: 1, borderColor: tokens.accent2 + "8C", backgroundColor: tokens.accent2 + "12", padding: 8, alignItems: "center", gap: 6, opacity: pressed ? 0.8 : 1 })}
            >
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                <Text size={11} muted numberOfLines={1}>{d.weekday}</Text>
                <Text size={15} weight="700" color={numColor} style={{ fontVariant: ["tabular-nums"] }}>{d.day_num}</Text>
              </View>
              {/* ملصقُ الأوّل، وخلفه ملصقُ الثاني مائلاً حين يكون في اليوم أكثر من عمل — يُرى أنّ تحته غيرَه */}
              <View style={{ width: POSTER_W + 14, height: POSTER_H + 6, alignItems: "center", justifyContent: "flex-start" }}>
                {more ? poster(list[1], { position: "absolute", top: 6, start: 0, transform: [{ rotate: "-6deg" }], opacity: 0.85 }) : null}
                {poster(first, { position: "absolute", top: 0, end: more ? 0 : 7, borderWidth: more ? 2 : 0, borderColor: tokens.bg })}
              </View>
              <Text size={11} weight="700" numberOfLines={2} autoDir style={{ textAlign: "center", lineHeight: 14, minHeight: 28, alignSelf: "stretch" }}>{first.title}</Text>
              {more ? <Text size={11} weight="700" color={tokens.accent2} style={{ fontVariant: ["tabular-nums"] }}>{`+${list.length - 1}`}</Text> : null}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ورقةُ اليوم (D-1587) — صفوفُ التقويم نفسُها: ملصقٌ · الاسم · «حلقة جديدة» · › */}
      {sheetDay ? (
        <Sheet title={`${sheetDay.weekday} ${sheetDay.day_num}`} onClose={() => setSheetDay(null)}>
          <View style={{ gap: 8 }}>
            {(byDay.get(sheetDay.date) ?? []).map((e) => {
              const url = posterFor(e.poster_path ?? null, 36);
              return (
                <Pressable
                  key={`${e.show_id}-${e.date}`}
                  onPress={() => { setSheetDay(null); onDay(e.show_id); }}
                  accessibilityRole="link"
                  accessibilityLabel={e.title}
                  style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, padding: 8, opacity: pressed ? 0.7 : 1 })}
                >
                  <View style={{ width: 36, height: 54, borderRadius: 6, overflow: "hidden", backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
                    {url ? <Image source={{ uri: url }} style={{ width: 36, height: 54 }} contentFit="cover" /> : <Icon name="tv" size={16} color={tokens.muted} />}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text size={14} weight="500" numberOfLines={1} autoDir>{e.title}</Text>
                    <Text size={12} muted style={{ marginTop: 2 }}>{t.calEpisode}</Text>
                  </View>
                  <Text size={16} muted>›</Text>
                </Pressable>
              );
            })}
          </View>
        </Sheet>
      ) : null}
    </View>
  );
}
