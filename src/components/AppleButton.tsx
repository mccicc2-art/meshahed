"use client";

import { useSyncExternalStore } from "react";
import { getDict, type Locale } from "@/core/i18n";
import { authButtonClass } from "./authButton";

/**
 * 🆕 T538 — «المتابعة عبر Apple» في المتصفّح (أحمد ٢٤ نوفمبر «٢أ»: كلُّ المتصفّحات). رابطٌ لا زرُّ فعل: البدايةُ على الخادم
 * (`/auth/apple/start`) ثمّ صفحةُ أبل — وجهةٌ تُرى في شريط العنوان كأيِّ رابط.
 *
 * **الشكلُ شكلُ زرّ Google الاحتياطيّ نفسُه** (الأبيضُ على الشاشة السوداء، الحوافُّ والظلّ) بعلامة أبل وكلمة «Apple» — إرشاداتُ
 * أبل تقبل زرّاً مخصّصاً بهذين ما دام بحجم أزرار الدخول الأخرى وبروزها، فلا عائلةَ أزرارٍ ثانية. **ولا يُرسم داخل تطبيقنا**:
 * هناك الدخولُ أصليٌّ (D-1350)، والجسرُ يُعرف بعد التركيب فقط — فالزرُّ يظهر بعد أوّل رسمة.
 */
export function AppleButton({ locale, next = "/" }: { locale: Locale; next?: string }) {
  const t = getDict(locale);
  /* الخادمُ لا يعرف الجسر ⇐ لا زرَّ في رسمته، والمتصفّحُ يقرّر بعد الإماهة بلا رسمةٍ مزدوجة */
  const show = useSyncExternalStore(noop, () => !window.ReactNativeWebView, () => false);
  if (!show) return null;
  return (
    <a
      href={`/auth/apple/start${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}
      className={`mt-3 ${authButtonClass}`}
    >
      <AppleMark size={20} />
      {t.loginContinueApple}
    </a>
  );
}

const noop = () => () => {};

/** علامةُ أبل — بلون النصّ (`currentColor`) فتتبع لونَ الزرّ في الثيمين */
function AppleMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.87-.76-1.47.02-2.83.86-3.59 2.18-1.53 2.66-.39 6.6 1.1 8.76.73 1.06 1.6 2.24 2.73 2.2 1.1-.04 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.41 1.2-2.47-.03-.01-2.3-.88-2.32-3.5zM14.2 6.13c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.31-.56.64-1.05 1.67-.92 2.66.97.07 1.96-.49 2.56-1.21z" />
    </svg>
  );
}
