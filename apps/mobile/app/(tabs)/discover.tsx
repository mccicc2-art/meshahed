import React from "react";
import { DiscoverScreen } from "../../src/discover/DiscoverScreen";
import { ErrorBoundary } from "../../src/ErrorBoundary";

/**
 * `/discover` — الشاشةُ الأصليّةُ الثانية (Phase 11-C · C1، D-955). تُدفع فوق
 * `/web` برسالة `native {route:"discover"}` من خانة «اكتشف» (للإدارة داخل
 * الغلاف)؛ الـWebView تبقى تحتها، والرجوعُ يعود إليها كما في المكتبة.
 * V-B (D-1356) — وإن سقطت فرسالةٌ و«حاول مجدداً» يعيد تركيبَها؛ لا صفحةَ ويبٍ بديلة.
 */
export default function Discover() {
  return (
    <ErrorBoundary screen="discover" root="/discover">
      <DiscoverScreen />
    </ErrorBoundary>
  );
}
