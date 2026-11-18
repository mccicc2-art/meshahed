"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { buttonClass } from "@/components/ui/Button";
import { inviteShareLink } from "@/core/storeLinks";

/**
 * ====== 🆕 زرُّ الدعوة الواحد — المهمة ٤٢١ (قرارُ أحمد ١٨ نوفمبر: «دمج الخطوتين») ======
 *
 * كانت الصفحةُ بطاقتين: «نزّل التطبيق» ثمّ «افتح الدعوة في التطبيق». الزائرُ يقرأ خطوتين قبل أن يضغط شيئاً، ومن نزّل
 * التطبيقَ لا يعرف أنّ عليه الرجوعَ إلى الصفحة. **الآن زرٌّ واحدٌ يتبدّل**: يضغطه فيذهب إلى المتجر، ويرجع فيجده «افتح Loopz»
 * — الخطوةُ الثانيةُ لا تُشرح، تظهر في مكان الأولى حين يحين وقتُها.
 *
 * - **iPhone**: شارةُ App Store الرسميّة ⇠ «افتح Loopz».
 * - **أندرويد** (ما دام التطبيقُ في اختبارٍ مغلق — `ANDROID_TEST.closed`): «انضم لتجربة أندرويد» (القروب) ⇠ «فعّل التجربة
 *   ونزّل التطبيق» (صفحةُ التفعيل في Google Play) ⇠ «افتح Loopz». ثلاثُ مراحل لا يُرى منها إلا واحدة. يومَ يُفتح للعموم: رابطُ
 *   Play الحاملُ للكود ⇠ «افتح Loopz».
 * - **الحاسوب**: الشارةُ وزرُّ أندرويد معاً بلا تبدّل — لا تطبيقَ يُفتح هنا.
 *
 * 🔑 **متى يتبدّل؟** حين **تعود الصفحةُ إلى الواجهة** بعد الضغط (`visibilitychange` · `pageshow`) لا لحظةَ الضغط: من
 * ضغط ولم يغادر لا يجد الزرَّ تغيّر تحت إصبعه. والمرحلةُ تُحفظ في `localStorage` لكلِّ كود **لحظةَ الضغط**، فمن رجع بـ«رجوع»
 * أعاد المتصفّحُ رسمَ الصفحة من جديد يجد المرحلةَ التالية أيضاً. ⚠️ التخزينُ قد يُرفض (تصفّحٌ خاصّ) — فيبقى التبدّلُ في الذاكرة.
 *
 * 🆕 **المهمة ٤٢٨ — ومع الضغطة يُنسخ رابطُ الدعوة إلى الحافظة** (قرارُ أحمد «اجل سوي ب»): من ثبّت التطبيقَ ودخله دون أن يرجع
 * إلى هنا يجد في الترحيب زرَّ «لصق» (iPhone، زرُّ Apple بلا سؤال النظام) أو يقرؤه أندرويد وحدَه — فلا يضيع حقُّ داعيه.
 * النسخُ داخل الضغطة نفسِها: المتصفّحُ لا يكتب في الحافظة إلّا بفعلٍ من صاحبها. وسطرٌ صغيرٌ يقول له ما حدث.
 *
 * 🆕 **المهمة ٤٣٤ — لا طريقَ مسدود** (فيديو ١٩ نوفمبر: Chrome على iPhone فتح المتجرَ في لسانٍ جديدٍ ثمّ أغلقه فوراً، فظنّت
 * الصفحةُ أنّه رجع، وصار الزرُّ «افتح Loopz» والتطبيقُ محذوف — ولا طريقَ إلى المتجر، وبقيت كذلك في كلِّ زيارةٍ لأنّ المرحلةَ
 * محفوظة):
 * - **على الجوّال كلُّ زرٍّ في اللسان نفسِه** — المتجرُ يُفتح كما يفتحه أيُّ رابط، وزرُّ أندرويد `intent://` يفتح التطبيقَ أو
 *   صفحةَ التجربة (`androidOpenLink`). اللسانُ الجديدُ للحاسوب وحدَه (`newTab`): هناك لا تطبيقَ والصفحةُ تبقى خلفه.
 * - **تحت «افتح Loopz» سطرُ «ما عندك التطبيق؟ نزّله»** يعيد الزرَّ إلى أوّل مرحلةٍ ويمحو المحفوظة — من حذف التطبيقَ أو لم
 *   يفتح عنده المتجرُ يجد طريقه دائماً.
 */

