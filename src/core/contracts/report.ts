/**
 * ====== «تقريرك» و«الإحصائيات الكاملة» للتطبيق — عقدُ `GET /api/v1/me/report` (🆕 D-1366 · Phase 11-V · V-C · C5) ======
 *
 * **مرآةُ `PeriodStats`** (`src/lib/periodStats.ts` — ناتجُ `buildPeriodStats` الذي ترسم منه صفحتا `/reports` و`/statistics`)،
 * حقلاً بحقل وبأسمائه: الشاشتان الأصليّتان ترجمةُ الصفحتين (D-1067) فتقرآن ما تقرآنه. ⚠️ **النوعُ مكتوبٌ هنا لا مستورد**:
 * التطبيقُ يرى `core/` وحدَه، والمسارُ يُسلّم `PeriodStats` إلى هذا النوع فيفضح `tsc` أيَّ حقلٍ افترقا فيه.
 * الفرقُ الوحيد `range`: تاريخا البداية والنهاية (`Date`) والإزاحةُ لا يعبرون — الاسمُ وعددُ الأيّام وهل يوجد «تالٍ» تكفي الرسم.
 */
export type ReportPeriod = "week" | "month" | "year" | "all";

export type ReportTitle = {
  key: string;
  tmdbId: number;
  mediaType: "tv" | "movie";
  title: string;
  poster: string | null;
  minutes: number;
  episodes: number;
  kind: "shows" | "movies" | "anime";
};

export type ReportBucket = { label: string; minutes: number; prevMinutes: number; dayKey?: string };

export type ReportStats = {
  period: ReportPeriod;
  offset: number;
  range: { label: string; days: number; can_go_next: boolean };
  empty: boolean;

  minutes: number;
  prevMinutes: number;
  deltaPct: number | null;
  dailyAvgMin: number;
  episodes: number;
  movies: number;
  titles: number;

  buckets: ReportBucket[];
  peak: { label: string; minutes: number } | null;
  streak: number;
  activeDays: number;
  elapsedDays: number;
  impossible: { days: number; worstMinutes: number };

  mix: { key: "shows" | "movies" | "anime"; minutes: number; pct: number }[];
  status: { started: number; completed: number; inProgress: number; rewatched: number };
  completionPct: number;

  topTitles: ReportTitle[];
  releaseYears: { decade: number; pct: number }[];

  taste: {
    genres: { slug: string; name: string; pct: number }[];
    languages: { code: string; name: string; pct: number }[];
    countries: { code: string; name: string; pct: number }[];
    radar: { key: string; label: string; score: number }[];
    shift: { label: string; delta: number }[];
    artists: { name: string; photo: string | null; minutes: number }[];
    thin: boolean;
  };

  habits: {
    timedRows: number;
    heat: number[][];
    timeOfDay: { key: "morning" | "afternoon" | "evening" | "night"; pct: number }[];
    sessions: number;
    avgSessionMin: number;
    longestSessionMin: number;
    primeHours: [number, number] | null;
    rhythm: "weekend" | "night" | "binge" | "steady" | null;
  };
};

/** `plus` للرسم وحدَه: القفلُ قفلُ عرضٍ كما في الصفحة (`PlusPreview` — D-809)، والأرقامُ أرقامُ صاحبها */
export type MyReportPayload = { plus: boolean; stats: ReportStats };

/** `POST /api/v1/me/report/repair` — ناتجُ `repairImpossibleDays` */
export type ReportRepairPayload = { moved: number; remaining: number; stuck: number };
