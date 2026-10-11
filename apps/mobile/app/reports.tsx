import React from "react";
import { useLocalSearchParams } from "expo-router";
import { ReportScreen } from "../src/member/ReportScreen";
import { ErrorBoundary } from "../src/ErrorBoundary";
import { originOf } from "../src/thread/route";

/**
 * `/reports` — «تقريرك» أصليّاً (🆕 D-1366 · V-C · C5). يُدفع من صفّ «تقاريرك» في شاشة الإحصائيات. وإن سقط فرسالةٌ و«حاول
 * مجدداً» (V-B) — لا صفحةَ ويبٍ بديلة.
 */
export default function Reports() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  return (
    <ErrorBoundary screen="profile">
      <ReportScreen from={originOf(from)} />
    </ErrorBoundary>
  );
}
