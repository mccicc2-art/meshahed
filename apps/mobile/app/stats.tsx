import React from "react";
import { useLocalSearchParams } from "expo-router";
import { StatsScreen } from "../src/member/StatsScreen";
import { ErrorBoundary } from "../src/ErrorBoundary";
import { originOf } from "../src/thread/route";

/**
 * `/stats` — إحصائياتي أنا أصليّةً (🆕 D-1214). تُدفع من خانة «الإحصائيات» في المكتبة وبطاقةِ أرقام الرئيسيّة وملفّي —
 * **الشاشةُ شاشةُ إحصاءات العضو نفسُها بلا `username`** (الوجهُ واحدٌ في الويب — D-145). V-B (D-1356) — وإن سقطت فرسالةٌ و«حاول مجدداً» يعيد تركيبَها؛ لا صفحةَ ويبٍ بديلة.
 */
export default function MyStats() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const origin = originOf(from);
  return (
    <ErrorBoundary screen="profile">
      <StatsScreen from={origin} />
    </ErrorBoundary>
  );
}
