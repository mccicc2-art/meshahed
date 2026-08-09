/**
 * شعارا التقييم — IMDb والطماطم — في بيتٍ واحد (قاعدة ٦: نسخة ثانية خطأ).
 *
 * انفصلا عن `HeroRatings` يوم احتاجهما مكوّن عميل (تقييمات الحلقات في
 * EpisodeTracker): استيراد HeroRatings هناك كان سيجرّ omdb/tmdb —
 * وحدات خادمٍ بمفاتيحها — إلى حزمة المتصفح. الشعاران وسمان خالصان
 * بلا لون ثيم: ألوان العلامتين ثابتة كشعارات المنصّات في WatchChip.
 */

/** شعار IMDb: المستطيل الأصفر بحروفٍ سوداء — هو الشعار نفسه مرسوماً
    بالأنماط لا صورةً تُحمَّل؛ حجمه يتبع حجم خطّ الأب (em) */
export function ImdbMark({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block rounded-[0.27em] bg-[#F5C518] px-[0.32em] py-[0.18em] font-black leading-none tracking-tight text-black select-none ${className}`}
    >
      IMDb
    </span>
  );
}

/** نجمة TMDB الزرقاء — احتياط ما لا تقييم IMDb له (قرار أحمد 9 Aug:
    «خل يظهر تقييم TMDB ولوقو نجمة زرقاء» — يعدّل صمت D-093 الكامل).
    اللون أزرق TMDB المميز فلا تُخلط بشارة IMDb الصفراء أبداً */
export function TmdbMark({ size = 12, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      className={`shrink-0 ${className}`}
    >
      <path
        fill="#01B4E4"
        d="M12 1.8 15 9l7.8.4-6 5 1.9 7.6L12 17.8 5.3 22l1.9-7.6-6-5L9 9l3-7.2Z"
      />
    </svg>
  );
}

/** شعار الطماطم: الثمرة الحمراء بورقتها — رسمٌ متجهيّ مبسّط يُقرأ في ١٤px */
export function RtMark({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      className={`shrink-0 ${className}`}
    >
      <path
        fill="#FA320A"
        d="M12 7.2c5.1 0 8.9 3.2 8.9 7.9 0 4.8-3.9 8-8.9 8s-8.9-3.2-8.9-8c0-4.7 3.8-7.9 8.9-7.9Z"
      />
      <path
        fill="#00912D"
        d="M12 1.2c.9 1.1 2.3 1.6 3.7 1.3-.7 1.2-1.9 2-3.2 2.1 1 .4 2 .5 3 .2-.8 1.1-2.1 1.8-3.5 1.7-1.4.1-2.7-.6-3.5-1.7 1 .3 2 .2 3-.2-1.3-.1-2.5-.9-3.2-2.1 1.4.3 2.8-.2 3.7-1.3Z"
      />
    </svg>
  );
}
