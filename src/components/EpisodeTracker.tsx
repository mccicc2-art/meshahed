"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { runOrQueue } from "@/lib/offline";
import { tap } from "@/lib/haptics";
import { episodeKey } from "@/lib/keys";
import { getDict, type Dict, type Locale } from "@/lib/i18n";
import { formatDateShort } from "@/lib/when";
import { IMG } from "@/lib/media";
import { Icon } from "./Icon";
import { ImdbMark } from "./RatingMarks";
import { Alert } from "./ui/Alert";
import { EpisodeRateSheet, type EpisodeTarget } from "./EpisodeRateSheet";
import type { EpisodeRatingRow } from "@/lib/data";

export interface TrackerEpisode {
  episode_number: number;
  name: string;
  air_date: string | null;
  runtime: number | null;
  still_path: string | null;
  /** تقييم IMDb — يصل فقط حين يُطلب الموسم بـ`r=1` (زرّ كشف التقييمات)؛
      null = طُلب فلم يوجد، undefined = لم يُطلب بعد */
  imdb_rating?: number | null;
}

/** رأس الموسم — يصل مع الصفحة بلا حلقاته، فالحلقات تُطلب عند الفتح */
export interface SeasonSummary {
  season_number: number;
  name: string;
  episode_count: number;
  aired_count: number;
}

const today = () => new Date().toISOString().slice(0, 10);

function hasAired(air_date: string | null) {
  return !!air_date && air_date <= today();
}

/** «1 يونيو · 52 د» — سطر البيانات المساعد للحلقة */
function metaLine(e: TrackerEpisode, aired: boolean, t: Dict): string {
  const parts: string[] = [];
  if (e.air_date) {
    const d = formatDateShort(e.air_date, t);
    parts.push(aired ? d : t.airsOn(d));
  }
  if (e.runtime) parts.push(t.runtimeMin(e.runtime));
  return parts.join(" · ");
}

