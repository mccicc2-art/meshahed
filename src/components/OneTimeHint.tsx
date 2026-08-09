"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";

/**
 * تلميحٌ لمرة واحدة (م٣ من تقييم 9 Aug) — سطرٌ يكشف قوةً مدفونة ثم
 * يختفي للأبد.
 *
 * التخزين في localStorage (سابقة `offline.ts`): التلميح شأنُ جهازٍ لا
 * حساب — ظهورُه مرةً على الجوال ومرةً على الحاسب مقبول، وعمودٌ في
 * قاعدة البيانات لسطرٍ إرشادي إسراف. يُعلَّم «مقروءاً» عند الإغلاق أو
 * عند مغادرة الصفحة بعد أول عرض — أيهما أسبق — فلا يطارد أحداً.
 * والحالة تبدأ مخفيةً وتُقلب في effect: الخادم لا يعرف localStorage،
 * وفرقُ الرسمتين كان سيكسر الترطيب.
 */
export function OneTimeHint({
  id,
  text,
  closeLabel,
}: {
  /** مفتاح التلميح — `loopz-hint:<id>` في localStorage */
  id: string;
  text: string;
  closeLabel: string;
}) {
  const [visible, setVisible] = useState(false);
  const key = `loopz-hint:${id}`;

  useEffect(() => {
    let seen = true;
    try {
      seen = !!localStorage.getItem(key);
    } catch {
      /* تخزين معطّل (تصفح خاص) — لا تلميح أفضل من تلميحٍ لا يصمت */
    }
    if (seen) return;
    // إظهارٌ في إطارٍ لاحقٍ لا في جسد الـeffect (قاعدة React نفسها —
    // نفس درس LibraryGrid): لا رسم متتالٍ متزامن
    const raf = requestAnimationFrame(() => setVisible(true));
    // المغادرة بعد أول عرضٍ تكفي إعلاناً بالقراءة — لا يظهر ثانيةً
    return () => {
      cancelAnimationFrame(raf);
      try {
        localStorage.setItem(key, "1");
      } catch {
        /* بلا تخزين سيظهر مجدداً — أهون الشرّين */
      }
    };
  }, [key]);

  if (!visible) return null;

  return (
    <div className="flex items-center gap-2 rounded-xl border border-accent/25 bg-accent/5 px-3 py-2 text-[12px] text-muted">
      <Icon name="sparkles" size={14} className="shrink-0 text-accent" />
      <span className="min-w-0 flex-1 leading-relaxed">{text}</span>
      <button
        type="button"
        aria-label={closeLabel}
        onClick={() => {
          try {
            localStorage.setItem(key, "1");
          } catch {
            /* لا تخزين — الإخفاء لهذه الجلسة يكفي */
          }
          setVisible(false);
        }}
        className="shrink-0 grid place-items-center w-7 h-7 rounded-full text-muted hover:text-foreground hover:bg-surface-2 transition"
      >
        <Icon name="close" size={13} strokeWidth={2.2} />
      </button>
    </div>
  );
}
