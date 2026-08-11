"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { setLocale } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon } from "./Icon";

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

      {open && (
        <>
          {/* ماسكُ النقر خارج القائمة — **في `body` لا هنا** (نفس علّة D-159).
              هذا الزرّ يعيش داخل الترويسة، وعليها `backdrop-blur` فهي إطارٌ
              مرجعيّ لكل `fixed` تحتها: `inset-0` كانت تعني «غطِّ الترويسة»
              لا «غطِّ الشاشة»، فالنقر أسفلها لا يُغلق القائمة أبداً.

              **و`z-20` لا `z-40`، وهذا هو بيت القصيد:** القائمة نفسها تبقى
              داخل الترويسة (فهي `absolute` تحت العلم)، والترويسة `z-30`
              **وتُنشئ سياق تكديسٍ خاصّاً بها**. فماسكٌ في `body` بـ`z-40`
              كان سيُرسم **فوق** القائمة ويبتلع النقر على اللغات — عطلٌ أسوأ
              من الذي نعالجه. تحت الثلاثين يبقى الماسك خلف الترويسة، ويغطّي
              كلَّ ما عداها. */}
          {typeof document !== "undefined" &&
            createPortal(
              <button
                aria-hidden
                tabIndex={-1}
                onClick={() => setOpen(false)}
                className="fixed inset-0 z-20 cursor-default"
              />,
              document.body,
            )}
          <ul
            role="listbox"
            className="absolute end-0 top-full mt-2 z-50 min-w-40 rounded-2xl border border-border bg-[color:var(--elevated)]/95 backdrop-blur-xl shadow-2xl overflow-hidden sheet-pop"
          >
            {options.map((o) => {
              const active = o.id === locale;
              return (
                <li key={o.id}>
                  <button
                    role="option"
                    aria-selected={active}
                    onClick={() => pick(o.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-start text-[14px] transition ${
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
                    {active && <Icon name="check-line" size={16} strokeWidth={2.2} className="ms-auto text-accent" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
