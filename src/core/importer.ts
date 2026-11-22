// أنواع الاستيراد المشتركة — آمنة للخادم والمتصفح معاً.
//
// الحمولة مضغوطة عمداً: أرقام TMDB لا كائنات كاملة، والحلقات أزواج
// (موسم، حلقة) مع تاريخٍ اختياري — مكتبةُ سنواتٍ من TV Time قد تحمل
// عشرين ألف حلقة، وكل حرفٍ زائد في الشكل يتضاعف عشرين ألف مرة.

export interface ImportEpisode {
  s: number;
  e: number;
  /** تاريخ المشاهدة الأصلي (ISO) — يُحفظ في اليوميات كما عاشه صاحبه */
  at?: string;
}

export interface ImportShow {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  episodes: ImportEpisode[];
  rating?: number;
  /** 🆕 T507 — رأيُ صاحبه في المسلسل (Trakt · ملفٌّ بعمود «رأي») */
  review?: ImportReview;
  /**
   * 🆕 IMDb — **«شاهدتُ حتى هذه الحلقة»**: كلُّ ما عُرض قبلها يُعلَّم **على الخادم** (R58: لا يُؤتمن العميلُ على
   * قائمة الحلقات)، بتاريخ أبكرِ تقييمٍ يغطّيه (أحمد ٤ نوفمبر «٢ أ» + «٣ أ»). والحلقةُ نفسُها في `episodes` بتاريخها.
   */
  upTo?: ImportEpisode[];
  /** 🆕 IMDb — **المسلسلُ كلُّه شوهد** (تقييمُه في IMDb، «١ ب»): كلُّ ما عُرض منه، بتاريخ التقييم إن وُجد */
  all?: { at?: string };
  /**
   * 🆕 MyAnimeList — **مدىً من الحلقات** في ترتيب العمل على TMDB: من أوّل حلقةٍ في `season` (أو أوّل العمل إن كان `null`)
   * بعد `offset` حلقة، و`count` حلقةً (أو بقيّةُ الموسم إن كان `null`). يُحسب على الخادم كأخويه (`impliedEpisodes`).
   */
  spans?: ImportSpan[];
  /** 🆕 MyAnimeList («١ أ») — «Dropped» ⇐ متروك · «On-Hold» ⇐ موقوفٌ مؤقّتاً */
  state?: "dropped" | "paused";
}

export interface ImportSpan {
  season: number | null;
  offset: number;
  count: number | null;
  at?: string;
}

export interface ImportMovie {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  watched: boolean;
  at?: string;
  rating?: number;
  /** 🆕 T507 — رأيُ صاحبه كما كتبه في مصدره */
  review?: ImportReview;
}

/**
 * 🆕 T507 — **رأيٌ مستورد**: نصُّه منظَّفاً (`cleanReviewText`)، ويومُ كتابته `at`، وهل فيه حرق.
 * ⚖️ **يومُ كتابته لا يومُ استيراده** (أحمد ٢٢ نوفمبر «١ أ»): الرأيُ يظهر في صفحة العمل والملفّ الشخصيّ بتاريخه الأصليّ،
 * ولا يدخل نشاطَ الأصدقاء دفعةً واحدة — ونشاطُ الأصدقاء يقرأ آخرَ ثلاثين يوماً بـ`updated_at`.
 */
export interface ImportReview {
  text: string;
  at?: string;
  spoiler?: boolean;
}

/** 🆕 IMDb («٤ أ») — **قائمةٌ من قوائم صاحبها** تدخل قوائمَه في Loopz خاصّةً، بترتيبها */
export interface ImportList {
  name: string;
  items: { tmdbId: number; mediaType: "tv" | "movie"; title: string; posterPath: string | null }[];
}

