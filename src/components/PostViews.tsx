"use client";

import { useEffect } from "react";
import { recordPostViews } from "@/lib/actions";

/**
 * **عدّادُ المشاهدة — يعدّ ما بلغ الشاشةَ فعلاً** (D-237، بلاغُ أحمد:
 * «أقصد كم واحد شاف **المنشور**»).
 *
 * ================= لماذا مراقِبٌ لا نداءٌ عند التحميل =================
 *
 * **أسهلُ تنفيذٍ كان: أرسِل مفاتيحَ الخطّ كلَّها عند فتح الصفحة.**
 * **وهو كذبٌ مقيس:** الخطُّ اثنا عشر صفّاً وشاشةُ الهاتف تحمل ثلاثة —
 * **فتسعةُ منشوراتٍ تُحسب «مرئيّة» ولم تصل عينُ أحد إليها.** ومن نزل
 * صفّاً واحداً ثم خرج يكون قد «شاهد» الجميع. **ورقمٌ يُقرأ خطأً أسوأ من
 * لا رقم** (D-134) — وهي نفسُ العلّة التي أوجدت هذا الملفّ.
 *
 * فـ`IntersectionObserver` بعتبة **نصف الصفّ**: نصفُ المنشور في الشاشة
 * يعني أنه مُرِّر عليه لا أنه لُمح في الحافة.
 *
 * ================= ونداءٌ واحد للدفعة (D-164) =================
 *
 * المفاتيحُ تتجمّع في مجموعة، **وتُرسل بعد ثانيةٍ ونصف من آخر جديد** —
 * فالتمريرةُ الواحدة نداءٌ واحد لا نداءٌ لكلّ صفّ. **و`pagehide` تُفرِغ
 * ما تبقّى**: من أغلق التبويب بسرعةٍ لا تضيع قراءتُه.
 *
 * ⚠️ **و`sendBeacon` لا تصلح هنا**: الفعلُ إجراءُ خادمٍ بترويسةٍ وجلسة،
 * **ونسخُ نداءِ Supabase بيدنا عائلةٌ ثانيةٌ لطلبٍ واحد**. فما لم يُرسَل
 * عند الإغلاق يُعدّ في الزيارة التالية — **والمفتاحُ الأوّليُّ يمنع
 * التكرار** فلا ضررَ في المحاولة مرّتين.
 *
 * ================= ولا حالةَ ولا رسم =================
 *
 * **لا يُرجع شيئاً** — أثرٌ خالص. **والرقمُ لا يقفز أمام صاحبه**:
 * يظهر في التحميل التالي. **وعدّادٌ حيٌّ يتحرّك بينما تقرأ ضجيجٌ**،
 * والعدُّ ليس محادثة.
 */
export function PostViews() {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;

    const pending = new Set<string>();
    const counted = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | null = null;

    function flush() {
      if (timer) clearTimeout(timer);
      timer = null;
      if (!pending.size) return;
      const batch = [...pending];
      pending.clear();
      /* **ولا `await` ولا معالجةُ خطأ**: الفعلُ صامتُ السقوط في أصله،
         ومن انتظر عدّاداً أوقف ما ينتظره القارئ */
      void recordPostViews(batch);
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const el = e.target as HTMLElement;
          const key = el.dataset.postKey;
          /* **يُنزع من المراقبة فور عدِّه** — الصفُّ يدخل الشاشةَ ويخرج
             عشراتِ المرّات في تمريرةٍ واحدة، **ومراقبةٌ لا تنتهي تُشعل
             المعالج** بلا فائدة: الشخصُ يُعدّ مرّةً على أيّ حال. */
          io.unobserve(el);
          if (!key || counted.has(key)) continue;
          counted.add(key);
          pending.add(key);
        }
        if (pending.size) {
          if (timer) clearTimeout(timer);
          timer = setTimeout(flush, 1500);
        }
      },
      { threshold: 0.5 },
    );

    /* **يُبحث في المستند لا في مرجعٍ للأب**: الصفوفُ يرسمها الخادم
       ومكوّنُنا لا يملكها، **والسِّمةُ هي العقد** — من كتب `data-post-key`
       دخل العدّ، ومن لم يكتبه لم يدخل. */
    const rows = document.querySelectorAll<HTMLElement>("[data-post-key]");
    rows.forEach((r) => io.observe(r));

    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      io.disconnect();
      flush();
    };
  }, []);

  return null;
}
