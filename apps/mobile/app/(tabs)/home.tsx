import React from "react";
import { HomeScreen } from "../../src/home/HomeScreen";
import { ErrorBoundary } from "../../src/ErrorBoundary";

/**
 * `/home` — الرئيسيةُ الأصليّة (Phase 11-H، D-1066). تُدفع فوق `/web` من خانة
 * «الرئيسيّة» في الشريط أو برسالة `native {route:"home"}`؛ الـWebView تبقى تحتها.
 * V-B (D-1356) — وإن سقطت فرسالةٌ و«حاول مجدداً» يعيد تركيبَها؛ لا صفحةَ ويبٍ بديلة.
 */
export default function Home() {
  return (
    <ErrorBoundary screen="home" root="/home">
      <HomeScreen />
    </ErrorBoundary>
  );
}
