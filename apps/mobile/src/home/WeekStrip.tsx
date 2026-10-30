import React from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { useApp } from "../state";
import { posterFor } from "../poster";
import { Text } from "../ui";
import { Icon } from "../icons";
import { PAGE_PAD } from "./Section";
import type { HomeWeekDay, HomeWeekEntry } from "../contracts";

/**
 * شريطُ الأسبوع — `WeekStrip.tsx` الويبيّة (Phase 11-H · H2) في أصله: ١٤ يوماً (D-491)، العنوانُ بابُ التقويم (D-378)، وسطرُ
 * «لا حلقات» على سطر العنوان حين يفرغ الأسبوع (D-1428).
 * 🆕 D-1587 — يومٌ بأكثر من عملٍ قال أوّلَها و«+ن»، وضغطتُه ورقةُ أعمال اليوم.
 * 🆕 D-1590 — **بطاقاتُ القادم بدل خانات الأيّام** (أحمد ٣٠ أكتوبر: «المربعات صغيرة واسم الفلم ماهو ظاهر بوضوح — نبتكر شي أفضل»
 * ثمّ «ب» على التصميم): سبعُ خاناتٍ بعرض الشاشة تعطي كلَّ يومٍ نحو ٥٠ نقطة — لا يتّسع لاسم. الآن **بطاقةٌ لكلِّ حلقةٍ قادمة**:
 * ملصقٌ ٢:٣ وفوقه شارةُ اليوم («السبت ٣١»)، والاسمُ كاملاً على سطرين تحته، و«حلقة جديدة». الأيّامُ الفارغةُ لا تُرسم (الشارةُ تقول
 * متى)، وأقربُ يومٍ فيه شيءٌ شارتُه بلون التمييز-٢. ضغطةُ البطاقة تفتح عملَها — فلا ورقةَ يوم: كلُّ عملٍ بطاقتُه.
 */
const CARD_W = 116;
const POSTER_H = Math.round(CARD_W * 1.5);

export function WeekStrip({ days, entries, onDay, onCalendar }: { days: HomeWeekDay[]; entries: HomeWeekEntry[]; onDay: (showId: number) => void; onCalendar: () => void }) {
  const { t, tokens } = useApp();
  /* اسمُ اليوم ورقمُه من صفِّ الأيّام نفسِه (`weekday` · `day_num` من الخادم بلغته) — البطاقاتُ بترتيب الأيّام */
  const dayOf = new Map(days.map((d) => [d.date, d] as const));
  const order = new Map(days.map((d, i) => [d.date, i] as const));
  const cards = [...entries].sort((a, b) => (order.get(a.date) ?? 99) - (order.get(b.date) ?? 99));
  const nearest = cards[0]?.date;
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
      {cards.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={CARD_W + 10} decelerationRate="fast" contentContainerStyle={{ paddingHorizontal: PAGE_PAD, gap: 10 }}>
          {cards.map((e) => {
            const d = dayOf.get(e.date);
            const url = posterFor(e.poster_path ?? null, CARD_W);
            const near = e.date === nearest;
            const badge = d ? `${d.weekday} ${d.day_num}` : e.date.slice(5);
            return (
              <Pressable
                key={`${e.show_id}-${e.date}`}
                onPress={() => onDay(e.show_id)}
                accessibilityRole="link"
                accessibilityLabel={`${e.title} · ${badge}`}
                style={({ pressed }) => ({ width: CARD_W, opacity: pressed ? 0.8 : 1 })}
              >
                <View style={{ width: CARD_W, height: POSTER_H, borderRadius: 12, overflow: "hidden", backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
                  {url ? <Image source={{ uri: url }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" /> : <Icon name="tv" size={22} color={tokens.muted} />}
                  {/* شارةُ اليوم — على الملصق في بداية السطر: الأقربُ بلون التمييز-٢ وحبرُه داكن، والباقي داكنةٌ شفيفةٌ تُقرأ فوق أيّ صورة */}
                  <View style={{ position: "absolute", top: 8, start: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: near ? tokens.accent2 : "rgba(0,0,0,0.65)" }}>
                    <Text size={11} weight="700" color={near ? "#111111" : "#FFFFFF"} numberOfLines={1}>{badge}</Text>
                  </View>
                </View>
                <Text size={13} weight="700" numberOfLines={2} autoDir style={{ marginTop: 8, lineHeight: 18, minHeight: 36 }}>{e.title}</Text>
                <Text size={11} muted numberOfLines={1}>{t.calEpisode}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}
