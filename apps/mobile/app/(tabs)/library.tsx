import React from "react";
import { LibraryScreen } from "../../src/library/LibraryScreen";
import { ErrorBoundary } from "../../src/ErrorBoundary";

/**
 * `/library` — الشاشةُ الأصليّةُ الأولى (Phase 11 · B1، D-936). تُدفع فوق `/web`
 * برسالة `native {route:"library"}`؛ الـWebView تبقى تحتها.
 * V-B (D-1356) — وإن سقطت فرسالةٌ و«حاول مجدداً» يعيد تركيبَها؛ لا صفحةَ ويبٍ بديلة.
 */
export default function Library() {
  return (
    <ErrorBoundary screen="library" root="/library">
      <LibraryScreen />
    </ErrorBoundary>
  );
}
