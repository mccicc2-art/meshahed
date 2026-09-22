import React from "react";
import { Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon } from "../icons";
import { PAGE_PAD } from "./Section";
import type { HomeWeekDay, HomeWeekEntry } from "../contracts";

/**
 * شريطُ الأسبوع — `WeekStrip.tsx` الويبيّة (Phase 11-H · H2): ١٤ يوماً يُمرَّر
 * (D-491)، سبعةٌ في الشاشة بفجوة ٤، اليومُ الأوّل بلون التمييز، خطٌّ تحت
 * الرقم (تمييز-٢ إن كانت حلقة)، واسمُ العمل أو `+ن`. العنوانُ بابُ التقويم
 * (D-378)، وسطرُ الوصف يلحق به «لا حلقات» حين يفرغ الأسبوعُ في سطرٍ واحد.
 */
export function WeekStrip({ days, entries, onDay, onCalendar }: { days: HomeWeekDay[]; entries: HomeWeekEntry[]; onDay: (showId: number) => void; onCalendar: () => void }) {
  const { t, tokens } = useApp();
  const { width } = useWindowDimensions();
  const byDay = new Map<string, HomeWeekEntry[]>();
  for (const e of entries) {
    if (!byDay.has(e.date)) byDay.set(e.date, []);
    byDay.get(e.date)!.push(e);
  }
  const cellW = Math.floor((width - PAGE_PAD * 2 - 6 * 4) / 7);
  return (
    <View>
      <View style={{ paddingHorizontal: PAGE_PAD, flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 }}>
        <Pressable onPress={onCalendar} accessibilityRole="link" style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 }}>
          <Icon name="calendar" size={18} color={tokens.muted} />
          <Text size={22} weight="700" numberOfLines={1} style={{ flexShrink: 1 }}>{t.weekTitle}</Text>
          <Text size={16} muted>›</Text>
        </Pressable>
      </View>
      <Text size={12} muted style={{ paddingHorizontal: PAGE_PAD, marginBottom: 12 }}>
        {entries.length === 0 ? `${t.weekSub} ${t.weekNothing}` : t.weekSub}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={cellW + 4} decelerationRate="fast" contentContainerStyle={{ paddingHorizontal: PAGE_PAD, gap: 4 }}>
        {days.map((d, i) => {
          const list = byDay.get(d.date) ?? [];
          const has = list.length > 0;
          const first = list[0];
          const body = (
            <>
              <Text size={10} muted style={{ lineHeight: 12 }}>{d.weekday}</Text>
              <Text size={14} weight="700" color={i === 0 ? tokens.accent : tokens.fg} style={{ marginTop: 4, lineHeight: 16 }}>{d.day_num}</Text>
              <View style={{ marginTop: 6, height: 4, borderRadius: 2, alignSelf: "stretch", backgroundColor: has ? tokens.accent2 : tokens.border }} />
              <Text size={9} muted numberOfLines={2} style={{ marginTop: 4, lineHeight: 11, height: 24, textAlign: "center" }}>{has ? (list.length > 1 ? `+${list.length}` : first.title) : ""}</Text>
            </>
          );
          const base = { width: cellW, borderRadius: 12, paddingHorizontal: 4, paddingVertical: 8, alignItems: "center" as const, borderWidth: 1 };
          return has ? (
            <Pressable key={d.date} onPress={() => onDay(first.show_id)} accessibilityRole="link" accessibilityLabel={list.map((e) => e.title).join("، ")} style={({ pressed }) => [base, { borderColor: tokens.accent2 + "59", backgroundColor: tokens.accent2 + "0F", opacity: pressed ? 0.8 : 1 }]}>
              {body}
            </Pressable>
          ) : (
            <View key={d.date} style={[base, { borderColor: tokens.border, backgroundColor: tokens.surface, opacity: 0.6 }]}>{body}</View>
          );
        })}
      </ScrollView>
    </View>
  );
}
