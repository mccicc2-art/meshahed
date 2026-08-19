"use client";

import { useState, useTransition } from "react";

import Image from "next/image";
import { setLocale } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon } from "./Icon";
import { Dropdown } from "./ui/Dropdown";

/**
 * علمٌ في أعلى الصفحة يفتح قائمة لغات منسدلة.
 *
 * بديل شريط «العربية | English» في وسط صفحة الهبوط: اللغة إعدادٌ يُلمس
 * مرةً واحدة، فلا يستحق مكاناً في قلب الصفحة — علمٌ صغير في الزاوية
 * يفهمه الزائر بلا قراءة، والقائمة تكبر مع كل لغة نضيفها لاحقاً.
 *
 * صورُ أعلام لا إيموجي: ويندوز يرسم إيموجي الأعلام حرفَين («SA») فتنكسر
 * الفكرة — الصور تُرسم متطابقةً على كل الأنظمة.
 *
 * وتمرّ بـ`next/image` لا بوسمٍ خام: سياسة أمان المحتوى تحصر `img-src`
 * في نطاقاتٍ معدودة، و`flagcdn.com` ليس منها — فكان المتصفّح يمنع العلم
 * ويترك الزاوية فارغة. `next/image` يجلبها على الخادم ويقدّمها من نطاقنا،
 * فتصل بلا توسيع السياسة لنطاقٍ خارجيّ جديد.
 */
const FLAGS: Record<Locale, string> = {
  ar: "https://flagcdn.com/w80/sa.png",
  en: "https://flagcdn.com/w80/us.png",
};

export function LangFlagMenu({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const options: { id: Locale; flag: string; label: string }[] = [
    { id: "ar", flag: FLAGS.ar, label: t.arabicLang },
    { id: "en", flag: FLAGS.en, label: t.englishLang },
  ];

  /**
   * تبديلُ اللغة يُعيد تحميل المستند، لا `router.refresh()` (D-162).
   *
   * **العطل المقيس:** `refresh` يعيد رسم شجرة React فتتبدّل النصوص و`dir`
   * و`lang` — **ويبقى ما لا تملكه React كما هو**. وزرّ الدخول يرسمه محرّك
   * Google داخل إطارٍ خاصّ به، فكانت الصفحة كلّها تتحوّل إلى الإنجليزية
   * **وزرّ الدخول وحده يبقى عربياً**. وتفريغُ الصندوق قبل إعادة الرسم
   * (D-161) لم يكفِ: المحرّك يُهيَّأ مرّةً واحدة لكل صفحة.
   *
   * **وهذا تعميمُ D-081 حرفياً:** «أيُّ تدفّقٍ يغيّر شيئاً عامّاً في
   * المستند ينتقل بتحميلٍ كامل لا بالراوتر». اللغة تغيّر `lang` و`dir`
   * والنصوص وكل ودجت طرفٍ ثالث — فهي من هذا الصنف.
   * والكلفة تُدفع مرّةً في العمر: اللغة تُلمس مرّةً ثم لا تُلمس.
   */
  function pick(next: Locale) {
    setOpen(false);
    if (next === locale || pending) return;
    start(async () => {
      await setLocale(next);
      window.location.reload();
    });
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t.languageSection}
        className={`w-10 h-10 rounded-full grid place-items-center border border-border bg-surface-2 hover:bg-surface active:scale-95 transition ${
          pending ? "opacity-60" : ""
        }`}
      >
        <Image
          src={FLAGS[locale]}
          alt=""
          width={22}
          height={22}
          className="w-[22px] h-[22px] rounded-full object-cover shrink-0"
          aria-hidden
        />
      </button>

      {/* **الصندوقُ والماسكُ وحجّتُهما انتقلا إلى `ui/Dropdown`** (D-226):
          كانا يُكتبان هنا بيدٍ منذ D-162، ثم طلب أحمد منسدلةً مثلها لقائمة
          صفّ النشاط — **ونسخةٌ ثانية كانت ستصير عائلةً ثانية**. فنُقلا إلى
          المصدر **وحُذفت نسخةُ الأصل في الدفعة نفسها** (D-159/D-166).
          وحجّةُ `z-20` مكتوبةٌ هناك بنصّها، فهي منها لا من هنا. */}
      <Dropdown open={open} onClose={() => setOpen(false)} className="min-w-40 py-0">
        <ul role="listbox">
          {options.map((o) => {
            const active = o.id === locale;
            return (
              <li key={o.id}>
                <button
                  role="option"
                  aria-selected={active}
                  onClick={() => pick(o.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-start text-14 transition ${
                    active
                      ? "font-bold text-foreground bg-surface-2"
                      : "text-muted hover:text-foreground hover:bg-surface-2"
                  }`}
                >
                  <Image
                    src={o.flag}
                    alt=""
                    width={20}
                    height={20}
                    className="w-5 h-5 rounded-full object-cover shrink-0"
                    aria-hidden
                  />
                  {o.label}
                  {active && (
                    <Icon name="check-line" size={16} strokeWidth={2.2} className="ms-auto text-accent" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </Dropdown>
    </div>
  );
}
