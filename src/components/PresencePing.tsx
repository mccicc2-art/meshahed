"use client";

import { useEffect } from "react";
import { touchPresence } from "@/lib/actions";

/**
 * 🆕 **نبضةُ الحضور** (D-765) — تُبقي «آخر ظهور» في ترويسة المحادثة
 * صادقاً، وهي أختُ `LangPing` عمارةً: **لا ترسم شيئاً**، وتسكن التخطيطَ
 * لأن السؤال («متى كان نشطاً؟») سؤالُ التطبيق كلِّه لا صفحةٍ بعينها
 * (D-145) — نبضٌ من صفحة الرسائل وحدَها كان سيقول «غائبٌ منذ يوم» عمّن
 * يقلّب المكتبةَ الآن.
 *
 * **الإيقاع**: نبضةٌ بعد ثوانٍ من الرسم (لا تزاحم أوّلَ بايت — D-478)،
 * ثم كلَّ أربع دقائق ما دامت الصفحةُ في العين، ونبضةٌ عند العودة من
 * الخلفيّة. **والخنقُ مزدوج**: حارسُ دقيقةٍ هنا، وحارسُ ٦٠ ثانيةً في جسم
 * `touch_last_seen` نفسِها (الهجرة ١٥٣) — فأسوأُ الحالات كتابةُ صفٍّ
 * واحدٍ في الدقيقة للمستخدم النشط.
 *
 * ⚠️ **والفشلُ صمتٌ مطلق**: النبضةُ ليست حَمْلَ أيِّ شاشة — انقطاعُها
 * يجمّد «آخر ظهور» ولا يكسر شيئاً (نمطُ MarkSignalsSeen).
 */
export function PresencePing() {
  useEffect(() => {
    let last = 0;
    const beat = () => {
      if (document.hidden) return;
      const now = Date.now();
      if (now - last < 60_000) return;
      last = now;
      touchPresence().catch(() => {});
    };
    const first = window.setTimeout(beat, 3000);
    const id = window.setInterval(beat, 240_000);
    document.addEventListener("visibilitychange", beat);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", beat);
    };
  }, []);

  return null;
}
