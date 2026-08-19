"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import {
  DEFAULT_HOME_PREFS,
  HOME_SECTIONS,
  HOME_VIEWS,
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
import {
  CardCountRow,
  PosterSizeRow,
  SectionOrderList,
  ToggleRow,
} from "./ui/SectionOrderList";
import { chipClass, pillTrack } from "./ui/controls";
import { CustomizePreview } from "./CustomizePreview";
import { type Density } from "@/lib/density";

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
  registerReset,
}: {
  locale: Locale;
  /** يمرّران كما هما — `updateProfile` يكتب الصفّ كاملاً */
  nickname: string;
  avatarUrl: string | null;
  genres: number[];
  initial: unknown;
  /** يسلّم زرَّ «استعادة» في الترويسة مقبضاً على هذا اللوح (D-465) */
  registerReset?: (fn: () => void) => void;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [prefs, setPrefs] = useState<HomePrefs>(() => sanitizeHomePrefs(initial));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  /* ⚖️ 🆕 **وثلاثةُ مفاتيحَ سقطت من هنا** (D-434): «المستوى» و«المتابعون»
     و«التعليقات والتقييمات» **كانت تتحكّم في ترويسة الحساب**، **وقد
     غادرت الرئيسيةَ إلى الملفّ العامّ** — **ومفتاحٌ لا يغيّر ما يراه
     صاحبُه أسوأ من مفتاحٍ غائب** (D-346: زرٌّ لا أثرَ له). **وقيمُها
     باقيةٌ في العمود بلا مساس** فلا تُفقد إن عادت.

     ⬜ **ومكانُها الطبيعيُّ تبويبُ «الملفّ» في صفحة التخصيص الموحَّدة**
     (المرحلة ٤ من خطّة أحمد) — **دَينٌ مكتوبٌ لا سهو.** */
  const toggles: { key: "stats"; label: string; icon: IconName }[] = [
    { key: "stats", label: t.custStatsShort, icon: "chart" },
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
    friends: { icon: "people", label: t.railFriendsNow },
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
    drag: t.custReorder,
  };

  const posterLabel: Record<Density, string> = {
    compact: t.custPosterS,
    comfortable: t.custPosterM,
    large: t.custPosterL,
  };

  function set(next: HomePrefs) {
    setSaved(false);
    setPrefs(next);
  }

  /* **الاستعادةُ صعدت إلى الترويسة** (D-465) — وتستعيد اللوحَ كلَّه */
  useEffect(() => {
    registerReset?.(() => {
      setSaved(false);
      setPrefs({ ...DEFAULT_HOME_PREFS });
    });
  }, [registerReset]);

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
    <div className="space-y-5">
      {/* 🆕 **المعاينةُ أوّلَ الشاشة** (D-441): **ما تُغيّره يُرى قبل أن
          تحفظ**، **وشاشةُ إعداداتٍ تصف أثرَها بالكلمات تجعل الحفظَ
          تخميناً.** */}
      <CustomizePreview
        kind="home"
        title={t.custPreview}
        name={nickname}
        avatarUrl={avatarUrl}
        greeting={t.greetNeutral + "،"}
        showStats={prefs.stats}
        stats={prefs.statsPick.map((k) => ({ key: k, ...statMeta[k] }))}
        rows={prefs.order.map((k) => ({ key: k, ...sectionMeta[k] }))}
        density={prefs.density}
      />

      {/* ===== عناصر الترويسة ===== */}
      <section className="rounded-2xl border border-border bg-surface overflow-hidden">
        <h2 className="px-4 pt-3.5 pb-1 text-15 font-bold">{t.custHeaderSection}</h2>
        {toggles.map(({ key, label, icon }) => (
          <ToggleRow
            key={key}
            icon={icon}
            label={label}
            checked={prefs[key]}
            onChange={() => set({ ...prefs, [key]: !prefs[key] })}
          />
        ))}
      </section>

      {/* ===== خانات بطاقة الأرقام — **عنوانٌ خارج البطاقة** كأختِها ===== */}
      <section>
        <h2 className="px-1 text-15 font-bold">{t.custStatsCard}</h2>
        <p className="px-1 mt-0.5 mb-2 text-12 text-muted leading-relaxed">
          {t.custStatsPickHint}
        </p>

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
      <section>
        <h2 className="px-1 text-15 font-bold">{t.custSectionsTitle}</h2>
        <p className="px-1 mt-0.5 mb-2 text-12 text-muted leading-relaxed">
          {t.custSectionsHint}
        </p>

        <SectionOrderList
          all={HOME_SECTIONS}
          picked={prefs.order}
          meta={sectionMeta}
          labels={orderLabels}
          onChange={(order) => set({ ...prefs, order })}
        />
      </section>

      {/* ===== التنسيق وحجم الملصق — **بطاقةٌ واحدةٌ بصفّين** (D-465) =====
          ⚖️ **ونقضُ D-441 مسجَّلٌ باسمه**: جمعتُ هناك «كم بطاقةً في الصفّ»
          و«كم يكبر الملصق» في مفتاحٍ واحدٍ لأنهما بدَوا سؤالاً واحداً —
          **وهما رقمان مخزَّنان أصلاً** (`cards` سقفٌ يقصّ، و`density`
          عرضٌ يكبّر)، **وتصميمُ أحمد يفصلهما فصار الحقُّ معه.** */}
      <section className="rounded-2xl border border-border bg-surface overflow-hidden">
        {/* **وضعُ العرض صفٌّ لا بطاقة** (D-466): **البصريُّ والمختصرُ
            والتنسيقُ وحجمُ الملصق أوجهٌ لسؤالٍ واحد — «كيف تُرسم
            الرئيسية»** — **وثلاثُ بطاقاتٍ لسؤالٍ واحد تُقرأ ثلاثةَ
            أقسام.** **والمبدّلُ في الرئيسية هو المبدّلُ نفسُه**،
            والقيمةُ واحدةٌ في العمود (قاعدة ٦). */}
        <div className="flex items-center gap-3 min-h-14 px-4 py-2.5 border-b border-[color:var(--divider)]">
          <span className="shrink-0 text-15 font-bold">{t.custHomeView}</span>
          <span className="min-w-0 flex-1">
            <span className={pillTrack}>
              {HOME_VIEWS.map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={prefs.view === k}
                  onClick={() => set({ ...prefs, view: k })}
                  className={chipClass(prefs.view === k, "sm", "flex-1 basis-0 min-w-0 h-8")}
                >
                  {k === "visual" ? t.viewVisual : t.viewCompact}
                </button>
              ))}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-3 min-h-14 px-4 py-2.5 border-b border-[color:var(--divider)]">
          <span className="shrink-0 text-15 font-bold">{t.custLayout}</span>
          <span className="min-w-0 flex-1">
            <CardCountRow
              value={prefs.cards}
              labels={{ compact: t.cardsCompact, medium: t.cardsMedium, full: t.cardsFull }}
              onChange={(cards) => set({ ...prefs, cards })}
            />
          </span>
        </div>
        <div className="flex items-center gap-3 min-h-14 px-4 py-2.5">
          <span className="min-w-0 flex-1 text-15 font-bold">{t.custPosterSize}</span>
          <PosterSizeRow
            value={prefs.density}
            labels={posterLabel}
            onChange={(density) => set({ ...prefs, density })}
          />
        </div>
      </section>

      {error && (
        <Alert>{error}</Alert>
      )}

      <div className="space-y-2">
        <button
          onClick={save}
          disabled={pending}
          className={buttonClass({ size: "lg", full: true })}
        >
          {pending ? t.saving : t.saveChanges}
        </button>
        {saved && (
          <p role="status" className="text-center text-14 text-[color:var(--success)]">
            {t.savedOk}
          </p>
        )}
      </div>
    </div>
  );
}
