import React from "react";
import { useRouter } from "expo-router";
import { HomeScreen } from "../src/home/HomeScreen";
import { ErrorBoundary } from "../src/ErrorBoundary";

/**
 * `/home` — الرئيسيةُ الأصليّة (Phase 11-H، D-1066). تُدفع فوق `/web` من خانة
 * «الرئيسيّة» في الشريط أو برسالة `native {route:"home"}`؛ الـWebView تبقى تحتها.
 * D-974 — وإن سقطت فالرئيسيةُ الويبيّة (`/`) بديلُها، لا شاشةٌ سوداء.
 */
export default function Home() {
  const router = useRouter();
  return (
    <ErrorBoundary screen="home" webPath="/" onLeave={() => (router.canGoBack() ? router.back() : router.replace("/web"))}>
      <HomeScreen />
    </ErrorBoundary>
  );
}
