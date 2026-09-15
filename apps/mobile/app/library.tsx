import React from "react";
import { useRouter } from "expo-router";
import { LibraryScreen } from "../src/library/LibraryScreen";
import { ErrorBoundary } from "../src/ErrorBoundary";

/**
 * `/library` — الشاشةُ الأصليّةُ الأولى (Phase 11 · B1، D-936). تُدفع فوق `/web`
 * برسالة `native {route:"library"}`؛ الـWebView تبقى تحتها.
 * D-974 — وإن سقطت فصفحةُ `/library` الويبيّةُ بديلُها، لا شاشةٌ سوداء.
 */
export default function Library() {
  const router = useRouter();
  return (
    <ErrorBoundary screen="library" webPath="/library" onLeave={() => (router.canGoBack() ? router.back() : router.replace("/web"))}>
      <LibraryScreen />
    </ErrorBoundary>
  );
}
