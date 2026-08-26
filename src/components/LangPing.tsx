"use client";

import { useEffect } from "react";

/**
 * 🆕 **نبضةُ لغةٍ واحدةٌ في الجلسة** (D-666) — **لا ترسم شيئاً ولا
 * ترسل شيئاً.**
 *
 * 🔑 **ولماذا مكوّنٌ في التخطيط لا سطرٌ في كلِّ صفحة**: السؤالُ «من
 * يزورنا» سؤالُ التطبيق كلِّه — **وثلاثةُ مواضعَ لسؤالٍ واحد تفترق**
 * (D-145).
 *
 * ⚠️ **والحارسُ `sessionStorage` لا `localStorage`**: **العدُّ عدُّ
 * زياراتٍ لا أشخاص** — **وعلامةٌ دائمةٌ تجعل الزائرَ يُعدّ مرّةً في
 * عمره فتموت السلسلةُ الزمنيّة.** ⚠️ **وإن رمى المخزنُ استثناءً**
 * (تصفّحٌ خاصٌّ في بعض المتصفّحات) **تُلغى النبضةُ ولا تُكرَّر**:
 * **قياسٌ يفقد نفسَه خيرٌ من قياسٍ يُغرق بابَه.**
 *
 * ⚠️ **والتأخيرُ ثانيتان ونصف بعد الرسم** — **وما يُقاس لا يزاحم ما
 * يُقرأ** (D-478). **و`keepalive`** فلا تسقط النبضةُ إن غادر بسرعة.
 */
export function LangPing() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem("lz-lang") === "1") return;
      sessionStorage.setItem("lz-lang", "1");
    } catch {
      return;
    }
    const id = window.setTimeout(() => {
      fetch("/api/lang-ping", { method: "POST", keepalive: true, cache: "no-store" }).catch(
        () => {},
      );
    }, 2500);
    return () => window.clearTimeout(id);
  }, []);

  return null;
}