export interface ImportPayload {
  shows: ImportShow[];
  movies: ImportMovie[];
  /** ⚠️ **اختياريّةٌ لأجل ترتيب النشر**: عميلٌ قديمٌ (تطبيقٌ لم يصله التحديث) لا يرسلها */
  lists?: ImportList[];
  /** 🆕 Bingers («٢ أ») — أعمالٌ تدخل قائمةَ «المفضّلة» الواحدة (`kind='favorites'`)، تُضاف ولا تُقلَب */
  favorites?: ImportList["items"];
  /** 🆕 اسمُ قائمة المفضّلة إن وُلدت بهذا الاستيراد — بلغة الواجهة كما يمرّره القلبُ (`favListName`) */
  favoritesName?: string;
  /**
   * 🆕 **«ما في Loopz يبقى»** (قاعدةُ Trakt، أحمد ١٩ نوفمبر — وبها وُعد استيرادُ Bingers): عملٌ في المكتبة يبقى باسمه وملصقه
   * وحاله، ومشاهدةٌ مسجّلةٌ تبقى بتاريخها، وتقييمُ Loopz لا يُدهس — يُضاف الناقصُ وحدَه. ترسله شاشتا الملفّات كلُّها (أحمد ٢٠ نوفمبر «١ أ»)؛ وغيابُه (Plex · تطبيقٌ
   قديمٌ لم يصله التحديث) يُبقي الكتابةَ القديمة.
   */
  keep?: boolean;
  /**
   * 🆕 T507 — **مصدرُ الآراء في هذه الدفعة** (`ratings.imported_from`، هجرة ٢٥٨): `letterboxd` أو `auto` (ملفٌّ بعمود «مراجعة»).
   * غيابُه أو قيمةٌ غيرُهما ⇐ لا تُكتب آراءُ الدفعة (تطبيقٌ قديمٌ لا يرسل آراءً أصلاً). وTrakt يكتب آراءه على الخادم.
   */
  reviewFrom?: "letterboxd" | "auto";
}

/** ما لم نستطع مطابقته — يُعرض بالاسم كي يضيفه صاحبه يدوياً إن شاء */
export interface ImportUnmatched {
  label: string;
  kind: "tv" | "movie" | "unknown";
}

/** سقوفٌ دفاعية: ملفٌ معطوب أو خبيث لا يفجّر الذاكرة ولا القاعدة */
export const IMPORT_CAPS = {
  shows: 1000,
  movies: 2000,
  episodesPerShow: 3000,
  /** 🆕 IMDb — القوائمُ في الاستيراد الواحد (سقفُ القوائم ٥٠ في الحساب كلِّه)، وأعمالُ القائمة سقفُ `upsertListWithItems` */
  lists: 50,
  listItems: 300,
} as const;

/** طلب مطابقة معرّفٍ خارجي إلى TMDB — يُرسل دفعاتٍ إلى الخادم */
export type ResolveRequest =
  | { kind: "tvdb-tv"; id: number }
  | { kind: "tvdb-episode"; id: number }
  /* 🆕 T500 — `any`: ملفٌّ من تطبيقٍ لا نعرفه يحمل `tt…` بلا نوع — يُجرَّب فيلماً ثمّ مسلسلاً ثمّ حلقةً (ما يجده TMDB أوّلاً)
     🆕 `episode`: حلقةٌ بمعرّفها في IMDb — يعود منها المسلسلُ وموسمُها ورقمُها كما في `tvdb-episode` */
  | { kind: "imdb"; id: string; media: "tv" | "movie" | "episode" | "any" }
  /* 🆕 MyAnimeList — رقمُ العمل هناك، يُربط بجدول Fribb (`lib/fribb.ts`) */
  | { kind: "mal"; id: number }
  | { kind: "name-tv"; name: string; year?: number }
  | { kind: "name-movie"; name: string; year?: number };

export type ResolveResult =
  | {
      tmdbId: number;
      mediaType: "tv" | "movie";
      title: string;
      posterPath: string | null;
      season?: number;
      episode?: number;
      /** 🆕 MyAnimeList — أين يقع هذا العملُ من مسلسل TMDB (جدولُ Fribb): موسمُه (`null` = ترقيمٌ متّصلٌ من أوّل العمل) وإزاحتُه */
      span?: { season: number | null; offset: number };
    }
  | null;

/** أبكرُ التاريخين، والمعروفُ يغلب الغائب — يومُ المشاهدة الأوّل هو الصادق (D-041). يقرؤه التجميعُ (`importBuild`)
 *  والضمنيُّ (`impliedEpisodes`) — قاعدةٌ واحدةٌ للدمج */
export function earliestAt(a: string | undefined, b: string | undefined): string | undefined {
  return a && b ? (a < b ? a : b) : (a ?? b);
}

/* ============================================================
   🆕 T507 — سجلُّ الاستيراد (`import_runs`، هجرة ٢٥٧)
   ============================================================ */

