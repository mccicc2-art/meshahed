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
  /* 🆕 `episode`: حلقةٌ بمعرّفها في IMDb — يعود منها المسلسلُ وموسمُها ورقمُها كما في `tvdb-episode` */
  | { kind: "imdb"; id: string; media: "tv" | "movie" | "episode" }
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
