import React from "react";
import { useLocalSearchParams } from "expo-router";
import { FullStatsScreen } from "../src/member/FullStatsScreen";
import { ErrorBoundary } from "../src/ErrorBoundary";
import { originOf } from "../src/thread/route";

/**
 * `/statistics` — «الإحصائيات الكاملة» أصليّةً (🆕 D-1367 · V-C · C5 · ب). 🆕 D-1586 — صارت «إحصائياتك» الواحدة (و`/reports` بابٌ ثانٍ
 * لها)؛ `p` يُمرَّر ولا يُقرأ: الشاشةُ تفتح على الشهر. وإن سقطت
 * فرسالةٌ و«حاول مجدداً» (V-B) — لا صفحةَ ويبٍ بديلة.
 */
export default function Statistics() {
  const { from, p } = useLocalSearchParams<{ from?: string; p?: string }>();
  const initial = p === "week" || p === "month" || p === "year" || p === "all" ? p : undefined;
  return (
    <ErrorBoundary screen="profile">
      <FullStatsScreen from={originOf(from)} initial={initial} />
    </ErrorBoundary>
  );
}
