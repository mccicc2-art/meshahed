"use client";

import { useEffect } from "react";

/**
 * 🆕 D-1150 — **صفحةُ الترحيب تُعلن نفسَها للغلاف** (تسجيلُ أحمد، ٢٧ سبتمبر: بعد الدخول رئيسيّةٌ بلا شريط).
 *
 * D-1148 أخفى الشريطَ الأصليَّ على `/` لمن «لم يدخل» بحكم التطبيق (`session.seen()`) — **والتطبيقُ لا يعرف
 * يقيناً**: بعد الدخول تُرسم الرئيسيّةُ قبل أن يصل أوّلُ رمز، ومن لم يصله رمزٌ عبر الجسر قطّ يُحكم عليه «زائراً»
 * وهو مسجَّل. **الصفحةُ وحدَها تعرف**: هذا المكوّنُ يُركَّب في بطل الترحيب وحدَه، فيرسل «أنا العتبة» عند
 * التركيب و«غادرتُ» عند الفكّ — والغلافُ يخفي شريطَه ما دامت العتبةُ ظاهرةً لا أكثر. خارجَ الغلاف لا شيء.
 */
export function AppGateSignal() {
  useEffect(() => {
    const rn = (window as { ReactNativeWebView?: { postMessage: (s: string) => void } }).ReactNativeWebView;
    if (!rn) return;
    try {
      rn.postMessage(JSON.stringify({ type: "gate", on: true }));
    } catch {
      /* الجسرُ غاب — الشريطُ يبقى كما هو */
    }
    return () => {
      try {
        rn.postMessage(JSON.stringify({ type: "gate", on: false }));
      } catch {
        /* لا شيء */
      }
    };
  }, []);
  return null;
}
