"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon } from "./Icon";

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

/**
 * سجلّ المشاهدة — أيامٌ مطويّة.
 *
 * كل يوم سطرُ عنوانٍ يُفتح بالضغط، وحلقات المسلسل الواحد مجموعةٌ في
 * صفٍّ واحد باسمه وعددها. من يفتح سجلّه يمسح الأيام بعينه أولاً ثم
 * يغوص في اليوم الذي يريده — لا قائمة طويلة تُفرض عليه كلها.
 */
export function DiaryList({ days, locale }: { days: DiaryDay[]; locale: Locale }) {
  const t = getDict(locale);
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  function toggle(day: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  return (
    <div className="space-y-2.5">
      {days.map(({ day, label, countLabel, entries }) => {
        const expanded = open.has(day);
        return (
          <section
            key={day}
            className="rounded-2xl border border-border bg-surface overflow-hidden"
          >
            <button
              type="button"
              onClick={() => toggle(day)}
              aria-expanded={expanded}
              className="flex items-center gap-3 w-full px-4 py-3.5 text-start transition active:bg-white/[0.04]"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{label}</span>
                <span className="block text-[11px] text-muted mt-0.5">{countLabel}</span>
              </span>
              {/* السهم يدور عند الفتح — إشارة الحالة الوحيدة اللازمة */}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
                className={`shrink-0 text-muted transition-transform duration-200 ${
                  expanded ? "rotate-180" : ""
                }`}
              >
                <path d="m5 10 7 7 7-7" />
              </svg>
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
                          size={15}
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
