import "server-only";

import {
  getFollows,
  getMyAnimeFlags,
  getTitleMetaFor,
  getWatchWindow,
  type FollowRow,
  type HistoryRow,
  type TitleMetaRow,
} from "@/lib/data";
import { browseGenreForId, browseGenreName } from "@/lib/browse";
import { runtimeMinutes } from "@/lib/watchTime";
import { getDict, type Locale } from "@/lib/i18n";
import { UTC, zoneShiftMs } from "@/lib/zone";

/**
 * ================= مصدرُ الإحصائيات الواحد (D-799) =================
 *
 * **شرطُ أحمد المكتوب**: «أنشئ مصدرَ بياناتٍ موحّداً لجميع التبويبات حتى
 * لا تتعارض الأرقام بين Your Report وOverview وContent وTaste وHabits —
 * **إذا كان الإجمالي 12h 48m في التقرير يجب أن يبقى نفسَه في جميع
 * التبويبات للفترة ذاتها**».
 *
 * 🔑 **فالحسابُ يقع مرّةً واحدةً هنا، وكلُّ سطحٍ يقرأ منه** — **وخمسةُ
 * أسطحٍ تحسب كلٌّ لنفسها هي خمسةُ أرقامٍ تفترق عند أوّل تعديل** (D-145).
 * **وقد وقع ذلك فعلاً قبل يومٍ واحد**: `/stats` تقدّر الحلقةَ ٤٠ دقيقةً
 * والتقريرُ ٤٢، **فاختلفت الصفحتان ٦٣ ساعةً على الصفوف نفسِها** (D-797).
 *
 * ⚠️ **وما لا نملكه لا يُخترع** (شرطُه: «لا تستخدم أرقاماً تجريبيّةً
 * ثابتة»): **لا أجهزةَ ولا خدماتٍ مرتبطةٍ في Loopz اليوم** — **فالقسمان
 * لا يُرسمان**، ولا يُستنتج المزوّدُ من TMDB (نصُّ شرطه).
 *
 * ⚠️ **وساعةُ اليوم تُقرأ من لحظة التعليم** — وهي أقربُ ما نملك (D-797).
 * **والصفوفُ المؤرَّخةُ رجعيّاً تُستبعد من كلِّ حسابٍ يعتمد الساعة**:
 * D-798 تكتب لها منتصفَ النهار بالضبط علامةً، **وخريطةُ حرارةٍ يملؤها
 * وسمُ نظامٍ تكذب على صاحبها.**
 */

export type StatsPeriod = "week" | "month" | "year" | "all";

export const STATS_PERIODS: readonly StatsPeriod[] = ["week", "month", "year", "all"] as const;

export function asStatsPeriod(raw: string | null | undefined): StatsPeriod {
  return raw === "month" || raw === "year" || raw === "all" ? raw : "week";
}

/** إزاحةُ الفترة — صفرٌ الحاليّة، وسالبٌ إلى الماضي. **ولا مستقبل** (شرطُه) */
export function asOffset(raw: string | null | undefined): number {
  const n = Number(raw);
  return Number.isSafeInteger(n) && n < 0 && n > -520 ? n : 0;
}

/** **الصفُّ المؤرَّخُ رجعيّاً** — منتصفُ النهار بالضبط، وسمُ D-798 */
function isBackdated(iso: string): boolean {
  return iso.slice(11, 19) === "12:00:00";
}

export interface StatsRange {
  /** **بفضاء ساعة الحائط** — تُقارَن بلحظةٍ مُزاحةٍ مثلَها، لا بلحظةٍ خام */
  from: Date;
  to: Date;
  /** إزاحةُ منطقة القارئ بالملّي — صفرٌ لمن لا منطقةَ له (D-806) */
  shift: number;
  label: string;
  /** أيّامُ المدّة — للمتوسّط اليوميّ ولطول المدّة السابقة */
  days: number;
  canGoNext: boolean;
}

