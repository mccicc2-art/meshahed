import React, { useId, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
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
 * 🆕 D-1591 → D-1593 — **اليومُ بطاقةٌ تتّسع بعدد أعماله** (أحمد ٣٠ أكتوبر: «كارد اليوم يكبر عرضه حسب عدد الأفلام، واسم الفلم
 * داخل الكارد تحت بحيث ارتفاعه يقل» — «١ أ ٢ أ»): ملصقٌ لكلّ عمل جنباً إلى جنب، **والاسمُ على أسفل ملصقه فوق تدرّجٍ داكن**
 * فلا سطرَ للاسم ولا سطرَ لـ«+ن» تحته — الفراغُ الذي كان بينهما هو ما رآه أحمد. ثلاثةُ ملصقاتٍ حدٌّ، والرابعُ خانةُ «+ن»
 * تفتح ورقةَ اليوم (D-1587)؛ وكلُّ ملصقٍ يفتح عملَه مباشرة. الفارغُ يضيق ويبهت كما كان.
 * 🆕 T323 — **اسمُ اليوم فوق رقمه بجانب الملصقات، والملصقُ يبدأ من أعلى البطاقة** (خالد ٥ نوفمبر بصورتين على لقطته — عملٌ واحد
 * وعملان — «نفذ»): سطرُ «السبت ٧» فوق الملصق كان يأخذ ٢٠ نقطةً و٤ فجوةً من ارتفاع الشريط كلِّه، ١٢٢ ⇐ ٩٨. صار عموداً بعد آخر
 * ملصق (يمينَه في الإنجليزيّة، يسارَه في العربيّة لأنّ الصفَّ ينقلب) — بترتيب اليوم الفارغ نفسِه: الاسمُ فوق والرقمُ تحته وعلى
 * حشوته العليا نفسِها، فتقرأ الأيّامُ كلُّها على خطٍّ واحد. الثمن: البطاقةُ أعرضُ بنحو ٢٢ نقطة، والارتفاعُ لا يتغيّر بعدد الأعمال.
 */
const NARROW = 44;
/* 🆕 D-1615 — **الشريطُ أقصر بنحو ٢٠٪** (أحمد ١ نوفمبر بلقطة الرئيسيّة: «تقليل ارتفاع الأسبوع بنحو 20٪»): الملصقُ هو ما يحدّد
   ارتفاعَ الصفّ كلِّه (والأيّامُ الفارغةُ تتمدّد إليه) — ٧٢×١٠٨ ⇐ ٥٦×٨٤ بالنسبة نفسِها، والحشوةُ ٨ ⇐ ٦ والفجوةُ ٦ ⇐ ٤:
   ١٥١ ⇐ ~١٢٢ نقطة. واسمُ العمل على ملصقه ١٠ ⇐ ٩ ليتّسع في العرض الأضيق */
const POSTER_W = 56;
const POSTER_H = 84;
const DAY_PAD = 6;
const MAX_POSTERS = 3;
const ROW_LH = 20;

export function WeekStrip({ days, entries, expectedLabel, onDay, onCalendar }: { days: HomeWeekDay[]; entries: HomeWeekEntry[]; expectedLabel?: string; onDay: (showId: number) => void; onCalendar: () => void }) {
  const { t, tokens } = useApp();
  const [sheetDay, setSheetDay] = useState<HomeWeekDay | null>(null);
  const gradId = `wk${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const byDay = new Map<string, HomeWeekEntry[]>();
  for (const e of entries) {
    if (!byDay.has(e.date)) byDay.set(e.date, []);
    byDay.get(e.date)!.push(e);
  }
  const tile = { width: POSTER_W, height: POSTER_H, borderRadius: 8, overflow: "hidden" as const, backgroundColor: tokens.surface2, alignItems: "center" as const, justifyContent: "center" as const };
  return (
    <View>
      <View style={{ paddingHorizontal: PAGE_PAD, flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
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
          const numColor = i === 0 ? tokens.accent : tokens.fg;
          if (list.length === 0) {
            /* اليومُ الفارغ ضيّقٌ باهت: اسمُه ورقمُه فقط — الفراغُ معلومة (D-491) ولا يأخذ عرضاً */
            return (
              <View key={d.date} style={{ width: NARROW, borderRadius: 12, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, paddingVertical: DAY_PAD, alignItems: "center", gap: 4, opacity: 0.7 }}>
                <Text size={10} muted numberOfLines={1}>{d.weekday}</Text>
                <Text size={14} weight="700" color={numColor} style={{ fontVariant: ["tabular-nums"] }}>{d.day_num}</Text>
              </View>
            );
          }
          const shown = list.length > MAX_POSTERS + 1 ? list.slice(0, MAX_POSTERS) : list;
          const rest = list.length - shown.length;
          /* 🆕 D-1614 — يومٌ كلُّ ما فيه متوقَّعٌ (لا معلَن): إطارٌ متقطّعٌ بلا تعبئة، والملصقُ المتوقَّعُ باهت — «على الأرجح» لا «أكيد» */
          const guess = list.every((e) => e.expected);
          return (
            <View key={d.date} style={{ flexDirection: "row", alignItems: "flex-start", gap: 6, borderRadius: 14, borderWidth: 1, borderColor: tokens.accent2 + (guess ? "4D" : "8C"), borderStyle: guess ? "dashed" : "solid", backgroundColor: guess ? "transparent" : tokens.accent2 + "12", padding: DAY_PAD }}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {shown.map((e, k) => {
                  const url = posterFor(e.poster_path ?? null, POSTER_W);
                  return (
                    <Pressable
                      key={`${e.show_id}-${k}`}
                      onPress={() => onDay(e.show_id)}
                      accessibilityRole="link"
                      accessibilityLabel={`${d.weekday} ${d.day_num} · ${e.title}`}
                      style={({ pressed }) => [tile, { opacity: pressed ? 0.8 : e.expected ? 0.5 : 1 }]}
                    >
                      {url ? <Image source={{ uri: url }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" /> : <Icon name="tv" size={18} color={tokens.muted} />}
                      {/* الاسمُ على أسفل الملصق — تدرّجٌ داكنٌ ثابتٌ في السمتين لأنّ النصَّ فوق صورةٍ لا فوق السطح */}
                      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: POSTER_H * 0.55 }}>
                        <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 1 1">
                          <Defs>
                            <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                              <Stop offset="0" stopColor="#000" stopOpacity={0} />
                              <Stop offset="1" stopColor="#000" stopOpacity={0.88} />
                            </LinearGradient>
                          </Defs>
                          <Rect x="0" y="0" width="1" height="1" fill={`url(#${gradId})`} />
                        </Svg>
                      </View>
                      <Text size={9} weight="700" color="#fff" numberOfLines={2} autoDir style={{ position: "absolute", left: 3, right: 3, bottom: 4, textAlign: "center", lineHeight: 11 }}>{e.title}</Text>
                    </Pressable>
                  );
                })}
                {rest > 0 ? (
                  <Pressable
                    onPress={() => { haptic.pick(); setSheetDay(d); }}
                    accessibilityRole="button"
                    accessibilityLabel={`${d.weekday} ${d.day_num} · +${rest}`}
                    style={({ pressed }) => [tile, { borderWidth: 1, borderColor: tokens.accent2 + "8C", opacity: pressed ? 0.8 : 1 }]}
                  >
                    <Text size={16} weight="700" color={tokens.accent2} style={{ fontVariant: ["tabular-nums"] }}>{`+${rest}`}</Text>
                  </Pressable>
                ) : null}
              </View>
              {/* T323 — عمودُ اليوم بعد الملصقات: الاسمُ فوق الرقم، لا سطرٌ فوقها */}
              <View style={{ alignItems: "center", gap: 2, minWidth: 22 }}>
                <Text size={12} muted numberOfLines={1} style={{ lineHeight: ROW_LH }}>{d.weekday}</Text>
                <Text size={15} weight="700" color={numColor} style={{ lineHeight: ROW_LH, fontVariant: ["tabular-nums"] }}>{d.day_num}</Text>
              </View>
            </View>
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
                  style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, borderWidth: 1, borderColor: tokens.border, borderStyle: e.expected ? "dashed" : "solid", backgroundColor: tokens.surface, padding: 8, opacity: pressed ? 0.5 : e.expected ? 0.6 : 1 })}
                >
                  <View style={{ width: 36, height: 54, borderRadius: 6, overflow: "hidden", backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
                    {url ? <Image source={{ uri: url }} style={{ width: 36, height: 54 }} contentFit="cover" /> : <Icon name="tv" size={16} color={tokens.muted} />}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text size={14} weight="500" numberOfLines={1} autoDir>{e.title}</Text>
                    <Text size={12} muted style={{ marginTop: 2 }}>{e.expected ? (expectedLabel ?? t.calEpisode) : t.calEpisode}</Text>
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
