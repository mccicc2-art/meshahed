import React from "react";
import { useLocalSearchParams } from "expo-router";
import { FullStatsScreen } from "../src/member/FullStatsScreen";
import { ErrorBoundary } from "../src/ErrorBoundary";
import { originOf } from "../src/thread/route";

/**
 * `/reports` — بابُ «إحصائياتك» (🆕 D-1586: «تقريرك» صار قسمَ «ملخص» فيها، أحمد ٣٠ أكتوبر: «صفحة وحدة وما نشتت المستخدم»).
 * كان «تقريرك» أصليّاً (D-1366)؛ الآن الشاشةُ الواحدةُ نفسُها التي يفتحها `/statistics` — فالروابطُ القديمة (صفُّ «تقاريرك» في
 * الإحصائيات، والقائمةُ الجانبيّة) تصل ولا تنكسر. وإن سقطت فرسالةٌ و«حاول مجدداً» (V-B) — لا صفحةَ ويبٍ بديلة.
 */
export default function Reports() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  return (
    <ErrorBoundary screen="profile">
      <FullStatsScreen from={originOf(from)} />
    </ErrorBoundary>
  );
}
