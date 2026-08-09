"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import {
  DEFAULT_HOME_PREFS,
  HOME_SECTIONS,
  HEADER_STATS,
  STATS_PICK_MIN,
  STATS_PICK_MAX,
  sanitizeHomePrefs,
  type HomePrefs,
  type HomeSection,
  type HeaderStatKey,
} from "@/lib/homePrefs";
import { type IconName } from "./Icon";
import { Alert } from "./ui/Alert";
import { buttonClass } from "./ui/Button";
import { SectionOrderList, ToggleRow } from "./ui/SectionOrderList";

/**
 * تخصيص الرئيسية.
 *
 * ثلاثة أقسام: مفاتيح إظهارٍ لعناصر الترويسة، وخانات بطاقة الأرقام،
 * وترتيب أقسام المحتوى. الأخيران يرسمهما `SectionOrderList` نفسه الذي
 * ترسم به شاشة البروفايل (D-129) — سجلّاتٌ ثلاثة، مصنعٌ واحد.
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
    towatch: { icon: "bookmark", label: t.libToWatch },
    upcoming: { icon: "hourglass", label: t.libUpcoming },
    recap: { icon: "book", label: t.recapTitle },
    shows: { icon: "tv", label: t.myShows },
    movies: { icon: "film", label: t.myMovies },
    ratings: { icon: "star", label: t.panelRatings },
    lists: { icon: "list", label: t.myLists },
    trending: { icon: "trending", label: t.trendingWeek },
  };

  const statMeta: Record<HeaderStatKey, { icon: IconName; label: string }> = {
    shows: { icon: "tv", label: t.shortShows },
    movies: { icon: "film", label: t.shortMovies },
    towatch: { icon: "bookmark", label: t.libToWatch },
    time: { icon: "clock", label: t.statWatchTime },
    episodes: { icon: "play", label: t.statsWatchedEpisodes },
    upcoming: { icon: "hourglass", label: t.libUpcoming },
    completed: { icon: "check", label: t.libTabFinished },
    dropped: { icon: "card", label: t.droppedBadge },
    ratings: { icon: "star", label: t.panelRatings },
  };

  const orderLabels = {
    up: t.custMoveUp,
    down: t.custMoveDown,
    hide: t.custHide,
    show: t.custShow,
  };

  function set(next: HomePrefs) {
    setSaved(false);
    setPrefs(next);
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

  return (
    <div className="space-y-4">
      {/* ===== عناصر الترويسة ===== */}
      <section className="bg-surface border border-border rounded-2xl p-3.5 sm:p-5">
        <h2 className="text-sm font-bold mb-1">{t.custHeaderSection}</h2>
        <p className="text-xs text-muted leading-relaxed mb-3">{t.custHeaderHint}</p>

        <div className="rounded-xl border border-border overflow-hidden">
          {toggles.map(({ key, label }) => (
            <ToggleRow
              key={key}
              label={label}
              checked={prefs[key]}
              onChange={() => set({ ...prefs, [key]: !prefs[key] })}
            />
          ))}
        </div>
      </section>

      {/* ===== خانات بطاقة الأرقام ===== */}
      <section className="bg-surface border border-border rounded-2xl p-3.5 sm:p-5">
        <h2 className="text-sm font-bold mb-1">{t.custStatsCard}</h2>
        <p className="text-xs text-muted leading-relaxed mb-3">{t.custStatsPickHint}</p>

        <SectionOrderList
          all={HEADER_STATS}
          picked={prefs.statsPick}
          meta={statMeta}
          labels={orderLabels}
          min={STATS_PICK_MIN}
          max={STATS_PICK_MAX}
          onChange={(statsPick) => set({ ...prefs, statsPick })}
        />
      </section>

      {/* ===== ترتيب الأقسام ===== */}
      <section className="bg-surface border border-border rounded-2xl p-3.5 sm:p-5">
        <h2 className="text-sm font-bold mb-1">{t.custOrderSection}</h2>
        <p className="text-xs text-muted leading-relaxed mb-3">{t.custOrderHint}</p>

        <SectionOrderList
          all={HOME_SECTIONS}
          picked={prefs.order}
          meta={sectionMeta}
          labels={orderLabels}
          onChange={(order) => set({ ...prefs, order })}
        />

        <button
          type="button"
          onClick={() => set({ ...DEFAULT_HOME_PREFS })}
          className="mt-3 text-xs text-muted hover:text-foreground transition"
        >
          {t.custReset}
        </button>
      </section>

      {error && (
        <Alert>{error}</Alert>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={pending}
          className={buttonClass()}
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