/** **حدودُ الفترة تقويميّةٌ لا «آخر ٧ أيّام»**: «Aug 24–30» أسبوعٌ يبدأ الأحد */
/**
 * 🔴 🆕 **والتقويمُ تقويمُ القارئ لا تقويمُ غرينتش** (D-806): «هذا
 * الأسبوع» يبدأ أحدَه هو، **ومن علّم حلقةً الحاديةَ عشرةَ ليلاً في
 * الرياض كان يقع في يوم غدٍ بغرينتش** — **فتُحسب في مدّةٍ لم يكن فيها.**
 * **والحدودُ تُحسب في فضاء ساعة الحائط** (اللحظةُ + الإزاحة) **وتُقرأ
 * بـ`timeZone: "UTC"`** — فتخرج الأسماءُ صحيحةً بلا حسابٍ ثانٍ.
 */
export function statsRange(
  period: StatsPeriod,
  offset: number,
  locale: Locale,
  tz: string = UTC,
): StatsRange {
  const shift = zoneShiftMs(tz);
  const now = new Date(Date.now() + shift);
  const loc = locale === "en" ? "en-GB" : "ar";
  let from: Date;
  let to: Date;
  if (period === "week") {
    const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    base.setUTCDate(base.getUTCDate() - base.getUTCDay() + offset * 7);
    from = base;
    to = new Date(base);
    to.setUTCDate(to.getUTCDate() + 6);
  } else if (period === "month") {
    from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
    to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 0));
  } else if (period === "year") {
    from = new Date(Date.UTC(now.getUTCFullYear() + offset, 0, 1));
    to = new Date(Date.UTC(from.getUTCFullYear(), 11, 31));
  } else {
    /* **«كلُّ الأوقات» مدّةٌ بلا سابقة**: تبدأ قبل أوّل صفٍّ بأمان وتنتهي
       اليوم — **ولا سهمَ يتقدّم ولا يتأخّر فيها** (لا فترةَ قبلها). */
    from = new Date(Date.UTC(2000, 0, 1));
    to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;

  let label: string;
  if (period === "week") {
    /* 🔴 **`formatRange` لا تركيبٌ بيدي** (D-800، بعد أوّل قراءةٍ حيّة):
       **ركّبتُ «٢٣ أغسطس – ٢٩» بالوصل فقلبها محرّكُ الاتجاهين إلى
       «23 أغسطس – 29»** — **ومدىً يُقرأ معكوساً في العربيّة يكذب على
       قارئه.** **و`Intl` تعرف أين يقع الشهرُ في كلِّ لغة**، فتخرج
       «٢٣–٢٩ أغسطس» و«Aug 23 – 29» بلا شرطٍ مكتوبٍ بيدي. */
    label = new Intl.DateTimeFormat(loc, {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).formatRange(from, to);
  } else if (period === "month") {
    label = new Intl.DateTimeFormat(loc, { month: "long", year: "numeric", timeZone: "UTC" }).format(from);
  } else if (period === "year") {
    label = String(from.getUTCFullYear());
  } else {
    label = locale === "en" ? "All time" : "كل الأوقات";
  }
  return { from, to, label, days, canGoNext: period !== "all" && offset < 0, shift };
}

export interface StatTitle {
  key: string;
  tmdbId: number;
  mediaType: "tv" | "movie";
  title: string;
  poster: string | null;
  minutes: number;
  episodes: number;
  kind: "shows" | "movies" | "anime";
}

export interface StatBucket {
  label: string;
  minutes: number;
  prevMinutes: number;
  /** يومٌ بعينه — لأكثفِ يومٍ ولسلسلة الأيّام */
  dayKey?: string;
}

export interface PeriodStats {
  period: StatsPeriod;
  offset: number;
  range: StatsRange;
  /** لا بياناتٍ في المدّة إطلاقاً */
  empty: boolean;

  minutes: number;
  prevMinutes: number;
  deltaPct: number | null;
  dailyAvgMin: number;
  episodes: number;
  movies: number;
  titles: number;

  buckets: StatBucket[];
  peak: { label: string; minutes: number } | null;
  streak: number;
  /** أيّامٌ فيها مشاهدة — حلقةُ «٥ / ٧ أيّام» */
  activeDays: number;
  /** 🆕 **الأيّامُ المنقضيةُ من المدّة** (D-808) — قاسمُ المعدّل اليوميّ */
  elapsedDays: number;
  /**
   * 🆕 **اليومُ المستحيل** (D-801 — حكمُ أحمد): **يومٌ مجموعُه أكثرُ من
   * ٢٤ ساعةً ليس مشاهدةً، هو أثرُ تعليم.** **والحكمُ يقع هنا مرّةً**
   * ليقرأه التقريرُ والتبويبات، **فلا يكتشف كلُّ سطحٍ الاستحالةَ وحدَه.**
   */
  impossible: { days: number; worstMinutes: number };

  mix: { key: "shows" | "movies" | "anime"; minutes: number; pct: number }[];
  status: { started: number; completed: number; inProgress: number; rewatched: number };
  completionPct: number;

  topTitles: StatTitle[];
  releaseYears: { decade: number; pct: number }[];

  taste: {
    genres: { slug: string; name: string; pct: number }[];
    languages: { code: string; name: string; pct: number }[];
    countries: { code: string; name: string; pct: number }[];
    radar: { key: string; label: string; score: number }[];
    shift: { label: string; delta: number }[];
    artists: { name: string; photo: string | null; minutes: number }[];
    /** بياناتٌ أقلُّ من أن تُقرأ ذوقاً — **ولا استنتاجَ غيرَ موثوق** (شرطُه) */
    thin: boolean;
  };

  habits: {
    /** صفوفٌ تحمل ساعةً حقيقيّة — **وصفرٌ يعني: لا تُرسم عاداتُ الساعة** */
    timedRows: number;
    /** ٤ فتراتٍ × ٧ أيّام — دقائق */
    heat: number[][];
    timeOfDay: { key: "morning" | "afternoon" | "evening" | "night"; pct: number }[];
    sessions: number;
    avgSessionMin: number;
    longestSessionMin: number;
    /** نافذةُ الذروة بالساعات (بداية، نهاية) بتوقيت UTC */
    primeHours: [number, number] | null;
    rhythm: "weekend" | "night" | "binge" | "steady" | null;
  };
}

const BANDS: { key: "morning" | "afternoon" | "evening" | "night"; from: number; to: number }[] = [
  { key: "morning", from: 5, to: 11 },
  { key: "afternoon", from: 12, to: 16 },
  { key: "evening", from: 17, to: 21 },
  { key: "night", from: 22, to: 4 },
];

function bandOf(hour: number): number {
  if (hour >= 5 && hour <= 11) return 0;
  if (hour >= 12 && hour <= 16) return 1;
  if (hour >= 17 && hour <= 21) return 2;
  return 3;
}

/** **مفتاحُ اليوم في تقويم القارئ** — لا في تقويم غرينتش (D-806) */
const dayKeyIn = (iso: string, shift: number) =>
  new Date(Date.parse(iso) + shift).toISOString().slice(0, 10);

/** الاسمُ المعروضُ للغة — **من `Intl` لا من جدولٍ يدويّ يتقادم** */
function langName(code: string, locale: Locale): string {
  try {
    return (
      new Intl.DisplayNames([locale === "en" ? "en" : "ar"], { type: "language" }).of(code) ?? code
    );
  } catch {
    return code;
  }
}

function regionName(code: string, locale: Locale): string {
  try {
    return (
      new Intl.DisplayNames([locale === "en" ? "en" : "ar"], { type: "region" }).of(code) ?? code
    );
  } catch {
    return code;
  }
}

/**
 * **الحسابُ كلُّه في مرورٍ واحدٍ على الصفوف** — والقراءةُ نافذتان
 * (المدّةُ والتي قبلها) في استعلامٍ واحد.
 */
export async function buildPeriodStats(
  period: StatsPeriod,
  offset: number,
  locale: Locale,
  tz: string = UTC,
): Promise<PeriodStats> {
  const t = getDict(locale);
  const range = statsRange(period, offset, locale, tz);
  const prevFrom = new Date(range.from);
  prevFrom.setUTCDate(prevFrom.getUTCDate() - range.days);

  /* 🔴 🆕 **كلُّ لحظةٍ تُقرأ في فضاء ساعة الحائط** (D-806): `at(iso)`
     تزيح، **وكلُّ ما بعدها يبقى `getUTC*` كما كُتب** — **فالحسابُ لم
     يُعَد كتابتُه، تغيّرت قراءتُه.** ⚠️ **والحدُّ الذي يُرسل إلى
     القاعدة لحظةٌ حقيقيّةٌ لا مُزاحة** — فيُطرح منها ما أُضيف. */
  const tzShift = range.shift;
  const at = (iso: string) => Date.parse(iso) + tzShift;

  const [rows, follows, animeFlags] = await Promise.all([
    getWatchWindow(new Date(prevFrom.getTime() - tzShift).toISOString()),
    getFollows().catch(() => [] as FollowRow[]),
    getMyAnimeFlags().catch(() => new Map<string, boolean>()),
  ]);

  const fromMs = range.from.getTime();
  const toMs = range.to.getTime() + 86_400_000 - 1;
  const inRange = (r: HistoryRow) => {
    const ms = at(r.watchedAt);
    return ms >= fromMs && ms <= toMs;
  };
  const current = rows.filter(inRange);
  const previous = rows.filter((r) => at(r.watchedAt) < fromMs);

  const meta = new Map<string, FollowRow>(
    follows.map((f) => [`${f.media_type}-${f.tmdb_id}`, f]),
  );
  const kindOf = (key: string, mediaType: "tv" | "movie"): "shows" | "movies" | "anime" =>
    animeFlags.get(key) === true ? "anime" : mediaType === "movie" ? "movies" : "shows";

  const byTitle = new Map<string, StatTitle>();
  const byDay = new Map<string, number>();
  const mixMin = { shows: 0, movies: 0, anime: 0 };
  const heat: number[][] = [0, 1, 2, 3].map(() => new Array(7).fill(0));
  const byHour = new Array(24).fill(0) as number[];
  let timedRows = 0;
  let minutes = 0;
  let episodes = 0;
  let movies = 0;

  for (const row of current) {
    const mediaType = row.kind === "movie" ? "movie" : "tv";
    const key = `${mediaType}-${row.tmdbId}`;
    const mins = runtimeMinutes(row.kind, row.runtime);
    minutes += mins;
    if (row.kind === "movie") movies += 1;
    else episodes += 1;

    const day = dayKeyIn(row.watchedAt, tzShift);
    byDay.set(day, (byDay.get(day) ?? 0) + mins);

    const kind = kindOf(key, mediaType);
    mixMin[kind] += mins;

    if (!isBackdated(row.watchedAt)) {
      timedRows += 1;
      const d = new Date(at(row.watchedAt));
      const hour = d.getUTCHours();
      byHour[hour] += mins;
      heat[bandOf(hour)][d.getUTCDay()] += mins;
    }

    const follow = meta.get(key);
    const entry = byTitle.get(key);
    if (entry) {
      entry.minutes += mins;
      entry.episodes += row.kind === "movie" ? 0 : 1;
    } else {
      byTitle.set(key, {
        key,
        tmdbId: row.tmdbId,
        mediaType,
        title: follow?.title ?? `#${row.tmdbId}`,
        poster: follow?.poster_path ?? null,
        minutes: mins,
        episodes: row.kind === "movie" ? 0 : 1,
        kind,
      });
    }
  }

  const prevMinutes = previous.reduce((n, r) => n + runtimeMinutes(r.kind, r.runtime), 0);
  const prevByDay = new Map<string, number>();
  for (const r of previous) {
    const k = dayKeyIn(r.watchedAt, tzShift);
    prevByDay.set(k, (prevByDay.get(k) ?? 0) + runtimeMinutes(r.kind, r.runtime));
  }

  /* ═══ الأعمدة: أيّامٌ للأسبوع، أيّامٌ للشهر، شهورٌ للسنة ═══ */
  const loc = locale === "en" ? "en-GB" : "ar";
  const buckets: StatBucket[] = [];
  if (period === "all") {
    /* **الأعمدةُ شهورٌ حتى ٢٤ شهراً ثمّ سنوات** — **وثلاثمئةُ عمودٍ على
       هاتفٍ شريطُ ضجيجٍ لا رسم.** **والبدايةُ أوّلُ شهرٍ فيه مشاهدة** لا
       عامُ ٢٠٠٠، فلا يُرسم فراغُ عشرين سنة. */
    const days = [...byDay.keys()].sort();
    if (days.length) {
      const firstMonth = days[0].slice(0, 7);
      const lastMonth = days[days.length - 1].slice(0, 7);
      const [fy, fm] = firstMonth.split("-").map(Number);
      const [ly, lm] = lastMonth.split("-").map(Number);
      const span = (ly - fy) * 12 + (lm - fm) + 1;
      if (span <= 24) {
        const fmt = new Intl.DateTimeFormat(loc, { month: "short", timeZone: "UTC" });
        for (let i = 0; i < span; i += 1) {
          const d = new Date(Date.UTC(fy, fm - 1 + i, 1));
          const prefix = d.toISOString().slice(0, 7);
          let sum = 0;
          for (const [day, v] of byDay) if (day.startsWith(prefix)) sum += v;
          buckets.push({ label: fmt.format(d), minutes: sum, prevMinutes: 0 });
        }
      } else {
        for (let y = fy; y <= ly; y += 1) {
          let sum = 0;
          for (const [day, v] of byDay) if (day.startsWith(String(y))) sum += v;
          buckets.push({ label: String(y), minutes: sum, prevMinutes: 0 });
        }
      }
    }
  } else if (period === "year") {
    const fmt = new Intl.DateTimeFormat(loc, { month: "short", timeZone: "UTC" });
    for (let m = 0; m < 12; m += 1) {
      const d = new Date(Date.UTC(range.from.getUTCFullYear(), m, 1));
      const prefix = d.toISOString().slice(0, 7);
      const prevPrefix = new Date(Date.UTC(range.from.getUTCFullYear() - 1, m, 1))
        .toISOString()
        .slice(0, 7);
      let sum = 0;
      let prevSum = 0;
      for (const [day, v] of byDay) if (day.startsWith(prefix)) sum += v;
      for (const [day, v] of prevByDay) if (day.startsWith(prevPrefix)) prevSum += v;
      buckets.push({ label: fmt.format(d), minutes: sum, prevMinutes: prevSum });
    }
  } else {
    const fmt =
      period === "week"
        ? new Intl.DateTimeFormat(loc, { weekday: "short", timeZone: "UTC" })
        : new Intl.DateTimeFormat(loc, { day: "numeric", timeZone: "UTC" });
    for (let i = 0; i < range.days; i += 1) {
      const d = new Date(range.from);
      d.setUTCDate(d.getUTCDate() + i);
      const key = d.toISOString().slice(0, 10);
      const p = new Date(d);
      p.setUTCDate(p.getUTCDate() - range.days);
      buckets.push({
        label: fmt.format(d),
        minutes: byDay.get(key) ?? 0,
        prevMinutes: prevByDay.get(p.toISOString().slice(0, 10)) ?? 0,
        dayKey: key,
      });
    }
  }

  /* ═══ أكثفُ يومٍ وسلسلةُ الأيّام ═══ */
  let peak: PeriodStats["peak"] = null;
  if (byDay.size > 0) {
    const [day, mins] = [...byDay].sort((a, b) => b[1] - a[1])[0];
    peak = {
      label: new Intl.DateTimeFormat(loc, { weekday: "long", timeZone: "UTC" }).format(
        new Date(`${day}T00:00:00Z`),
      ),
      minutes: mins,
    };
  }
  let streak = 0;
  let run = 0;
  for (let i = 0; i < range.days; i += 1) {
    const d = new Date(range.from);
    d.setUTCDate(d.getUTCDate() + i);
    if ((byDay.get(d.toISOString().slice(0, 10)) ?? 0) > 0) {
      run += 1;
      streak = Math.max(streak, run);
    } else run = 0;
  }

  /* ═══ الجلسات — قاعدةُ الثلاثين دقيقةً بنصِّه ═══ */
  const stamps = current
    .filter((r) => !isBackdated(r.watchedAt))
    /* **والفجوةُ فرقٌ، والفروقُ لا تتأثّر بإزاحةٍ ثابتة** — فتبقى خاماً */
    .map((r) => ({ ms: Date.parse(r.watchedAt), mins: runtimeMinutes(r.kind, r.runtime) }))
    .sort((a, b) => a.ms - b.ms);
  const sessionMins: number[] = [];
  let cur = 0;
  for (let i = 0; i < stamps.length; i += 1) {
    if (i > 0 && stamps[i].ms - stamps[i - 1].ms > 30 * 60_000) {
      sessionMins.push(cur);
      cur = 0;
    }
    cur += stamps[i].mins;
  }
  if (cur > 0) sessionMins.push(cur);

  /* ═══ نافذةُ الذروة — ساعتان متجاورتان بأعلى مجموع ═══ */
  let primeHours: [number, number] | null = null;
  if (timedRows > 0) {
    let best = -1;
    let bestAt = 0;
    for (let h = 0; h < 24; h += 1) {
      const sum = byHour[h] + byHour[(h + 1) % 24];
      if (sum > best) {
        best = sum;
        bestAt = h;
      }
    }
    if (best > 0) primeHours = [bestAt, (bestAt + 2) % 24];
  }

  /* ═══ الحالةُ والإكمال — من المكتبة لا من الصفوف ═══ */
  const touched = [...byTitle.values()];
  let completed = 0;
  let inProgress = 0;
  let rewatched = 0;
  for (const x of touched) {
    const f = meta.get(x.key);
    if (!f) continue;
    if ((f.rewatch_count ?? 0) > 0) rewatched += 1;
    if (x.mediaType === "movie") {
      completed += 1;
      continue;
    }
    const total = f.aired_episodes ?? f.total_episodes ?? 0;
    const seen = rows.filter(
      (r) => r.kind === "episode" && r.tmdbId === x.tmdbId,
    ).length;
    if (total > 0 && seen >= total) completed += 1;
    else inProgress += 1;
  }
  const completionPct = touched.length ? Math.round((completed / touched.length) * 100) : 0;

  /* ═══ الذوق — من `title_meta` و`follows.genres`، بلا نداء TMDB ═══ */
  const metas = await getTitleMetaFor(
    touched.map((x) => ({ media_type: x.mediaType, tmdb_id: x.tmdbId })),
  ).catch(() => new Map<string, TitleMetaRow>());

  const genreMin = new Map<string, { name: string; minutes: number }>();
  const langMin = new Map<string, number>();
  const countryMin = new Map<string, number>();
  const decadeMin = new Map<number, number>();
  const artistMin = new Map<string, { photo: string | null; minutes: number }>();
  for (const x of touched) {
    const f = meta.get(x.key);
    const seen = new Set<string>();
    for (const raw of f?.genres ?? []) {
      const g = browseGenreForId(raw);
      if (!g || seen.has(g.slug)) continue;
      seen.add(g.slug);
      const prev = genreMin.get(g.slug);
      genreMin.set(g.slug, {
        name: browseGenreName(g, locale === "en" ? "en" : "ar"),
        minutes: (prev?.minutes ?? 0) + x.minutes,
      });
    }
    const m = metas.get(x.key);
    if (!m) continue;
    if (m.original_language) langMin.set(m.original_language, (langMin.get(m.original_language) ?? 0) + x.minutes);
    for (const c of m.origin_countries ?? []) countryMin.set(c, (countryMin.get(c) ?? 0) + x.minutes);
    if (m.release_year) {
      const dec = Math.floor(m.release_year / 10) * 10;
      decadeMin.set(dec, (decadeMin.get(dec) ?? 0) + x.minutes);
    }
    const cast = m.top_cast ?? [];
    const photos = m.cast_profiles ?? [];
    cast.slice(0, 3).forEach((name, i) => {
      if (!name) return;
      const prev = artistMin.get(name);
      artistMin.set(name, {
        photo: prev?.photo ?? photos[i] ?? null,
        minutes: (prev?.minutes ?? 0) + x.minutes,
      });
    });
  }

  const pctOf = (v: number, total: number) => (total > 0 ? Math.round((v / total) * 100) : 0);
  const genreTotal = [...genreMin.values()].reduce((n, g) => n + g.minutes, 0);
  const langTotal = [...langMin.values()].reduce((n, v) => n + v, 0);
  const countryTotal = [...countryMin.values()].reduce((n, v) => n + v, 0);
  const decadeTotal = [...decadeMin.values()].reduce((n, v) => n + v, 0);

  /* **ومحاورُ البصمة هي سماتُ بطاقة «ذوقك» بعينها** (D-700) — **ولا
     نموذجَ ذوقٍ ثانٍ**: خمسةُ محاورَ مشتقّةٌ من توزيع الأنواع بأوزانٍ
     مكتوبة، **لا ذكاءٌ يدّعي قراءةَ النفوس** (القاعدة ٣). */
  const gm = (slug: string) => genreMin.get(slug)?.minutes ?? 0;
  const radarRaw = [
    { key: "drama", label: t.themeEmotional, score: gm("drama") * 0.6 + gm("romance") },
    { key: "tension", label: t.themeDark, score: gm("crime") + gm("thriller") + gm("mystery") + gm("horror") },
    { key: "worldbuilding", label: t.themeEpic, score: gm("action") + gm("scifi") + gm("war") * 0.5 },
    { key: "characters", label: t.themeCharacter, score: gm("drama") * 0.5 + gm("mystery") * 0.3 + gm("war") * 0.3 },
    { key: "humor", label: t.themeFeelGood, score: gm("comedy") + gm("family") + gm("animation") * 0.5 },
  ];
  const radarPeak = Math.max(1, ...radarRaw.map((r) => r.score));
  const radar = radarRaw.map((r) => ({ ...r, score: Math.round((r.score / radarPeak) * 100) }));

  /* **وانزياحُ الذوق مقارنةٌ لا حكم**: نسبةُ النوع الآن ناقصَ نسبتِه في
     المدّة السابقة — **ولا يُعرض إلّا ما تحرّك خمسَ نقاطٍ فأكثر**،
     فحركةُ نقطةٍ ضجيجٌ لا خبر. */
  const prevTitles = new Map<string, number>();
  for (const r of previous) {
    const key = `${r.kind === "movie" ? "movie" : "tv"}-${r.tmdbId}`;
    prevTitles.set(key, (prevTitles.get(key) ?? 0) + runtimeMinutes(r.kind, r.runtime));
  }
  const prevGenre = new Map<string, number>();
  let prevGenreTotal = 0;
  for (const [key, mins] of prevTitles) {
    const f = meta.get(key);
    const seen = new Set<string>();
    for (const raw of f?.genres ?? []) {
      const g = browseGenreForId(raw);
      if (!g || seen.has(g.slug)) continue;
      seen.add(g.slug);
      prevGenre.set(g.slug, (prevGenre.get(g.slug) ?? 0) + mins);
      prevGenreTotal += mins;
    }
  }
  const shift = [...genreMin]
    .map(([slug, v]) => ({
      label: v.name,
      delta:
        pctOf(v.minutes, genreTotal) - pctOf(prevGenre.get(slug) ?? 0, prevGenreTotal),
    }))
    .filter((x) => Math.abs(x.delta) >= 5)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3);

  /* **وذوقٌ من عملين لا يُقرأ ذوقاً** (شرطُه: «لا تعرض استنتاجاتٍ غير
     موثوقة») — والحدُّ خمسةُ أعمالٍ أو ثلاثُ ساعات. */
  const thin = touched.length < 5 || minutes < 180;

  const rhythm: PeriodStats["habits"]["rhythm"] = (() => {
    if (timedRows === 0) return null;
    const weekendMin = heat.reduce((n, band) => n + band[5] + band[6], 0);
    const allMin = heat.reduce((n, band) => n + band.reduce((m, v) => m + v, 0), 0);
    const nightMin = heat[3].reduce((n, v) => n + v, 0);
    if (allMin === 0) return null;
    if (weekendMin / allMin >= 0.45) return "weekend";
    if (nightMin / allMin >= 0.4) return "night";
    if (sessionMins.some((m) => m >= 180)) return "binge";
    return "steady";
  })();

  const totalHeat = heat.reduce((n, band) => n + band.reduce((m, v) => m + v, 0), 0);

  /* **الأيّامُ المنقضيةُ من المدّة** — المدّةُ كلُّها لفترةٍ مضت،
     وما بلغَه اليومُ لفترةٍ جارية */
  const nowShifted = Date.now() + tzShift;
  const elapsedDays = Math.max(
    1,
    Math.min(
      range.days,
      Math.floor((nowShifted - range.from.getTime()) / 86_400_000) + 1,
    ),
  );

  /* ═══ اليومُ المستحيل — **وحدُّه ١٤٤٠ دقيقةً، وهو حدُّ اليوم نفسِه** ═══ */
  let impossibleDays = 0;
  let worstDayMin = 0;
  for (const v of byDay.values()) {
    if (v > 1440) impossibleDays += 1;
    if (v > worstDayMin) worstDayMin = v;
  }

  return {
    period,
    offset,
    range,
    empty: current.length === 0,
    minutes,
    prevMinutes,
    /* 🔴 🆕 **ونسبةٌ من قاعٍ فارغٍ تقيس الفراغَ لا النموّ** (D-805، من
       الصفحة الحيّة): **الشهرُ عرض «+٩٬٦٤٧٪»** لأنّ الشهرَ الذي قبله
       كان دقائق — **ورقمٌ من أربع خاناتٍ بعلامة نسبةٍ يُقرأ عطلاً لا
       خبراً**، **ولا يجيب سؤالاً**: «كم زدتُ؟» جوابُها ليس «مئةَ ضعف».
       **فالشرطان مكتوبان**: قاعٌ لا يقلّ عن ساعة، **ونسبةٌ تُقرأ**
       (٩٩٩٪ فأقلّ). **وما جاوزهما يغيب** — **والغيابُ أصدقُ من رقمٍ
       يقول ما لا يعنيه** (D-063). */
    deltaPct:
      prevMinutes >= 60
        ? (() => {
            const d = Math.round(((minutes - prevMinutes) / prevMinutes) * 100);
            return Math.abs(d) <= 999 ? d : null;
          })()
        : null,
    /* 🔴 🆕 **والمعدّلُ يُقسَم على ما مضى لا على ما سيأتي** (D-808):
       **شهرٌ في يومه العشرين كان يُقسَم على واحدٍ وثلاثين** — **فيقول
       لصاحبه معدّلاً أقلَّ من معدّله بالثلث**، **ورقمٌ يصغر كلّما بدأ
       الشهرُ يكذب في اتّجاهٍ واحدٍ دائماً.** **والمدّةُ المنقضيةُ تساوي
       المدّةَ كلَّها في كلِّ فترةٍ ماضية** — فلا يتغيّر شيءٌ لِما سبق. */
    dailyAvgMin: elapsedDays > 0 ? Math.round(minutes / elapsedDays) : 0,
    episodes,
    movies,
    titles: byTitle.size,
    buckets,
    peak,
    streak,
    activeDays: byDay.size,
    elapsedDays,
    impossible: { days: impossibleDays, worstMinutes: worstDayMin },
    mix: (["shows", "movies", "anime"] as const).map((k) => ({
      key: k,
      minutes: mixMin[k],
      pct: pctOf(mixMin[k], minutes),
    })),
    status: {
      started: touched.length,
      completed,
      inProgress,
      rewatched,
    },
    completionPct,
    topTitles: touched.sort((a, b) => b.minutes - a.minutes).slice(0, 10),
    releaseYears: [...decadeMin]
      .sort((a, b) => a[0] - b[0])
      .map(([decade, v]) => ({ decade, pct: pctOf(v, decadeTotal) })),
    taste: {
      genres: [...genreMin]
        .map(([slug, v]) => ({ slug, name: v.name, pct: pctOf(v.minutes, genreTotal) }))
        .sort((a, b) => b.pct - a.pct)
        .slice(0, 5),
      languages: [...langMin]
        .map(([code, v]) => ({ code, name: langName(code, locale), pct: pctOf(v, langTotal) }))
        .sort((a, b) => b.pct - a.pct)
        .slice(0, 4),
      countries: [...countryMin]
        .map(([code, v]) => ({ code, name: regionName(code, locale), pct: pctOf(v, countryTotal) }))
        .sort((a, b) => b.pct - a.pct)
        .slice(0, 4),
      radar,
      shift,
      artists: [...artistMin]
        .map(([name, v]) => ({ name, photo: v.photo, minutes: v.minutes }))
        .sort((a, b) => b.minutes - a.minutes)
        .slice(0, 3),
      thin,
    },
    habits: {
      timedRows,
      heat,
      timeOfDay: BANDS.map((b, i) => ({
        key: b.key,
        pct: pctOf(heat[i].reduce((n, v) => n + v, 0), totalHeat),
      })),
      sessions: sessionMins.length,
      avgSessionMin: sessionMins.length
        ? Math.round(sessionMins.reduce((n, v) => n + v, 0) / sessionMins.length)
        : 0,
      longestSessionMin: sessionMins.length ? Math.max(...sessionMins) : 0,
      primeHours,
      rhythm,
    },
  };
}
