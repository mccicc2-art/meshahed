import React from "react";
import { useRouter } from "expo-router";
import { SearchScreen } from "../src/search/SearchScreen";
import { ErrorBoundary } from "../src/ErrorBoundary";

/**
 * `/search` — البحثُ أصليّاً (Phase 11-G · G1). يُدفع فوق `/web` من خانة «بحث» في الشريط
 * الأصليّ ومن رسالة `native {route:"search"}`؛ الـWebView تبقى تحته والرجوعُ يعود إليها.
 * D-974 — وإن سقط فصفحةُ `/search` الويبيّةُ بديلُه، لا شاشةٌ سوداء.
 */
export default function Search() {
  const router = useRouter();
  return (
    <ErrorBoundary screen="search" webPath="/search" onLeave={() => (router.canGoBack() ? router.back() : router.replace("/web"))}>
      <SearchScreen />
    </ErrorBoundary>
  );
}
