import React from "react";
import { useLocalSearchParams } from "expo-router";
import { ErrorBoundary } from "../../src/ErrorBoundary";
import { LegalScreen } from "../../src/settings/LegalScreen";

/**
 * `/legal/[doc]` — الخصوصيّةُ والشروطُ أصليّتين («لا ويب في التطبيق» ٢). **مسارٌ مستقلٌّ لا قسمٌ في الإعدادات**: شاشةُ الدخول
 * تفتحه قبل أيِّ جلسة، و«عن Loopz» بعدها — شاشةٌ واحدةٌ للبابين.
 */
export default function Legal() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  return (
    <ErrorBoundary screen="settings">
      <LegalScreen doc={doc === "terms" ? "terms" : "privacy"} />
    </ErrorBoundary>
  );
}