/** المصادرُ التي يعرفها السجلّ — `auto` ملفٌّ من تطبيقٍ لا نعرفه، قُرئ بأعمدته بعد مراجعة صاحبه */
export const IMPORT_RUN_SOURCES = ["imdb", "mal", "letterboxd", "simkl", "bingers", "tvtime", "trakt", "plex", "auto"] as const;
export type ImportRunSource = (typeof IMPORT_RUN_SOURCES)[number];

/** ما يرسله العميلُ في ختام الاستيراد — حصيلتُه لا محتواه */
export interface ImportRunSummary {
  source: ImportRunSource;
  status: "done" | "cancelled";
  shows: number;
  episodes: number;
  movies: number;
  reviews: number;
  unmatched: number;
  /** لـ`auto` وحده: أسماءُ أعمدة الملفّ — لا قيمُها */
  headers?: string[];
}

/** صفٌّ كما يقرؤه صاحبُه في «استيراداتك» */
export interface ImportRun extends Omit<ImportRunSummary, "headers"> {
  id: number;
  platform: "web" | "app";
  createdAt: string;
}

/**
 * 🆕 T507 — **اسمُ عمودٍ لا قيمةُ صفّ** (مراجعةُ الوكيل، البند ٨أ): ملفٌّ بلا سطر عناوين يجعل أوّلَ صفوفه «عناوين» — فيها
 * اسمُ عملٍ وتاريخٌ ورقم. يُقبل ما كان قصيراً (٤٠ حرفاً) بلا رابطٍ ولا بريدٍ، وليس تاريخاً ولا رقماً.
 */
export function headerOk(h: string): boolean {
  const v = h.trim();
  if (!v || v.length > 40) return false;
  if (/https?:|www\.|@/i.test(v)) return false;
  if (/^[\d\s.,:/\-+]+$/.test(v)) return false;
  if (/\d{4}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/.test(v)) return false;
  return true;
}

const count = (v: unknown, max: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0;
};

/**
 * 🆕 T507 — **ما يصل من العميل يُنقّى قبل أن يُكتب**: مصدرٌ لا نعرفه ⇐ لا صفّ (تطبيقٌ قديمٌ يرسل جسماً فارغاً — يبقى سلوكُه
 * كما كان)، والأعدادُ أعدادٌ في حدود قيود الجدول، والأعمدةُ أسماءٌ قصيرةٌ للملفّ المجهول وحده. الأعدادُ يقولها العميل —
 * وهي سجلٌّ لصاحبه لا حسابٌ يُبنى عليه شيء، فلا تُعاد من القاعدة.
 */
export function cleanImportRunSummary(raw: unknown): ImportRunSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const source = IMPORT_RUN_SOURCES.find((s) => s === r.source);
  if (!source) return null;
  const headers =
    source === "auto" && Array.isArray(r.headers)
      ? [...new Set(r.headers.map((h) => String(h ?? "").replace(/\s+/g, " ").trim()).filter(headerOk))].slice(0, 60)
      : undefined;
  return {
    source,
    status: r.status === "cancelled" ? "cancelled" : "done",
    shows: count(r.shows, 100_000),
    episodes: count(r.episodes, 1_000_000),
    movies: count(r.movies, 100_000),
    reviews: count(r.reviews, 100_000),
    unmatched: count(r.unmatched, 100_000),
    ...(headers?.length ? { headers } : {}),
  };
}

/** 🆕 T507 — يومُ الاستيراد وساعتُه بتوقيت جهاز القارئ («٢١ نوف، ١١:٤٠ م» / «21 Nov, 11:40 pm») — للويب والتطبيق معاً */
export function importRunWhen(iso: string, code: "ar" | "en"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return new Intl.DateTimeFormat(code === "en" ? "en-GB" : "ar", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" as const }),
    hour: "numeric",
    minute: "2-digit",
    calendar: "gregory",
    numberingSystem: "latn",
  }).format(d);
}

/* ============================================================
   🆕 T507 — قرارُ كتابة الآراء المستوردة (نقيٌّ يُختبر — مراجعةُ الوكيل الثاني، البند ٧)
   ============================================================ */

export type ReviewPlanItem = {
  kind: "tv" | "movie";
  tmdbId: number;
  /** تقييمُ المصدر (١–١٠) إن وُجد */
  rating?: number;
  review: { text: string; at: string; spoiler: boolean } | null;
};
export type ExistingRating = { tmdb_id: number; media_type: string; rating: number | null; review: string | null; updated_at: string | null };

