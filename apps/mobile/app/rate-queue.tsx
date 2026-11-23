import React from "react";
import { useLocalSearchParams } from "expo-router";
import { RateQueueScreen } from "../src/member/RateQueueScreen";
import { ErrorBoundary } from "../src/ErrorBoundary";
import { originOf } from "../src/thread/route";

/**
 * `/rate-queue` — 🆕 T530 «بانتظار تقييمك» أصليّاً: من سطرِ «تقييماتي» والمكتبة، وبطاقةِ الرئيسيّة، والإشعارِ الأسبوعيّ
 * (`/ratings/pending` في الويب ⇐ هنا، `useDoors.openPath`).
 */
export default function RateQueue() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  return (
    <ErrorBoundary screen="profile">
      <RateQueueScreen from={originOf(from)} />
    </ErrorBoundary>
  );
}
