import React from "react";
import { SignInScreen } from "../src/signin/SignInScreen";

/**
 * `/sign-in` — شاشةُ الدخول الأصليّة (🆕 D-1344 · Phase 11-U · U1). تُدفع فوق طبقة الويب لمن لم يدخل
 * (`WebLayer.showSignIn`: الإقلاعُ بلا أثرِ جلسة · الخروج · صفحةُ دخول الويب في التاريخ).
 * ⚖️ بلا `ErrorBoundary` يسقط إلى الويب: صفحةُ دخول الويب تحتها هي ما نُخرج المستخدمَ منه.
 */
export default function SignIn() {
  return <SignInScreen />;
}
