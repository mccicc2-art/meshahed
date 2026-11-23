import React from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon } from "../icons";
import { Chevron } from "../settings/ui";
import { num } from "@/core/i18n";
import type { RateQueuePayload } from "@/core/rateQueue";

/**
 * ====== 🆕 T530 — «بانتظار تقييمك» في التطبيق: المفتاحُ والملخّصُ وسطرُ الباب ======
 *
 * 🔑 **المفتاحُ `me:rate-queue` لا تحت `me:ratings`**: كلُّ تقييمٍ يُبطل `me:ratings`، والقائمةُ حسابٌ ثقيلٌ على الخادم — فمن
 * قيّم ثلاثين عملاً متتاليةً كان سيُعيد حسابَها ثلاثين مرّة. الشاشةُ تُخرج ما قيّمه بيدها، وتُبطل المفتاحَ عند مغادرتها
 * فيتجدّد العددُ في الرئيسيّة و«تقييماتي» والمكتبة. «تخطَّ» و✕ البطاقة يُبطلانه من الخادم (`me:rate-queue`).
 */
export const RATE_QUEUE_KEY = ["me:rate-queue"] as const;
export const RATE_QUEUE_SUMMARY_KEY = [...RATE_QUEUE_KEY, "summary"] as const;

export function useRateQueueSummary(enabled = true) {
  return useQuery({
    queryKey: RATE_QUEUE_SUMMARY_KEY,
    queryFn: async () => (await api<RateQueuePayload>("/api/v1/me/rate-queue?summary=1")).data,
    staleTime: 60_000,
    enabled,
  });
}

/**
 * **سطرُ الباب** أعلى «تقييماتي» وفي المكتبة (أحمد «٢أ»): نجمةٌ في مربّعٍ مُلوَّن · الاسمُ وسطرُه · العددُ في حبّة · سهم.
 * يغيب إن لم ينتظر شيء — بابٌ إلى قائمةٍ فارغةٍ ضجيج.
 */
export function RateQueueEntry({ from, style }: { from: string; style?: object }) {
  const { t, tokens, locale } = useApp();
  const router = useRouter();
  const q = useRateQueueSummary();
  const total = q.data?.total ?? 0;
  if (!total) return null;
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/rate-queue", params: { from } })}
      accessibilityRole="link"
      accessibilityLabel={`${t.rateQueueTitle} ${total}`}
      style={({ pressed }) => [
        { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, opacity: pressed ? 0.75 : 1 },
        style,
      ]}
    >
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${tokens.accent}1F`, alignItems: "center", justifyContent: "center" }}>
        <Icon name="star" size={22} color={tokens.accent} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size={15} weight="700" numberOfLines={1}>{t.rateQueueTitle}</Text>
        <Text size={12} muted numberOfLines={1} style={{ marginTop: 2 }}>{t.rateQueueSub}</Text>
      </View>
      <View style={{ minWidth: 34, paddingHorizontal: 10, height: 26, borderRadius: 13, backgroundColor: tokens.accent, alignItems: "center", justifyContent: "center" }}>
        <Text size={13} weight="800" color={tokens.onAccent} style={{ fontVariant: ["tabular-nums"] }}>{num(total, locale)}</Text>
      </View>
      <Chevron />
    </Pressable>
  );
}
