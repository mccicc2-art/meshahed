"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon } from "./Icon";
import { chipClass } from "./ui/controls";

export interface DiaryEntry {
  key: string;
  href: string;
  title: string;
  poster: string | null;
  kind: "tv" | "movie";
  /** «م٢ · ح٥» لحلقة واحدة، أو «S2 · E3–E7»، أو «٥ حلقات» */
  label: string;
  minutes: number;
}

export interface DiaryDay {
  day: string;
  label: string;
  /** «٣ أعمال» */
  countLabel: string;
  entries: DiaryEntry[];
}

export interface DiaryMonth {
  key: string;
  label: string;
  /** أول يوم في هذا الشهر داخل السجلّ — هدف القفزة */
  firstDay: string;
}

/**
 * سجلّ المشاهدة — أيامٌ مطويّة.
 *
 * كل يوم سطرُ عنوانٍ يُفتح بالضغط، وحلقات المسلسل الواحد مجموعةٌ في
 * صفٍّ واحد باسمه وعددها. من يفتح سجلّه يمسح الأيام بعينه أولاً ثم
 * يغوص في اليوم الذي يريده — لا قائمة طويلة تُفرض عليه كلها.
 */
export function DiaryList({
  days,
  months = [],
  locale,
}: {
  days: DiaryDay[];
  months?: DiaryMonth[];
  locale: Locale;
}) {
  const t = getDict(locale);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [activeMonth, setActiveMonth] = useState<string | null>(null);

  function toggle(day: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  function jump(m: DiaryMonth) {
    setActiveMonth(m.key);
    document
      .getElementById(`diary-${m.firstDay}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="space-y-2.5">
      {/* شرائح الأشهر — الذاكرة تُتصفَّح بالزمن لا بالبحث */}
      {months.length > 1 && (
        <div className="sticky top-0 z-20 -mx-4 px-4 py-2 bg-[color:var(--background)]/90 backdrop-blur-md">
          <div className="flex gap-2 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {months.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => jump(m)}
                className={chipClass(activeMonth === m.key, "sm", "shrink-0")}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {days.map(({ day, label, countLabel, entries }) => {
        const expanded = open.has(day);
        return (
          <section
            key={day}
            id={`diary-${day}`}
            className="scroll-mt-16 rounded-2xl border border-border bg-surface overflow-hidden"
          >
            <button
              type="button"
              onClick={() => toggle(day)}
              aria-expanded={expanded}
              className="flex items-center gap-3 w-full px-4 py-3.5 text-start transition active:bg-surface-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{label}</span>
                <span className="block text-[11px] text-muted mt-0.5">{countLabel}</span>
              </span>
              {/* السهم يدور عند الفتح — إشارة الحالة الوحيدة اللازمة */}
              <Icon
                name="chevron-down"
                size={16}
                strokeWidth={2.2}
                className={`text-muted transition-transform duration-200 ${
                  expanded ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* طيّ ناعم بحيلة grid-rows: من 0fr إلى 1fr */}
            <div
              className={`grid transition-[grid-template-rows] duration-300 ${
                expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className="overflow-hidden">
                <ul className="divide-y divide-[color:var(--divider)] border-t border-[color:var(--divider)]">
                  {entries.map((e) => (
                    <li key={e.key}>
                      <Link
                        href={e.href}
                        prefetch={false}
                        className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-surface-2 transition"
                      >
                        <span className="relative w-8 h-12 shrink-0 rounded-md overflow-hidden bg-surface-2 border border-border">
                          {e.poster && (
                            <Image
                              src={e.poster}
                              alt=""
                              fill
                              sizes="32px"
                              className="object-cover"
                            />
                          )}
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-medium truncate leading-tight">
                            {e.title}
                          </span>
                          <span className="block text-[11px] text-muted mt-0.5">
                            {e.label}
                            {e.minutes > 0 ? ` · ${t.runtimeMin(e.minutes)}` : ""}
                          </span>
                        </span>

                        <Icon
                          name={e.kind === "movie" ? "film" : "tv"}
                          size={16}
                          className="text-muted/70 shrink-0"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
