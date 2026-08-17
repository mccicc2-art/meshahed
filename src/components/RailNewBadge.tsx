"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { getDict, type Locale } from "@/lib/i18n";

/**
 * **شارةُ «جديد» على صفٍّ تغيّر** (البند ٧).
 *
 * ================= السؤال الذي تجيبه =================
 *
 * صفحةُ اكتشف اثنا عشر صفّاً متشابهَ الشكل، **والقارئُ الذي يفتحها كلَّ
 * يومٍ لا يعرف أيُّها تحرّك** — **فيمرّ عليها كلِّها أو لا يمرّ على
 * شيء**. والشارةُ تقول له أين ينظر بكلمةٍ واحدة.
 *
 * ================= ولماذا الجهازُ لا الحساب =================
 *
 * **سابقةُ `OneTimeHint` حرفاً**: «ما رأيتَه أنت» شأنُ جهازٍ لا صفٍّ في
 * قاعدة — **وعمودٌ لكلِّ صفٍّ لكلِّ قارئ لرسم كلمةٍ إسراف** (D-205).
 * ظهورُها مرّةً على الجوال ومرّةً على الحاسب مقبول.
 *
 * ================= ولا تظهر في أوّل زيارة =================
 *
 * **لأن كلَّ شيءٍ جديدٌ يومَها فالشارةُ لا تخبر بشيء** — **وشارةٌ تُضاء
 * دائماً تُقرأ زينةً ثم لا تُقرأ** (D-134/D-219). فأوّلُ مرّةٍ تكتب
 * البصمةَ وتصمت، **وما بعدها تقارن.**
 *
 * ⚠️ **والبصمةُ من الخادم لا من الوقت**: `sig` مبنيّةٌ من معرّفات بطاقات
 * الصفّ — **فصفٌّ يُعاد جلبُه بنفس المحتوى ليس «جديداً»**، وهو الفرق بين
 * «تغيّر» و«أُعيد تحميلُه».
 *
 * ⚠️ **وتبدأ مخفيّةً وتُقلب في `effect`**: الخادمُ لا يعرف `localStorage`،
 * **وفرقُ الرسمتين يكسر الترطيب** (نصُّ `OneTimeHint`).
 */
export function RailNewBadge({
  id,
  sig,
  locale,
}: {
  /** مفتاحُ الصفّ — `loopz-rail:<id>` في localStorage */
  id: string;
  /** بصمةُ محتوى الصفّ اليوم (معرّفات بطاقاته مضمومة) */
  sig: string;
  locale: Locale;
}) {
  const t = getDict(locale);
  const [changed, setChanged] = useState(false);
  const key = `loopz-rail:${id}`;

  useEffect(() => {
    let seen: string | null = null;
    try {
      seen = localStorage.getItem(key);
      localStorage.setItem(key, sig);
    } catch {
      /* تخزين معطّل (تصفّح خاص) — لا شارةَ أفضل من شارةٍ تكذب */
      return;
    }
    if (!seen || seen === sig) return;
    /* **إظهارٌ في إطارٍ لاحقٍ لا في جسد الـeffect** — قاعدةُ React نفسُها
       ودرسُ `OneTimeHint` و`LibraryGrid`: لا رسمٌ متتالٍ متزامن */
    const raf = requestAnimationFrame(() => setChanged(true));
    return () => cancelAnimationFrame(raf);
  }, [key, sig]);

  if (!changed) return null;

  return (
    <span
      title={t.railNewAria}
      className="shrink-0 inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[11px] font-bold text-accent"
    >
      <Icon name="sparkles" size={11} />
      {t.railNew}
    </span>
  );
}
