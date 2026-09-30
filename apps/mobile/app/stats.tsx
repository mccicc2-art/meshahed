import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatsScreen } from "../src/member/StatsScreen";
import { ErrorBoundary } from "../src/ErrorBoundary";
import { originOf } from "../src/thread/route";

/**
 * `/stats` — إحصائياتي أنا أصليّةً (🆕 D-1214). تُدفع من خانة «الإحصائيات» في المكتبة وبطاقةِ أرقام الرئيسيّة وملفّي —
 * **الشاشةُ شاشةُ إحصاءات العضو نفسُها بلا `username`** (الوجهُ واحدٌ في الويب — D-145). والحارسُ (D-974) يفتح الصفحةَ الويبيّةَ
 * إن سقطت الشاشة.
 */
export default function MyStats() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const origin = originOf(from);
  return (
    <ErrorBoundary
      screen="profile"
      webPath="/stats"
      returnTo={origin === "web" ? undefined : origin}
      onLeave={() => (router.canDismiss() ? router.dismissAll() : router.replace("/web"))}
    >
      <StatsScreen from={origin} />
    </ErrorBoundary>
  );
}