export type InviteStep = { kind: "badge"; href: string } | { kind: "button"; href: string; label: string };

export function InviteCta({
  steps,
  code,
  badgeSrc,
  badgeAlt,
  copiedNote,
  noAppLabel,
  newTab = false,
}: {
  /** مراحلُ هذا الجهاز بالترتيب — الأخيرةُ «افتح Loopz» لا تتقدّم */
  steps: InviteStep[];
  /** مفتاحُ الحفظ: مرحلةُ دعوةٍ لا تُورَّث لدعوةٍ أخرى */
  code: string;
  badgeSrc: string;
  badgeAlt: string;
  /** «نسخنا رابط دعوتك…» — يظهر بعد نسخٍ نجح */
  copiedNote: string;
  /** «ما عندك التطبيق؟ نزّله» — تحت المرحلة الأخيرة، يعيد إلى الأولى */
  noAppLabel: string;
  /** الحاسوب: المتجرُ والقروبُ في لسانٍ جديد — على الجوّال كلُّ شيءٍ في اللسان نفسِه */
  newTab?: boolean;
}) {
  const key = `loopz:invite-step:${code}`;
  const last = steps.length - 1;
  const [at, setAt] = useState(0);
  const [copied, setCopied] = useState(false);
  /* المرحلةُ التي تنتظر رجوعَ الزائر — تُعرض حين تعود الصفحةُ إلى الواجهة */
  const pending = useRef<number | null>(null);

  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(key));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- قراءةُ الجهاز بعد الترطيب: الخادمُ لا يعرفها
      if (Number.isInteger(saved) && saved > 0) setAt(Math.min(saved, last));
    } catch {
      /* التخزينُ مرفوض — نبدأ من الأولى */
    }
    const back = () => {
      if (document.visibilityState !== "visible" || pending.current === null) return;
      setAt(pending.current);
      pending.current = null;
    };
    document.addEventListener("visibilitychange", back);
    window.addEventListener("pageshow", back);
    window.addEventListener("focus", back);
    return () => {
      document.removeEventListener("visibilitychange", back);
      window.removeEventListener("pageshow", back);
      window.removeEventListener("focus", back);
    };
  }, [key, last]);

  const step = steps[Math.min(at, last)];
  const leave = () => {
    if (at >= last) return;
    /* الحافظةُ قد تُرفض (متصفّحٌ داخل تطبيق، صفحةٌ بلا HTTPS) — يبقى زرُّ «افتح Loopz» وحقلُ الكود في الترحيب */
    if (code) {
      try {
        void navigator.clipboard
          ?.writeText(inviteShareLink(code))
          .then(() => setCopied(true))
          .catch(() => {});
      } catch {
        /* لا شيء */
      }
    }
    pending.current = at + 1;
    try {
      window.localStorage.setItem(key, String(at + 1));
    } catch {
      /* لا شيء — يبقى في الذاكرة */
    }
  };
  /* من لم يجد التطبيقَ يرجع إلى أوّل مرحلة — والمحفوظةُ تُمحى كي لا تعود «افتح Loopz» في الزيارة القادمة */
  const restart = () => {
    pending.current = null;
    setAt(0);
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* لا شيء */
    }
  };
  const target = newTab ? { target: "_blank", rel: "noopener" } : {};

  const note = copied ? <p className="mt-2 text-center text-12 leading-relaxed text-white/80">{copiedNote}</p> : null;
  if (step.kind === "badge") {
    return (
      <div className="flex flex-col items-center">
        <a href={step.href} {...target} onClick={leave} className="block transition active:scale-[0.98]">
          <Image src={badgeSrc} alt={badgeAlt} width={162} height={54} unoptimized priority className="h-[54px] w-auto" />
        </a>
        {note}
      </div>
    );
  }
  return (
    <div className="w-full">
      <a href={step.href} {...target} onClick={leave} className={buttonClass({ size: "lg", full: true })}>
        {step.label}
      </a>
      {at < last ? note : null}
      {at >= last && last > 0 ? (
        <button
          type="button"
          onClick={restart}
          className="mx-auto mt-2.5 block text-[13px] text-white/80 underline underline-offset-4 transition [text-shadow:0_1px_6px_rgba(0,0,0,.9)] hover:text-white"
        >
          {noAppLabel}
        </button>
      ) : null}
    </div>
  );
}
