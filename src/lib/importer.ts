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
}

export interface ImportMovie {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  watched: boolean;
  at?: string;
  rating?: number;
}

export interface ImportPayload {
  shows: ImportShow[];
  movies: ImportMovie[];
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
} as const;

/** طلب مطابقة معرّفٍ خارجي إلى TMDB — يُرسل دفعاتٍ إلى الخادم */
export type ResolveRequest =
  | { kind: "tvdb-tv"; id: number }
  | { kind: "tvdb-episode"; id: number }
  | { kind: "imdb"; id: string; media: "tv" | "movie" }
  | { kind: "name-tv"; name: string; year?: number }
  | { kind: "name-movie"; name: string; year?: number };

export type ResolveResult =
  | { tmdbId: number; mediaType: "tv" | "movie"; title: string; posterPath: string | null; season?: number; episode?: number }
  | null;
