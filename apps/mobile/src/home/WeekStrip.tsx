import React, { useState } from "react";
import { Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useApp } from "../state";
import { Sheet } from "../library/Sheet";
import { posterFor } from "../poster";
import { haptic } from "../haptics";
import { Text } from "../ui";
import { Icon } from "../icons";
import { useFontScale } from "../fontScale";
import { PAGE_PAD } from "./Section";
import type { HomeWeekDay, HomeWeekEntry } from "../contracts";

/**
 * شريطُ الأسبوع — `WeekStrip.tsx` الويبيّة (Phase 11-H · H2): ١٤ يوماً يُمرَّر
 * (D-491)، سبعةٌ في الشاشة بفجوة ٤، اليومُ الأوّل بلون التمييز، خطٌّ تحت
 * الرقم (تمييز-٢ إن كانت حلقة)، واسمُ العمل أو `+ن`. العنوانُ بابُ التقويم
 * (D-378)، وسطرُ الوصف يلحق به «لا حلقات» حين يفرغ الأسبوعُ في سطرٍ واحد.
 * 🆕 D-1587 — **يومٌ بأكثر من عملٍ يقول أوّلَها** (أحمد ٣٠ أكتوبر: «إذا فيه فلمين في نفس اليوم يظهر رقم بدون أسماء» ثمّ «١أ»):
 * اسمُ الأوّل سطراً و`+ن` الباقي تحته، **وضغطتُه ورقةٌ بأعمال اليوم** («٢أ») — كانت تفتح الأوّلَ وحدَه فلا يُبلَغ الثاني من الشريط.
 */
export function WeekStrip({ days, entries, onDay, onCalendar }: { days: HomeWeekDay[]; entries: HomeWeekEntry[]; onDay: (showId: number) => void; onCalendar: () => void }) {
  const { t, tokens } = useApp();
  const { width } = useWindowDimensions();
  const [sheetDay, setSheetDay] = useState<HomeWeekDay | null>(null);
  /* D-1105 — سطرا العنوان محجوزان بارتفاعٍ ثابت (تتساوى الأيّامُ)؛ يكبر الحجزُ مع الخطّ فلا يُقصّ السطرُ الثاني */
  const k = useFontScale();
  const byDay = new Map<string, HomeWeekEntry[]>();
  for (const e of entries) {
    if (!byDay.has(e.date)) byDay.set(e.date, []);
    byDay.get(e.date)!.push(e);
  }
  const cellW = Math.floor((width - PAGE_PAD * 2 - 6 * 4) / 7);
  return (
    <View>
      <View style={{ paddingHorizontal: PAGE_PAD, flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Pressable onPress={onCalendar} accessibilityRole="link" style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 }}>
          <Icon name="calendar" size={18} color={tokens.muted} />
          <Text size={20} weight="700" numberOfLines={1} style={{ flexShrink: 1 }}>{t.weekTitle}</Text>
          <Text size={16} muted>›</Text>
        </Pressable>
        {/* D-1113 — الوصفُ سقط؛ سطرُ «لا حلقات هذا الأسبوع» وحدَه حين يفرغ الأسبوع (يفرّق الفراغَ عن التحميل).
            🆕 D-1428 — على سطر العنوان بعد السهم لا تحته (أحمد ١٦ أكتوبر بصورة: «خلها مثل الصورة في الصف الأول») */}
        {entries.length === 0 ? (
          <Text size={12} muted numberOfLines={1} style={{ flexShrink: 1 }}>{t.weekNothing}</Text>
        ) : null}
      </View>
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
              {list.length > 1 ? (
                /* الاسمُ سطرٌ واحد و«+ن» تحته في الحجز نفسِه — فتتساوى الخاناتُ ولا يقفز الصفّ */
                <View style={{ marginTop: 4, height: Math.ceil(24 * k), alignSelf: "stretch", alignItems: "center" }}>
                  <Text size={9} muted numberOfLines={1} style={{ lineHeight: 11, textAlign: "center" }}>{first.title}</Text>
                  <Text size={9} weight="700" color={tokens.accent2} style={{ lineHeight: 11 }}>{`+${list.length - 1}`}</Text>
                </View>
              ) : (
                <Text size={9} muted numberOfLines={2} style={{ marginTop: 4, lineHeight: 11, height: Math.ceil(24 * k), textAlign: "center" }}>{has ? first.title : ""}</Text>
              )}
            </>
          );
          const base = { width: cellW, borderRadius: 12, paddingHorizontal: 4, paddingVertical: 8, alignItems: "center" as const, borderWidth: 1 };
          return has ? (
            <Pressable key={d.date} onPress={() => { if (list.length > 1) { haptic.pick(); setSheetDay(d); } else onDay(first.show_id); }} accessibilityRole="link" accessibilityLabel={list.map((e) => e.title).join("، ")} style={({ pressed }) => [base, { borderColor: tokens.accent2 + "59", backgroundColor: tokens.accent2 + "0F", opacity: pressed ? 0.8 : 1 }]}>
              {body}
            </Pressable>
          ) : (
            <View key={d.date} style={[base, { borderColor: tokens.border, backgroundColor: tokens.surface, opacity: 0.6 }]}>{body}</View>
          );
        })}
      </ScrollView>

      {/* ورقةُ اليوم — صفوفُ التقويم نفسُها (ملصقٌ · الاسم · «حلقة جديدة» · ›)، والضغطةُ تغلقها وتفتح العمل */}
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
