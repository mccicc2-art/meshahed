import React from "react";
import { useRouter } from "expo-router";
import { ErrorBoundary } from "../src/ErrorBoundary";
import { WelcomeScreen } from "../src/welcome/WelcomeScreen";

/**
 * `/welcome` — الترحيبُ الأصليّ (🆕 D-1347 · Phase 11-U · U1 المرحلة ٢). يُدفع فوق طبقة الويب لمن دخل ولم يُتمّ
 * (`WebLayer.showWelcome`: علامةُ «لم يُتمّ» كُتبت · الإقلاعُ والعلامةُ قائمة).
 * ⚖️ **سقوطُ الشاشة يكشف ترحيبَ الويب تحتها** (`/welcome` — الطبقةُ تُوجَّه إليه مع رفع هذه): البوّابةُ تبقى بوّابةً،
 * والعضوُ لا يعلق خارج حسابه بسبب عطلٍ في شاشة.
 */
export default function Welcome() {
  const router = useRouter();
  return (
    <ErrorBoundary screen="welcome" webPath="/welcome" onLeave={() => (router.canDismiss() ? router.dismissAll() : router.replace("/web"))}>
      <WelcomeScreen />
    </ErrorBoundary>
  );
}
