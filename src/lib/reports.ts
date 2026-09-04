import "server-only";

import { getFollows, getWatchWindow, type FollowRow, type HistoryRow } from "@/lib/data";
import { browseGenreForId, browseGenreName } from "@/core/browse";
import type { Locale } from "@/core/i18n";
import { runtimeMinutes } from "@/core/watchTime";

/**
 * ============ تقاريرُ المشاهدة — أسبوعُك وشهرُك وسنتُك (D-796) ============
 *
 * **بندٌ من قائمة Loopz+** (`pending-D783` §١) — **وأعلى ما فيها أثراً**:
 * الأرقامُ في `/stats` تقول **«كم عندك»**، **والتقريرُ يقول «ماذا فعلتَ
 * هذا الأسبوع»** — **وسؤالان مختلفان لا يجيبهما رسمٌ واحد.**
 *
 * ⚖️ **والقائمُ في `/stats` يبقى مجّانيّاً بحكمه** («لم أمنع خدمات مجانية
 * على الأعضاء») — **والجديدُ هنا بلس**، وهو ما اتُّفق عليه في D-786.
 *
 * 🔑 **والمقارنةُ بالمدّة السابقة هي التقرير**: **رقمٌ بلا مرجعٍ ليس
 * خبراً** — «١٢ ساعة» لا تقول شيئاً، **و«١٢ ساعة، أكثرُ من أسبوعك الماضي
 * بالثلث» تقول.** ولذلك تُقرأ نافذتان لا واحدة.
 *
 * ⚠️ **ولا نداءَ TMDB واحد**: الأسماءُ والملصقاتُ والأنواعُ كلُّها من
 * `follows` المقروءةِ أصلاً (D-648 وضعت `genres` هناك بعينها) —
 * **وتقريرٌ يوقظ أربعين نداءَ كتالوجٍ لأجل ملصقاتٍ صغيرةٍ يُبطئ الصفحةَ
 * التي جاء يخدمها.**
 */

export type ReportPeriod = "week" | "month" | "year";

export const REPORT_PERIODS: readonly ReportPeriod[] = ["week", "month", "year"] as const;

export function asReportPeriod(raw: string | null | undefined): ReportPeriod {
  return raw === "month" || raw === "year" ? raw : "week";
}

/** كم يوماً تغطّيه المدّة — **والسنةُ ٣٦٥ لا ١٢ شهراً**: الحسابُ بالأيام */
const DAYS: Record<ReportPeriod, number> = { week: 7, month: 30, year: 365 };

export interface ReportTitle {
  key: string;
  tmdbId: number;
  mediaType: "tv" | "movie";
  title: string;
  poster: string | null;
  minutes: number;
  /** حلقاتٌ عُلّمت، أو ١ للفيلم */
  count: number;
}

export interface ReportBucket {
  label: string;
  minutes: number;
}

export interface PeriodReport {
  period: ReportPeriod;
  episodes: number;
  movies: number;
  minutes: number;
  /** المدّةُ السابقةُ نفسُها طولاً — **مرجعُ المقارنة** */
  prevMinutes: number;
  buckets: ReportBucket[];
  titles: ReportTitle[];
  busiest: ReportBucket | null;
  genres: { slug: string; name: string; minutes: number }[];
  /** أطولُ سلسلةِ أيّامٍ متتاليةٍ فيها مشاهدة — داخل المدّة وحدَها */
  streak: number;
}

/**
 * دقائقُ الصفّ — **من `watchTime` لا من رقمٍ محلّيّ** (D-797).
 * 🔴 **وكان هنا ٤٢ و١٠٥ بينما `/stats` تقدّر ٤٠ و١١٠** — **فقالت
 * الصفحتان عن الصفوف نفسِها رقمين يفترقان ٦٣ ساعة.**
 */
function minutesOf(row: HistoryRow): number {
  return runtimeMinutes(row.kind, row.runtime);
}

/** مفتاحُ اليوم بصيغة `YYYY-MM-DD` — **بتوقيت UTC، وهو دَينٌ مُعلَن** */
function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function startOf(period: ReportPeriod, now: Date): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - (DAYS[period] - 1));
  return d;
}

/**
 * **يبني التقريرَ من نافذتين**: المدّةُ الحاليّةُ والتي قبلها بطولها —
 * **وقراءةٌ واحدةٌ تغطّيهما** (`since` = بدايةُ السابقة).
 */
