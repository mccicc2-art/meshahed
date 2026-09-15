import React from "react";
import { useRouter } from "expo-router";
import { DiscoverScreen } from "../src/discover/DiscoverScreen";
import { ErrorBoundary } from "../src/ErrorBoundary";

/**
 * `/discover` — الشاشةُ الأصليّةُ الثانية (Phase 11-C · C1، D-955). تُدفع فوق
 * `/web` برسالة `native {route:"discover"}` من خانة «اكتشف» (للإدارة داخل
 * الغلاف)؛ الـWebView تبقى تحتها، والرجوعُ يعود إليها كما في المكتبة.
 * D-974 — وإن سقطت فصفحةُ `/news` الويبيّةُ بديلُها، لا شاشةٌ سوداء.
 */
export default function Discover() {
  const router = useRouter();
  return (
    <ErrorBoundary screen="discover" webPath="/news" onLeave={() => (router.canGoBack() ? router.back() : router.replace("/web"))}>
      <DiscoverScreen />
    </ErrorBoundary>
  );
}
