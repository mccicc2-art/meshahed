"use client";

import { useState, useTransition } from "react";

import { setLocale } from "@/lib/actions";
import { getDict, LOCALE_CODES, LOCALES, type Locale } from "@/lib/i18n";
import { Icon } from "./Icon";
import { Dropdown } from "./ui/Dropdown";

/**
 * مبدّلُ اللغة — **رمزٌ بحرفين يفتح قائمةً منسدلة** (D-665، حكمُ أحمد:
 * «احذف الأعلام، خلّها رموز فقط — العربي AR والإنجلش EN وهكذا»).
 *
 * ⚖️ **وهذا نقضٌ لـ`LangFlagMenu` كلِّها، لا لموضعها**: كانت تجلب
 * علمَين من `flagcdn.com` عبر `next/image` **وتحمل في تعليقها ثلاثَ
 * حجَجٍ للأعلام** — وسقطت كلُّها بحكمه، **وسقط معها نداءُ شبكةٍ خارجيٌّ
 * لصورةٍ في كلِّ رسمةِ شريط.**
 *
 * 🔑 **والحجّةُ ليست ذوقاً**: **العلَمُ يسمّي دولةً واللغةُ ليست دولة**
 * (انظر `LOCALE_CODES`) — **والرمزُ أصدقُ وأخفُّ وأقبلُ للنموّ**:
 * الثالثةُ والرابعةُ تدخلان القائمةَ بسطرٍ في السجلّ بلا صورةٍ تُستضاف.
 *
 * ⚠️ **والقائمةُ تُبنى من `LOCALES` لا بيدٍ**: **سجلٌّ واحدٌ يعرف كم
 * لغةً عندنا** (D-152) — **ولغةٌ تُضاف ولا تظهر في مبدّلها هي لغةٌ لا
 * وجودَ لها عند القارئ.**
 *
 * ⚠️ **وتبديلُ اللغة يُعيد تحميل المستند لا `router.refresh()`**
 * (D-162، والحجّةُ منقولةٌ كما هي لأنها لم تتبدّل): `refresh` يعيد رسمَ
 * شجرة React فتتبدّل النصوصُ و`dir` و`lang` — **ويبقى ما لا تملكه React
 * كما هو**، وزرُّ الدخول يرسمه محرّكُ Google في إطارٍ خاصّ به فتصير
 * الصفحةُ إنجليزيّةً **وزرُّ الدخول وحده عربيّاً**. **وهو تعميمُ D-081**:
 * ما يغيّر شيئاً عامّاً في المستند ينتقل بتحميلٍ كامل — **والكلفةُ
 * تُدفع مرّةً في العمر.**
 */
export function LangMenu({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const labels: Record<Locale, string> = { ar: t.arabicLang, en: t.englishLang };

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
        {/* **الرمزُ لاتينيٌّ بـ`dir=ltr` في الواجهتين** — علامةٌ لا ترجمة */}
        <span className="text-14 font-extrabold tracking-wide leading-none" dir="ltr">
          {LOCALE_CODES[locale]}
        </span>
      </button>

      <Dropdown open={open} onClose={() => setOpen(false)} className="min-w-40 py-0">
        <ul role="listbox">
          {LOCALES.map((id) => {
            const active = id === locale;
            return (
              <li key={id}>
                <button
                  role="option"
                  aria-selected={active}
                  onClick={() => pick(id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-start text-14 transition ${
                    active
                      ? "font-bold text-foreground bg-surface-2"
                      : "text-muted hover:text-foreground hover:bg-surface-2"
                  }`}
                >
                  {/* **ورمزُ الصفِّ بعرضٍ ثابت** فتصطفّ الأسماءُ تحت بعضها
                      مهما اختلف طولُ الرمز */}
                  <span
                    className="w-7 shrink-0 text-12 font-extrabold tracking-wide text-center"
                    dir="ltr"
                  >
                    {LOCALE_CODES[id]}
                  </span>
                  {labels[id]}
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