export async function buildPeriodReport(
  period: ReportPeriod,
  locale: Locale,
): Promise<PeriodReport> {
  const now = new Date();
  const start = startOf(period, now);
  const prevStart = new Date(start);
  prevStart.setUTCDate(prevStart.getUTCDate() - DAYS[period]);

  const [rows, follows] = await Promise.all([
    getWatchWindow(prevStart.toISOString()),
    getFollows().catch(() => [] as FollowRow[]),
  ]);

  const startMs = start.getTime();
  const current = rows.filter((r) => Date.parse(r.watchedAt) >= startMs);
  const previous = rows.filter((r) => Date.parse(r.watchedAt) < startMs);

  const byKey = new Map<string, ReportTitle>();
  /* **والتجميعُ بالمفهوم لا بالرقم** (`browseGenreForId`): TMDB يعطي
     رقمين مختلفين لـ«أكشن» في الأفلام والمسلسلات — **وعدُّهما نوعين
     يجعل ذوقَ القارئ يبدو أوسعَ ممّا هو.** */
  const byGenre = new Map<string, { name: string; minutes: number }>();
  const byDay = new Map<string, number>();
  const meta = new Map<string, FollowRow>(
    follows.map((f) => [`${f.media_type}-${f.tmdb_id}`, f]),
  );

  let episodes = 0;
  let movies = 0;
  let minutes = 0;

  for (const row of current) {
    const mediaType = row.kind === "movie" ? "movie" : "tv";
    const key = `${mediaType}-${row.tmdbId}`;
    const mins = minutesOf(row);
    minutes += mins;
    if (row.kind === "movie") movies += 1;
    else episodes += 1;

    byDay.set(dayKey(row.watchedAt), (byDay.get(dayKey(row.watchedAt)) ?? 0) + mins);

    const follow = meta.get(key);
    const entry = byKey.get(key);
    if (entry) {
      entry.minutes += mins;
      entry.count += 1;
    } else {
      byKey.set(key, {
        key,
        tmdbId: row.tmdbId,
        mediaType,
        /* **والاسمُ من مكتبته لا من الكتالوج** — ومن حذف العملَ من مكتبته
           يبقى رقمُه بلا اسم، **فيُكتب رقماً ولا يُخترع له اسم** (D-063). */
        title: follow?.title ?? `#${row.tmdbId}`,
        poster: follow?.poster_path ?? null,
        minutes: mins,
        count: 1,
      });
    }

    const seen = new Set<string>();
    for (const raw of follow?.genres ?? []) {
      const g = browseGenreForId(raw);
      if (!g || seen.has(g.slug)) continue;
      seen.add(g.slug);
      const cur = byGenre.get(g.slug);
      const name = browseGenreName(g, locale === "en" ? "en" : "ar");
      byGenre.set(g.slug, { name, minutes: (cur?.minutes ?? 0) + mins });
    }
  }

  const prevMinutes = previous.reduce((n, r) => n + minutesOf(r), 0);

  /* ═══ الأعمدة: أيّامٌ للأسبوع والشهر، وشهورٌ للسنة ═══
     **وثلاثون عموداً على هاتفٍ ليست رسماً بل شريطُ ضجيج** — **فالشهرُ
     يُجمَّع أسابيعَ والسنةُ شهوراً.** */
  const buckets: ReportBucket[] = [];
  if (period === "week") {
    const fmt = new Intl.DateTimeFormat(locale === "en" ? "en" : "ar", {
      weekday: "short",
      timeZone: "UTC",
    });
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      buckets.push({ label: fmt.format(d), minutes: byDay.get(dayKey(d.toISOString())) ?? 0 });
    }
  } else if (period === "month") {
    for (let w = 0; w < 5; w += 1) {
      let sum = 0;
      for (let i = 0; i < 6; i += 1) {
        const d = new Date(start);
        d.setUTCDate(d.getUTCDate() + w * 6 + i);
        if (d.getTime() > now.getTime()) break;
        sum += byDay.get(dayKey(d.toISOString())) ?? 0;
      }
      buckets.push({ label: `${w + 1}`, minutes: sum });
    }
  } else {
    const fmt = new Intl.DateTimeFormat(locale === "en" ? "en" : "ar", {
      month: "short",
      timeZone: "UTC",
    });
    const byMonth = new Map<string, number>();
    for (const [day, mins] of byDay) {
      const k = day.slice(0, 7);
      byMonth.set(k, (byMonth.get(k) ?? 0) + mins);
    }
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const k = d.toISOString().slice(0, 7);
      buckets.push({ label: fmt.format(d), minutes: byMonth.get(k) ?? 0 });
    }
  }

  /* **وأكثفُ يومٍ يُقرأ من الأيّام لا من الأعمدة** — **عمودُ أسبوعٍ لا
     يقول أيَّ يومٍ فيه كان الأكثف.** */
  let busiest: ReportBucket | null = null;
  if (byDay.size > 0) {
    const fmt = new Intl.DateTimeFormat(locale === "en" ? "en" : "ar", {
      weekday: "long",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
    const [day, mins] = [...byDay].sort((a, b) => b[1] - a[1])[0];
    busiest = { label: fmt.format(new Date(`${day}T00:00:00Z`)), minutes: mins };
  }

  /* **والسلسلةُ أيّامٌ متتاليةٌ داخل المدّة** — **ولا تُحسب من خارجها**:
     رقمٌ يتجاوز المدّةَ يعِد بما لا يقوله التقرير. */
  let streak = 0;
  let run = 0;
  for (let i = 0; i < DAYS[period]; i += 1) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    if ((byDay.get(dayKey(d.toISOString())) ?? 0) > 0) {
      run += 1;
      streak = Math.max(streak, run);
    } else run = 0;
  }

  const genres = [...byGenre]
    .map(([slug, v]) => ({ slug, name: v.name, minutes: v.minutes }))
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 4);

  return {
    period,
    episodes,
    movies,
    minutes,
    prevMinutes,
    buckets,
    titles: [...byKey.values()].sort((a, b) => b.minutes - a.minutes).slice(0, 8),
    busiest,
    genres,
    streak,
  };
}
