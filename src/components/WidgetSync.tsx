"use client";

import { useEffect } from "react";

/**
 * 🆕 **جسرُ ودجت أندرويد** (D-929) — يرسل لقطةَ «أكمل المشاهدة» إلى الغلاف
 * الهجين، والغلافُ يكتبها ملفّاً يقرؤه `LoopzWidget.kt`.
 *
 * 🔑 **ولماذا لقطةٌ لا نداءٌ من الودجت؟** لأنّ الغلافَ **لا يملك جلسةً**:
 * بعد D-922 يسلّمها للـWebView ويمسح نسختَه — **فودجتٌ تنادي `/api/v1`
 * تحتاج رمزاً ثانياً يتنازع مع الويب على التجديد**، وهو العطلُ الذي بُني
 * D-922 لتفاديه. اللقطةُ تجعل الودجتَ بلا مصادقةٍ ولا شبكةٍ أصلاً.
 *
 * ⚖️ **ولا يُرسَل شيءٌ في المتصفّح**: الجسرُ لا يزرعه إلا الغلاف، فالمكوّنُ
 * لا شيءَ خارجَه (ولا يرسم شيئاً في الحالين).
 */
declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (data: string) => void };
  }
}

export type WidgetItem = { t: string; s: string | null };

export function WidgetSync({ items }: { items: WidgetItem[] }) {
  useEffect(() => {
    const bridge = typeof window !== "undefined" ? window.ReactNativeWebView : undefined;
    if (!bridge) return;
    try {
      bridge.postMessage(JSON.stringify({ type: "widget", items: items.slice(0, 3) }));
    } catch {
      /* الفشلُ صمتٌ: ودجتٌ قديمةٌ خيرٌ من شاشةٍ تسقط */
    }
  }, [items]);
  return null;
}
