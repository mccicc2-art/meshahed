import React from "react";
import { SearchScreen } from "../../src/search/SearchScreen";
import { ErrorBoundary } from "../../src/ErrorBoundary";

/**
 * `/search` — البحثُ أصليّاً (Phase 11-G · G1). يُدفع فوق `/web` من خانة «بحث» في الشريط
 * الأصليّ ومن رسالة `native {route:"search"}`؛ الـWebView تبقى تحته والرجوعُ يعود إليها.
 * V-B (D-1356) — وإن سقطت فرسالةٌ و«حاول مجدداً» يعيد تركيبَها؛ لا صفحةَ ويبٍ بديلة.
 */
export default function Search() {
  return (
    <ErrorBoundary screen="search" root="/search">
      <SearchScreen />
    </ErrorBoundary>
  );
}
