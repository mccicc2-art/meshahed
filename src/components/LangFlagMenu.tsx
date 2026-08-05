"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLocale } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";

/**
 * علمٌ في أعلى الصفحة يفتح قائمة لغات منسدلة.
 *
 * بديل شريط «العربية | English» في وسط صفحة الهبوط: اللغة إعدادٌ يُلمس
 * مرةً واحدة، فلا يستحق مكاناً في قلب الصفحة — علمٌ صغير في الزاوية
 * يفهمه الزائر بلا قراءة، والقائمة تكبر مع كل لغة نضيفها لاحقاً.
 */
const FLAGS: Record<Locale, string> = { ar: "🇸🇦", en: "🇺🇸" };

export function LangFlagMenu({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const options: { id: Locale; flag: string; label: string }[] = [
    { id: "ar", flag: FLAGS.ar, label: t.arabicLang },
    { id: "en", flag: FLAGS.en, label: t.englishLang },
  ];

  function pick(next: Locale) {
    setOpen(false);
    if (next === locale || pending) return;
    start(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t.languageSection}
        className={`w-10 h-10 rounded-full grid place-items-center text-[20px] leading-none border border-white/12 bg-white/[0.04] hover:bg-white/[0.09] active:scale-95 transition ${
          pending ? "opacity-60" : ""
        }`}
      >
        <span aria-hidden>{FLAGS[locale]}</span>
      </button>

      {open && (
        <>
          <button
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <ul
            role="listbox"
            className="absolute end-0 top-full mt-2 z-50 min-w-40 rounded-2xl border border-white/10 bg-[color:var(--elevated)]/95 backdrop-blur-xl shadow-2xl overflow-hidden sheet-pop"
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
                        ? "font-bold text-foreground bg-white/[0.05]"
                        : "text-muted hover:text-foreground hover:bg-white/[0.05]"
                    }`}
                  >
                    <span className="text-[18px] leading-none" aria-hidden>
                      {o.flag}
                    </span>
                    {o.label}
                    {active && <span className="ms-auto text-accent">✓</span>}
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