/**
 * لكلِّ رأيٍ مستوردٍ حكمٌ واحد:
 * - `fresh` — لا تقييمَ في Loopz: يُكتب التقييمُ والرأيُ معاً بيوم الرأي. وبلا تقييمٍ في المصدر ⇐ `skipped` (لا رأيَ بلا تقييم).
 * - `kept` — في Loopz رأيٌ قائم: لا يُمسّ («ما في Loopz يبقى»).
 * - `fills` — تقييمٌ في Loopz بلا رأي (`null` أو `''` أو فراغ): يُضاف الرأيُ إن لم يأتِ تقييمٌ أو جاء التقييمُ نفسُه — ويومُه
 *   أبكرُ اليومين فلا يرتفع إلى أعلى المجتمع. وتقييمٌ مختلف ⇐ `skipped`: رأيُ نجمتين لا يُعلَّق على تسعٍ من عشرة.
 * والعملُ الواحدُ يُحكم مرّةً (أوّلُ ما ورد).
 */
export function planReviewWrites(
  items: ReviewPlanItem[],
  existing: ExistingRating[],
  stamp: string,
): {
  fresh: (ReviewPlanItem & { rating: number; review: NonNullable<ReviewPlanItem["review"]> })[];
  fills: { item: ReviewPlanItem & { review: NonNullable<ReviewPlanItem["review"]> }; at: string }[];
  skipped: number;
  kept: number;
} {
  const have = new Map(existing.map((r) => [`${r.media_type}-${r.tmdb_id}`, r]));
  const fresh: ReturnType<typeof planReviewWrites>["fresh"] = [];
  const fills: ReturnType<typeof planReviewWrites>["fills"] = [];
  let skipped = 0;
  let kept = 0;
  const seen = new Set<string>();
  for (const it of items) {
    if (!it.review || !Number.isInteger(it.tmdbId) || it.tmdbId <= 0) continue;
    const key = `${it.kind}-${it.tmdbId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const raw = it.rating == null ? NaN : Math.round(Number(it.rating));
    const rating = Number.isFinite(raw) ? Math.max(1, Math.min(10, raw)) : null;
    const prev = have.get(key);
    if (!prev) {
      if (rating == null) skipped++;
      else fresh.push({ ...it, rating, review: it.review });
      continue;
    }
    if (String(prev.review ?? "").trim()) {
      kept++;
      continue;
    }
    if (rating != null && rating !== prev.rating) {
      skipped++;
      continue;
    }
    const prevAt = String(prev.updated_at ?? stamp);
    fills.push({ item: { ...it, review: it.review }, at: it.review.at < prevAt ? it.review.at : prevAt });
  }
  return { fresh, fills, skipped, kept };
}

/** 🆕 T507 — اسمُ المصدر في «استيراداتك» — للويب والتطبيق من مكانٍ واحد (مراجعةُ الوكيل الثاني، البند ١١) */
export function importRunTitle(
  source: ImportRunSource,
  t: Record<"importImdbTitle" | "importMalTitle" | "importLetterboxdTitle" | "importSimklTitle" | "importBingersTitle" | "importTvTimeTitle" | "importTraktTitle" | "importAutoTitle", string>,
): string {
  switch (source) {
    case "imdb":
      return t.importImdbTitle;
    case "mal":
      return t.importMalTitle;
    case "letterboxd":
      return t.importLetterboxdTitle;
    case "simkl":
      return t.importSimklTitle;
    case "bingers":
      return t.importBingersTitle;
    case "tvtime":
      return t.importTvTimeTitle;
    case "trakt":
      return t.importTraktTitle;
    case "plex":
      return "Plex";
    default:
      return t.importAutoTitle;
  }
}

/** 🆕 T507 — سطرُ الحصيلة: بصيغة «اكتمل الاستيراد» نفسِها، ثمّ المراجعاتُ وما لم نجده */
export function importRunCounts(
  run: ImportRun,
  t: {
    importDoneBody: (shows: number, eps: number, movies: number) => string;
    importRunReviews: (n: string) => string;
    importRunUnmatched: (n: string) => string;
  },
  fmt: (n: number) => string,
): string {
  return [
    t.importDoneBody(run.shows, run.episodes, run.movies),
    run.reviews > 0 ? t.importRunReviews(fmt(run.reviews)) : "",
    run.unmatched > 0 ? t.importRunUnmatched(fmt(run.unmatched)) : "",
  ]
    .filter(Boolean)
    .join(" · ");
}
