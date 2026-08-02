"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLocale } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";

export function LanguageSwitch({
  locale,
  compact = false,
}: {
  locale: Locale;
  compact?: boolean;
}) {
  const router = useRouter();
  const t = getDict(locale);
  const [pending, start] = useTransition();

  function pick(next: Locale) {
    if (next === locale || pending) return;
    start(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  const options: { id: Locale; label: string }[] = [
    { id: "ar", label: t.arabicLang },
    { id: "en", label: t.englishLang },
  ];

  return (
    <div
      role="group"
      aria-label={t.languageSection}
      className={`inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 p-1 ${
        pending ? "opacity-60" : ""
      }`}
    >
      {options.map((o) => {
        const active = o.id === locale;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => pick(o.id)}
            aria-pressed={active}
            className={`rounded-full transition ${compact ? "px-3.5 py-1.5 text-xs" : "px-5 py-2 text-sm"} ${
              active
                ? "bg-accent text-[color:var(--on-accent)] font-semibold"
                : "text-muted hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
