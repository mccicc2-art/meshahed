import React from "react";
import { useLocalSearchParams } from "expo-router";
import { StatsStory } from "../src/member/StatsStory";
import { ErrorBoundary } from "../src/ErrorBoundary";
import { originOf } from "../src/thread/route";

/** 🆕 قصّةُ «إحصائياتك» (ت٤ «ج») — تُفتح من الباب الواحد (`statsDoor`) أوّلَ مرّةٍ في الأسبوع، ومن «شاهد قصّتك»؛ و`scope=year` حصادُ السنة */
export default function StatsStoryRoute() {
  const { from, scope } = useLocalSearchParams<{ from?: string; scope?: string }>();
  return (
    <ErrorBoundary screen="profile">
      <StatsStory from={originOf(from)} scope={scope === "year" ? "year" : "all"} />
    </ErrorBoundary>
  );
}