export function EpisodeTracker({
  showTmdbId,
  summaries,
  initialSeason,
  initialEpisodes = [],
  airedTotal,
  defaultRuntime,
  initialWatched,
  initialEpisodeRatings = [],
  locale,
}: {
  showTmdbId: number;
  summaries: SeasonSummary[];
  /** الموسم الذي جاء محمّلاً مع الصفحة (فيه أول حلقة غير مشاهَدة) */
  initialSeason: number | null;
  initialEpisodes?: TrackerEpisode[];
  /** إجمالي الحلقات المعروضة — نفس الرقم المستخدم في الرئيسية والمكتبة */
  airedTotal: number;
  defaultRuntime: number | null;
  initialWatched: string[];
  /** تقييماتي في هذا المسلسل (D-139) — مفتاحُها «موسم-حلقة» */
  initialEpisodeRatings?: EpisodeRatingRow[];
  locale: Locale;
}) {
  const t = getDict(locale);
  const [watched, setWatched] = useState<Set<string>>(new Set(initialWatched));

  /* تقييماتي — خريطةٌ في الحالة لا قراءةٌ من الخادم عند كل حفظ: الورقة
     تُبلّغ بالنتيجة فيتحدّث الصفّ فوراً، كبقيّة أفعال هذه الشاشة */
  const [myRatings, setMyRatings] = useState<Map<string, { rating: number; review: string | null }>>(
    () =>
      new Map(
        initialEpisodeRatings.map((r) => [
          episodeKey(r.season_number, r.episode_number),
          { rating: r.rating, review: r.review },
        ]),
      ),
  );
  const [rateTarget, setRateTarget] = useState<EpisodeTarget | null>(null);
  const [, start] = useTransition();

  // وصلت لقطة خادمٍ جديدة (مثلاً بعد «شفته كله» من الترويسة)؟ تُعتمد هي —
  // بلا إعادة تركيبٍ تُغلق الموسم المفتوح وتضيّع موضع التمرير
  const [srvCount, setSrvCount] = useState(initialWatched.length);
  if (initialWatched.length !== srvCount) {
    setSrvCount(initialWatched.length);
    setWatched(new Set(initialWatched));
  }

  const [episodesBySeason, setEpisodesBySeason] = useState<Record<number, TrackerEpisode[]>>(
    initialSeason != null && initialEpisodes.length > 0
      ? { [initialSeason]: initialEpisodes }
      : {},
  );
  const [loading, setLoading] = useState<number | null>(null);
  const [open, setOpen] = useState<number | null>(initialSeason);
  // خطأ الكتابة يُعرض سطراً داخلياً — لا يُترك يهرب إلى error boundary
  // فيستبدل الصفحة كلها بشاشة خطأ في منتصف جلسة تأشير
  const [err, setErr] = useState<string | null>(null);

  // نفس قاعدة الرئيسية والمكتبة: ما أشّرته ÷ ما عُرض
  const watchedAired = Math.min(watched.size, airedTotal || watched.size);
  const progress = airedTotal ? Math.round((watchedAired / airedTotal) * 100) : 0;

  /* ===== تقييمات الحلقات — مخفية افتراضياً (طلب أحمد: «بعض الأحيان
     تعتبر حرق») ===== تُجلب عند أول ضغطة كشفٍ وحدها: جلبها مع كل موسم
     كان سيحرق حصة OMDb على من لا يريدها. طلبٌ واحد للموسم كله (OMDb
     يعيد الموسم بحلقاته)، والردّ يستبدل حلقات الموسم بنسختها المقيَّمة */
  const [showRatings, setShowRatings] = useState(false);
  const showRatingsRef = useRef(false);
  const ratedRef = useRef<Set<number>>(new Set());

  const loadRatings = useCallback(
    async (n: number) => {
      if (ratedRef.current.has(n)) return;
      ratedRef.current.add(n); // يمنع طلباً مكرّراً أثناء الرحلة
      try {
        const res = await fetch(`/api/season?tv=${showTmdbId}&s=${n}&r=1`);
        if (!res.ok) throw new Error(`season ${res.status}`);
        const json = (await res.json()) as { episodes: TrackerEpisode[] };
        const eps = json.episodes ?? [];
        if (eps.length) setEpisodesBySeason((prev) => ({ ...prev, [n]: eps }));
      } catch {
        // فشل صامت — الرقم زينة اختيارية؛ يُعاد السعي عند ضغطةٍ قادمة
        ratedRef.current.delete(n);
      }
    },
    [showTmdbId],
  );

  function toggleRatings() {
    const next = !showRatings;
    showRatingsRef.current = next;
    setShowRatings(next);
    tap(8);
    if (next) {
      for (const k of Object.keys(episodesBySeason)) void loadRatings(Number(k));
    }
  }

  const loadSeason = useCallback(
    async (n: number): Promise<TrackerEpisode[]> => {
      const have = episodesBySeason[n];
      if (have) return have;
      setLoading(n);
      try {
        const res = await fetch(`/api/season?tv=${showTmdbId}&s=${n}`);
        // فشل الطلب (429 أو 502) لا يُخزَّن قائمةً فارغة — التخزين كان
        // يجعل الموسم يبدو «بلا حلقات» إلى أن يُعاد تحميل الصفحة
        if (!res.ok) throw new Error(`season ${res.status}`);
        const json = (await res.json()) as { episodes: TrackerEpisode[] };
        const eps = json.episodes ?? [];
        setEpisodesBySeason((prev) => ({ ...prev, [n]: eps }));
        // التقييمات مكشوفة؟ موسمٌ يُفتح لاحقاً يلحق بها من نفس الضغطة
        if (showRatingsRef.current) void loadRatings(n);
        return eps;
      } catch {
        setErr(t.showLoadFailed);
        return [];
      } finally {
        setLoading(null);
      }
    },
    [episodesBySeason, showTmdbId, t.showLoadFailed, loadRatings],
  );

  // الموسم المفتوح افتراضياً يُحمَّل من هنا لا من الخادم: الصفحة كانت
  // تنتظر رحلة TMDB تسلسلية له قبل أول بايت — الآن الترويسة ترسم فوراً
  // وهيكل الحلقات يظهر ريثما يصل الموسم
  const bootRef = useRef(false);
  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;
    if (open != null && !episodesBySeason[open]) {
      // تأجيلُ microtask واحد: تغيير الحالة لا يقع متزامناً داخل جسد
      // الـeffect فلا يفتح سلسلة رسمٍ متتابعة — والجلب يبدأ في نفس اللحظة
      void Promise.resolve().then(() => loadSeason(open));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleOpen(n: number) {
    if (open === n) {
      setOpen(null);
      return;
    }
    setOpen(n);
    if (!episodesBySeason[n]) void loadSeason(n);
  }

  /**
   * كل الحلقات المعروضة حتى حلقة معيّنة، مرتّبة زمنياً.
   * المواسم السابقة تُشتقّ من عدد حلقاتها المعروضة (بلا تحميل)، والموسم
   * الحالي من حلقاته المحمّلة فعلاً.
   */
  const airedUpTo = useCallback(
    (season: number, episode: number) => {
      const list: { season: number; episode: number; runtime: number | null }[] = [];
      for (const s of summaries) {
        if (s.season_number > season) break;
        const loaded = episodesBySeason[s.season_number];
        // فهرسة الحلقات المحمّلة مرة واحدة بدل بحثٍ خطّي داخل حلقة —
        // كانت O(n²) على مواسم الأنمي الطويلة
        const byNum = loaded ? new Map(loaded.map((x) => [x.episode_number, x])) : null;
        const limit =
          s.season_number === season ? episode : Math.min(s.aired_count, s.episode_count);
        for (let e = 1; e <= limit; e++) {
          const ep = byNum?.get(e);
          if (s.season_number === season && ep && !hasAired(ep.air_date)) continue;
          list.push({ season: s.season_number, episode: e, runtime: ep?.runtime ?? defaultRuntime });
        }
      }
      return list;
    },
    [summaries, episodesBySeason, defaultRuntime],
  );

  // مواسم بمئات الحلقات لا تُرسم دفعة واحدة: ١٥٠ صفاً ثم زرّ للبقية
  const CHUNK = 150;
  const [shownAll, setShownAll] = useState<Set<number>>(new Set());

  function toggleOne(season: number, ep: TrackerEpisode) {
    const key = episodeKey(season, ep.episode_number);
    const next = !watched.has(key);
    tap(10);

    setErr(null);

    // عند التأشير: تُعتبر كل الحلقات السابقة مشاهَدة أيضاً
    if (next) {
      const upTo = airedUpTo(season, ep.episode_number);
      const toMark = upTo.filter((o) => !watched.has(episodeKey(o.season, o.episode)));
      const before = watched;

      setWatched((prev) => {
        const s = new Set(prev);
        for (const o of upTo) s.add(episodeKey(o.season, o.episode));
        return s;
      });

      // فشل الكتابة (حدّ المعدّل مثلاً) يعيد العلامات لحالها ويقول لماذا —
      // كان الاستثناء يهرب من startTransition إلى error boundary فتُستبدل
      // الصفحة كلها بشاشة خطأ، والعلامة المتفائلة تبقى كاذبة للجلسة كلها
      start(async () => {
        try {
          if (toMark.length > 1) {
            await runOrQueue("watchUpTo", { showTmdbId, episodes: toMark });
          } else {
            await runOrQueue("toggleEpisode", {
              showTmdbId,
              season,
              episode: ep.episode_number,
              runtime: ep.runtime,
              watched: true,
            });
          }
          /* **ورقةُ «ما تقييمك لها؟» فور التأشير** (D-192 — توسيعُ D-158
             إلى الحلقات، طلب أحمد: «أي وقت أحطّ علامة صحّ على فيلم أو
             حلقة تطلع فوجهي رسالة التقييم والتعليق، بحيث نساعدهم على
             التفاعل»).

             **وأربعةُ قيودٍ ترثها عن D-158 حرفاً بحرف، وهي ما يجعلها
             عوناً لا مضايقة:**
             ١) **بعد الختم لا قبله** — لو سبقت الكتابة لصارت شرطاً
                للمشاهدة، والمشاهدةُ لا تنتظر رأياً.
             ٢) **عرضٌ لا تأكيد** — الورقة تُغلق بلا حفظٍ ولا يتغيّر شيء،
                فلا تنقض D-047 («لا حوارَ تأكيدٍ على فعلٍ قابلٍ للعكس»).
             ٣) **ومن قيّمها من قبلُ لا يُسأل** — إعادةُ السؤال عن رأيٍ
                مكتوبٍ إهانةٌ صغيرة، والشرطُ أدناه هو كلُّ الفرق.
             ٤) **ولا تُفتح عند إلغاء التأشير** — الفرعُ الآخر أدناه.

             **وحدُّها الخامس يخصّ الحلقات وحدها:** التأشير قد يختم
             حلقاتٍ سابقةً معه (`watchUpTo`)، **والسؤالُ عن التي لمسها
             هو وحدها** — لا عن عشرٍ ختمها المرورُ. */
          if (!myRatings.has(key)) {
            setRateTarget({
              season,
              episode: ep.episode_number,
              name: ep.name,
              runtime: ep.runtime ?? defaultRuntime,
              rating: null,
              review: null,
            });
          }
        } catch (e) {
          setWatched(before);
          setErr((e as Error).message);
        }
      });
      return;
    }

    // عند إلغاء التأشير: تُلغى هذه الحلقة فقط
    const beforeUnmark = watched;
    setWatched((prev) => {
      const s = new Set(prev);
      s.delete(key);
      return s;
    });
    start(async () => {
      try {
        await runOrQueue("toggleEpisode", {
          showTmdbId,
          season,
          episode: ep.episode_number,
          runtime: ep.runtime,
          watched: false,
        });
      } catch (e) {
        setWatched(beforeUnmark);
        setErr((e as Error).message);
      }
    });
  }

  function toggleSeason(s: SeasonSummary, mark: boolean) {
    setErr(null);
    start(async () => {
      const eps = await loadSeason(s.season_number);
      const aired = eps.filter((e) => hasAired(e.air_date));
      if (!aired.length) return;
      const before = watched;
      setWatched((prev) => {
        const set = new Set(prev);
        for (const e of aired) {
          const key = episodeKey(s.season_number, e.episode_number);
          if (mark) set.add(key);
          else set.delete(key);
        }
        return set;
      });
      try {
        await runOrQueue("setSeasonWatched", {
          showTmdbId,
          episodes: aired.map((e) => ({
            season: s.season_number,
            episode: e.episode_number,
            runtime: e.runtime,
          })),
          watched: mark,
        });
      } catch (e) {
        setWatched(before);
        setErr((e as Error).message);
      }
    });
  }

  const watchedPerSeason = useMemo(() => {
    const m = new Map<number, number>();
    for (const key of watched) {
      const s = Number(key.split(":")[0]);
      m.set(s, (m.get(s) ?? 0) + 1);
    }
    return m;
  }, [watched]);

  return (
    <div>
      <div className="mb-5">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-muted">{t.watchedOf(watchedAired, airedTotal)}</span>
          {/* 🆕 **والعمودُ الخاتم واحدٌ من أعلى الصفحة إلى أسفلها** (D-413،
              طلبُ أحمد: «القلم والنجمة خلّهم تحت الثلاث نقاط»): كانت
              النجمةُ تسبق النسبةَ فتقع على بُعد ٦٧px من الحافّة **ونقاطُ
              «المزيد» على ٢٦** — **ثلاثةُ محاورَ في طرفٍ واحد.**
              **فصارت النجمةُ آخرَ الصفّ** وبإزاحةٍ سالبةٍ تُلغي حشوَها،
              **فمركزُها على محور النقاط بالضبط.** */}
          <span className="flex items-center gap-1.5">
            <span className="font-semibold text-accent-2">{progress}%</span>
            <button
              type="button"
              onClick={toggleRatings}
              aria-pressed={showRatings}
              aria-label={showRatings ? t.epRatingsHide : t.epRatingsShow}
              title={showRatings ? t.epRatingsHide : t.epRatingsShow}
              className={`grid place-items-center w-9 h-9 -my-2 -me-1.5 rounded-full transition ${
                showRatings
                  ? "text-accent bg-accent/10"
                  : "text-muted hover:text-foreground hover:bg-surface-2"
              }`}
            >
              <Icon name="star" size={16} />
            </button>
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
          {/* scaleX لا width: تحريك width يعيد التخطيط كل إطار — التحويل
              يجري على المركّب. نقطة الأصل من جهة البداية في الاتجاهين */}
          <div
            className="h-full w-full rounded-full bg-accent origin-left rtl:origin-right transition-transform duration-500"
            style={{ transform: `scaleX(${progress / 100})` }}
          />
        </div>
        <p className="text-xs text-muted mt-2">{t.cascadeHint}</p>
        {err && (
          <Alert inline className="mt-2.5">
            {err}
          </Alert>
        )}
      </div>

      <div className="space-y-3">
        {summaries.map((s) => {
          const isOpen = open === s.season_number;
          const episodes = episodesBySeason[s.season_number];
          const seasonWatched = Math.min(
            watchedPerSeason.get(s.season_number) ?? 0,
            s.aired_count || s.episode_count,
          );
          const allWatched = s.aired_count > 0 && seasonWatched >= s.aired_count;

          return (
            <div
              key={s.season_number}
              className="rounded-2xl border border-border bg-surface overflow-hidden"
            >
              <div className="flex items-center gap-2 px-3.5 py-1">
                <button
                  onClick={() => toggleOpen(s.season_number)}
                  aria-expanded={isOpen}
                  aria-label={t.seasonToggleAria(s.season_number)}
                  className="flex-1 flex items-center gap-2.5 text-start py-2.5 -my-1"
                >
                  <Icon
                    name="chevron-down"
                    size={16}
                    className={`text-muted transition-transform duration-300 ${isOpen ? "" : "-rotate-90 rtl:rotate-90"}`}
                  />
                  <span className="font-semibold text-[15px]">
                    {s.name || t.seasonLabel(s.season_number)}
                  </span>
                  <span className="text-xs text-muted tabular-nums" dir="ltr">
                    {seasonWatched}/{s.aired_count}
                  </span>
                  {loading === s.season_number && (
                    <span className="text-xs text-muted">{t.loadingLabel}</span>
                  )}
                  {/* الموسم المكتمل يحمل صحّاً رفيعاً هادئاً في طرفه */}
                  {allWatched && (
                    <Icon
                      name="check-line"
                      size={16}
                      strokeWidth={2.2}
                      className="ms-auto text-[color:var(--success)]"
                    />
                  )}
                </button>
                {s.aired_count > 0 && (
                  <button
                    onClick={() => toggleSeason(s, !allWatched)}
                    className={`shrink-0 text-xs font-semibold px-2.5 py-2 rounded-lg transition ${
                      allWatched
                        ? "text-muted hover:text-foreground hover:bg-surface-2"
                        : "text-accent-2 hover:bg-accent-2/10"
                    }`}
                  >
                    {allWatched ? t.seasonUndo : t.seasonAll}
                  </button>
                )}
              </div>

              {/* شريط تقدّم الموسم: خيط بثلاث بكسلات يغني عن قراءة الأرقام */}
              {s.aired_count > 0 && (
                <div className="h-[3px] bg-surface-2">
                  <div
                    className="h-full w-full bg-accent/80 origin-left rtl:origin-right transition-transform duration-500"
                    style={{
                      transform: `scaleX(${Math.min(1, seasonWatched / s.aired_count)})`,
                    }}
                  />
                </div>
              )}

              {isOpen && (
                <div className="acc-in">
                  {!episodes ? (
                    <ul className="divide-y divide-[color:var(--divider)] border-t border-border">
                      {Array.from({ length: Math.min(s.episode_count, 6) }, (_, i) => (
                        <li key={i} className="flex items-center gap-3 px-3.5 py-2.5">
                          <span className="skeleton shrink-0 w-[22px] h-[22px] rounded-full" />
                          <span className="skeleton shrink-0 w-14 sm:w-20 aspect-video rounded-lg" />
                          <span className="skeleton h-3 flex-1 rounded" />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <ul className="divide-y divide-[color:var(--divider)] border-t border-border">
                      {(shownAll.has(s.season_number)
                        ? episodes
                        : episodes.slice(0, CHUNK)
                      ).map((e) => {
                        const key = episodeKey(s.season_number, e.episode_number);
                        const isWatched = watched.has(key);
                        const epAired = hasAired(e.air_date);
                        return (
                          <li
                            key={e.episode_number}
                            className={`flex items-center gap-3 px-3.5 py-2.5 transition-colors ${
                              !epAired ? "opacity-50" : "active:bg-surface-2"
                            }`}
                          >
                            <button
                              disabled={!epAired}
                              onClick={() => toggleOne(s.season_number, e)}
              /* مساحة اللمس ٤٤ بكسلاً والمربّع المرئي ٢٠: الإصبع لا يصيب
                 مربّعاً بعرض ٢٠ بكسلاً في صفٍّ مزدحم، والهامش السالب يمنع
                 الحشوة من إزاحة الصف */
                              className={`shrink-0 w-11 h-11 -my-2.5 -ms-2.5 grid place-items-center ${
                                !epAired ? "cursor-not-allowed" : ""
                              }`}
                              aria-pressed={isWatched}
                              aria-label={`${t.markWatchedAria} — ${e.episode_number}. ${e.name}`}
                            >
                              {/* صحٌّ رفيع داخل دائرة تختفي عند التأشير — أخفّ
                                  بصرياً من مربّع مملوء يتكرّر مئات المرّات */}
                              <span
                                className={`w-[22px] h-[22px] rounded-full border-[1.5px] grid place-items-center transition-colors ${
                                  isWatched
                                    ? "border-transparent text-[color:var(--success)]"
                                    : "border-border text-transparent hover:border-accent/50"
                                }`}
                              >
                                {isWatched && (
                                  <Icon
                                    name="check-line"
                                    size={16}
                                    strokeWidth={2.2}
                                    className="check-pop"
                                  />
                                )}
                              </span>
                            </button>

                            {/* صورة أصغر: كانت ٦٤ بكسلاً عرضاً فيصير الصف ١٢٦ بكسلاً،
                                واثنتا عشرة حلقة = ألف ونصف بكسل من التمرير.
                                المصغّرة هنا للتعرّف لا للمشاهدة. */}
                            {/* `next/image` لا وسمَ صورةٍ خام: الخام يطلب TMDB
                                من المتصفّح مباشرةً وكان لا يظهر عند المستخدم،
                                بينما بقيّةُ صور التطبيق تمرّ به من نطاقنا */}
                            <span className="relative shrink-0 w-14 sm:w-20 aspect-video rounded-lg overflow-hidden bg-surface-2 border border-white/[0.06]">
                              {e.still_path ? (
                                <Image
                                  src={`${IMG}/w185${e.still_path}`}
                                  alt=""
                                  fill
                                  sizes="(max-width: 640px) 56px, 80px"
                                  className="object-cover"
                                />
                              ) : (
                                <span
                                  className="w-full h-full grid place-items-center text-muted text-sm"
                                  aria-hidden
                                >
                                  <Icon name="film" size={14} />
                                </span>
                              )}
                            </span>

                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-semibold truncate leading-tight">
                                <span className="text-muted font-medium tabular-nums">
                                  {e.episode_number}.
                                </span>{" "}
                                {e.name}
                              </p>
                              <p className="text-[12px] text-muted mt-1 truncate sm:hidden">
                                {metaLine(e, epAired, t)}
                              </p>
                            </div>

                            {/* تقييم الحلقة — يظهر فقط بعد ضغطة الكشف؛
                                شعار IMDb نفسه (D-093: لا رقم بلا مصدره) */}
                            {showRatings && typeof e.imdb_rating === "number" && (
                              <span
                                className="shrink-0 inline-flex items-center gap-1 text-[12px] font-bold tabular-nums"
                                dir="ltr"
                                aria-label={`IMDb ${e.imdb_rating.toFixed(1)}`}
                              >
                                <ImdbMark className="text-[8px]" />
                                {e.imdb_rating.toFixed(1)}
                              </span>
                            )}

                            {/* **تقييمي أنا — بابٌ دائم لا يظهر بضغطة كشف**
                                (D-139): زرّ كشف التقييمات يخصّ أرقام IMDb
                                لأنها حرقٌ محتمل لحلقةٍ لم تُشاهَد؛ أما رأيك
                                أنت فليس حرقاً عليك، وإخفاؤه خلف ضغطةٍ يدفن
                                الفعل الذي جاء المستخدم من أجله.
                                والحلقة التي لم تُبثّ لا تُقيَّم. */}
                            {epAired && (
                              <button
                                type="button"
                                onClick={() => {
                                  tap(8);
                                  const mine = myRatings.get(
                                    episodeKey(s.season_number, e.episode_number),
                                  );
                                  setRateTarget({
                                    season: s.season_number,
                                    episode: e.episode_number,
                                    name: e.name,
                                    runtime: e.runtime ?? defaultRuntime,
                                    rating: mine?.rating ?? null,
                                    review: mine?.review ?? null,
                                  });
                                }}
                                aria-label={t.epRateAria(s.season_number, e.episode_number)}
                                /* 🆕 **على محور النقاط، وعلى سطر اسم
                                   الحلقة** (D-413): كانت في وسط الصفّ
                                   رأسياً وعلى بُعد ٤١px من الحافّة —
                                   **فلا هي تحت النقاط ولا هي بمحاذاة
                                   الاسم.** */
                                className="shrink-0 self-start mt-0.5 -me-2 inline-flex items-center gap-1 text-[12px] font-bold tabular-nums px-1.5 py-1 rounded-lg hover:bg-surface-2 transition"
                                dir="ltr"
                              >
                                {(() => {
                                  const mine = myRatings.get(
                                    episodeKey(s.season_number, e.episode_number),
                                  );
                                  return mine ? (
                                    <>
                                      <span className="text-accent">★</span>
                                      <span>{mine.rating}</span>
                                    </>
                                  ) : (
                                    <span className="text-muted/40 hover:text-muted transition">
                                      ★
                                    </span>
                                  );
                                })()}
                              </button>
                            )}

                            <span className="hidden sm:block shrink-0 text-xs text-muted text-end tabular-nums">
                              {metaLine(e, epAired, t)}
                            </span>
                          </li>
                        );
                      })}
                      {!shownAll.has(s.season_number) && episodes.length > CHUNK && (
                        <li>
                          <button
                            onClick={() =>
                              setShownAll((prev) => new Set(prev).add(s.season_number))
                            }
                            className="w-full py-3 text-[14px] font-bold text-accent hover:bg-surface-2 transition"
                          >
                            {t.showRestEps(episodes.length - CHUNK)}
                          </button>
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <EpisodeRateSheet
        showTmdbId={showTmdbId}
        target={rateTarget}
        locale={locale}
        onClose={() => setRateTarget(null)}
        onSaved={(season, episode, rating, review) => {
          const k = episodeKey(season, episode);
          setMyRatings((prev) => {
            const next = new Map(prev);
            if (rating === null) next.delete(k);
            else next.set(k, { rating, review });
            return next;
          });
          /* التقييم يعني المشاهدة (قرار أحمد): الصفّ يعلّم نفسه فوراً
             بدل انتظار جولةٍ إلى الخادم — والقاعدة كتبتهما معاً أصلاً */
          if (rating !== null) {
            setWatched((prev) => (prev.has(k) ? prev : new Set(prev).add(k)));
          }
        }}
      />
    </div>
  );
}
