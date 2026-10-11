import React from "react";
import { useLocalSearchParams } from "expo-router";
import { CalendarScreen } from "../src/home/CalendarScreen";
import { ErrorBoundary } from "../src/ErrorBoundary";
import { originOf } from "../src/thread/route";

/**
 * `/calendar` — تقويمُ أعمالك أصليّاً (🆕 D-1317). يُدفع من عنوان شريط الأسبوع في الرئيسيّة.
 * V-B (D-1356) — وإن سقطت فرسالةٌ و«حاول مجدداً» يعيد تركيبَها؛ لا صفحةَ ويبٍ بديلة.
 */
export default function Calendar() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const origin = originOf(from);
  return (
    <ErrorBoundary screen="home">
      <CalendarScreen from={origin} />
    </ErrorBoundary>
  );
}
