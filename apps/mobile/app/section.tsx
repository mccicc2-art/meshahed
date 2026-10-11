import React from "react";
import { useLocalSearchParams } from "expo-router";
import { SectionScreen } from "../src/discover/SectionScreen";
import { ErrorBoundary } from "../src/ErrorBoundary";

/** D-1046 — «الكلّ ←» شاشةٌ كاملة. V-B (D-1356) — وإن سقطت فرسالةٌ و«حاول مجدداً» يعيد تركيبَها؛ لا صفحةَ ويبٍ بديلة */
export default function Section() {
  const { title, query } = useLocalSearchParams<{ title: string; query: string }>();
  return (
    <ErrorBoundary screen="discover">
      <SectionScreen title={String(title ?? "")} query={String(query ?? "")} />
    </ErrorBoundary>
  );
}
