import React from "react";
import { useLocalSearchParams } from "expo-router";
import { RatingsScreen } from "../src/member/RatingsScreen";
import { ErrorBoundary } from "../src/ErrorBoundary";
import { originOf } from "../src/thread/route";

/**
 * `/ratings` — «تقييماتي» أصليّاً (🆕 D-1357 · V-C · C1). يُدفع من عنوان «التقييمات — من الأعلى» و«الكلّ» في الرئيسيّة.
 * وإن سقطت فرسالةٌ و«حاول مجدداً» يعيد تركيبَها (V-B، D-1356)؛ لا صفحةَ ويبٍ بديلة.
 */
export default function Ratings() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const origin = originOf(from);
  return (
    <ErrorBoundary screen="profile">
      <RatingsScreen from={origin} />
    </ErrorBoundary>
  );
}
