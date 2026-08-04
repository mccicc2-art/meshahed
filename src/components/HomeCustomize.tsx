"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import {
  DEFAULT_HOME_PREFS,
  HOME_SECTIONS,
  sanitizeHomePrefs,
  type HomePrefs,
  type HomeSection,
} from "@/lib/homePrefs";
import { Icon, type IconName } from "./Icon";

/**
 * تخصيص الرئيسية.
 *
 * قسمان: مفاتيح إظهارٍ لعناصر الترويسة، وقائمة ترتيبٍ لأقسام المحتوى.
 * الترتيب بأسهمٍ لا سحبٍ: السحب على الجوال يتعارك مع تمرير الصفحة
 * ويحتاج مكتبة، والسهمان يؤدّيان الغرض بلا كليهما. وإخفاء القسم من
 * القائمة نفسها — عين مفتوحة أو مغلقة — فالمكان الذي تُرتّب فيه هو
 * المكان الذي تُخفي فيه.
 *
 * الحفظ يمرّ عبر `updateProfile` نفسه الذي تكتب به بقية أقسام
 * الإعدادات: نموذجٌ واحد لجدولٍ واحد.
 */
export function HomeCustomize({
  locale,
  nickname,
  avatarUrl,
  genres,
  initial,
}: {
  locale: Locale;
  /** يمرّران كما هما — `updateProfile` يكتب الصفّ كاملاً */
  nickname: string;
  avatarUrl: string | null;
  genres: number[];
  initial: unknown;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [prefs, setPrefs] = useState<HomePrefs>(() => sanitizeHomePrefs(initial));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const toggles: { key: "level" | "stats" | "followers" | "social"; label: string }[] = [
    { key: "stats", label: t.custStatsCard },
    { key: "level", label: t.custLevel },
    { key: "followers", label: t.custFollowers },
    { key: "social", label: t.custSocial },
  ];

  const sectionMeta: Record<HomeSection, { icon: IconName; label: string }> = {
    continue: { icon: "play", label: t.continueWatching },
    week: { icon: "calendar", label: t.custWeekStrip },
    shows: { icon: "tv", label: t.myShows },
    movies: { icon: "film", label: t.myMovies },
    trending: { icon: "trending", label: t.trendingWeek },
  };

  // القائمة تعرض الأقسام كلها: المرتَّبة أولاً ثم المخفيّة بعينٍ مغلقة
  const hidden = HOME_SECTIONS.filter((s) => !prefs.order.includes(s));

  function set(next: HomePrefs) {
    setSaved(false);
    setPrefs(next);
  }

  function move(sec: HomeSection, dir: -1 | 1) {
    const order = [...prefs.order];
    const i = order.indexOf(sec);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    set({ ...prefs, order });
  }

  function toggleSection(sec: HomeSection) {
    const order = prefs.order.includes(sec)
      ? prefs.order.filter((s) => s !== sec)
      : [...prefs.order, sec];
    set({ ...prefs, order });
  }

  function save() {
    setError(null);
    start(async () => {
      try {
        await updateProfile({
          nickname,
          avatarUrl,
          favoriteGenres: genres,
          homePrefs: prefs,
        });
        setSaved(true);
        router.refresh();
      } catch (e) {
        setError(t.errSave + (e as Error).message);
      }
    });
  }

  const rowCls =
    "flex items-center justify-between gap-3 px-3.5 py-3 border-b border-[color:var(--divider)] last:border-b-0";

  return (
    <div className="space-y-4">
      {/* ===== عناصر الترويسة ===== */}
      <section className="bg-surface border border-border rounded-2xl p-3.5 sm:p-5">
        <h2 className="text-sm font-bold mb-1">{t.custHeaderSection}</h2>
        <p className="text-xs text-muted leading-relaxed mb-3">{t.custHeaderHint}</p>

        <div className="rounded-xl border border-border overflow-hidden">
          {toggles.map(({ key, label }) => (
            <label key={key} className={`${rowCls} cursor-pointer`}>
              <span className="text-sm">{label}</span>
              <input
                type="checkbox"
                checked={prefs[key]}
                onChange={() => set({ ...prefs, [key]: !prefs[key] })}
                className="sr-only peer"
              />
              {/* مفتاح iOS: المسار يتلوّن والقرص ينزلق */}
              <span
                aria-hidden
                className="relative w-11 h-6.5 shrink-0 rounded-full transition peer-focus-visible:outline-2 peer-focus-visible:outline-accent bg-surface-2 peer-checked:bg-accent"
              >
                <span
                  className={`absolute top-0.5 start-0.5 w-5.5 h-5.5 rounded-full bg-white shadow transition-transform ${
                    prefs[key] ? "translate-x-[18px] rtl:-translate-x-[18px]" : ""
                  }`}
                />
              </span>
            </label>
          ))}
        </div>
      </section>

      {/* ===== ترتيب الأقسام ===== */}
      <section className="bg-surface border border-border rounded-2xl p-3.5 sm:p-5">
        <h2 className="text-sm font-bold mb-1">{t.custOrderSection}</h2>
        <p className="text-xs text-muted leading-relaxed mb-3">{t.custOrderHint}</p>

        <div className="rounded-xl border border-border overflow-hidden">
          {prefs.order.map((sec, i) => (
            <div key={sec} className={rowCls}>
              <span className="flex items-center gap-2.5 min-w-0 text-sm">
                <Icon name={sectionMeta[sec].icon} size={17} className="text-muted shrink-0" />
                <span className="truncate">{sectionMeta[sec].label}</span>
              </span>
              <span className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => move(sec, -1)}
                  disabled={i === 0}
                  aria-label={t.custMoveUp}
                  title={t.custMoveUp}
                  className="grid place-items-center w-9 h-9 rounded-lg text-muted hover:text-foreground hover:bg-surface-2 disabled:opacity-30 disabled:pointer-events-none transition"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="m5 14 7-7 7 7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => move(sec, 1)}
                  disabled={i === prefs.order.length - 1}
                  aria-label={t.custMoveDown}
                  title={t.custMoveDown}
                  className="grid place-items-center w-9 h-9 rounded-lg text-muted hover:text-foreground hover:bg-surface-2 disabled:opacity-30 disabled:pointer-events-none transition"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="m5 10 7 7 7-7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => toggleSection(sec)}
                  aria-label={t.custHide}
                  title={t.custHide}
                  className="grid place-items-center w-9 h-9 rounded-lg text-muted hover:text-foreground hover:bg-surface-2 transition"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
                    <circle cx="12" cy="12" r="2.8" />
                  </svg>
                </button>
              </span>
            </div>
          ))}

          {hidden.map((sec) => (
            <div key={sec} className={`${rowCls} opacity-50`}>
              <span className="flex items-center gap-2.5 min-w-0 text-sm">
                <Icon name={sectionMeta[sec].icon} size={17} className="text-muted shrink-0" />
                <span className="truncate line-through">{sectionMeta[sec].label}</span>
              </span>
              <button
                type="button"
                onClick={() => toggleSection(sec)}
                aria-label={t.custShow}
                title={t.custShow}
                className="grid place-items-center w-9 h-9 rounded-lg text-muted hover:text-foreground hover:bg-surface-2 transition shrink-0"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
                  <path d="m4 20 16-16" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => set({ ...DEFAULT_HOME_PREFS })}
          className="mt-3 text-xs text-muted hover:text-foreground transition"
        >
          {t.custReset}
        </button>
      </section>

      {error && (
        <p role="alert" className="text-sm text-red-300 bg-red-500/10 border border-red-400/30 rounded-xl px-3 py-2.5">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={pending}
          className="px-5 py-2.5 text-sm rounded-xl bg-accent text-[color:var(--on-accent)] font-semibold hover:brightness-110 transition disabled:opacity-60"
        >
          {pending ? t.saving : t.saveChanges}
        </button>
        {saved && (
          <span role="status" className="text-sm text-[color:var(--success)]">
            {t.savedOk}
          </span>
        )}
      </div>
    </div>
  );
}
