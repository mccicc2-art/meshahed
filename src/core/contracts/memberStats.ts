/**
 * ====== عقدُ «إحصاءات العضو» في التطبيق — `GET /api/v1/profile/{username}/stats` (Phase 11-N · N4) ======
 *
 * 🔑 **الحمولةُ ما ترسمه صفحةُ `/u/{username}/stats` حرفاً** (`lib/memberStatsCore.ts`): بطاقةُ صاحبها (الملصقاتُ الثلاثة ·
 * الصورة · الاسم · المتابِعون · النبذة · وقتُ المشاهدة) · شريطُ الأرقام الأربعة · بطاقةُ الذوق بخاناتها الستّ (وقوائمُها الكاملة
 * وأعمالُ كلِّ صفّ) · وبابُ «أنت وهو» (D-829). **والتطبيقُ يرسم ولا يصوغ** — النسبُ والأسماءُ والترجمةُ محسوبةٌ هنا.
 * 🔒 **الحسابُ الخاصُّ والحظر**: الحارسُ في SQL (`can_view_profile` · `is_blocked`)؛ و`locked` للرسم وحدَه والمحتوى فارغ.
 * 🔒 **«أنت وهو» من البلس** (`PlusPreview`): لغير المشترك النسبةُ مفتوحةٌ والتفصيلُ مقفل — `match.plus` يقول أيّهما.
 */
import type { PersonLite } from "../people.ts";

export type MemberTasteWork = { mediaType: "tv" | "movie"; tmdbId: number; title: string; poster: string | null };
type Row = { works: MemberTasteWork[]; total: number };
export type MemberTasteEntry = { name: string; value: string; unit?: string; ltr?: boolean };
export type MemberTasteList = { items: MemberTasteEntry[]; total: number };

/** بطاقةُ الذوق — شكلُ `TasteData` في الويب بحرفه (الملصقاتُ خلف كلِّ خانةٍ روابطُ جاهزة، وملصقاتُ الأعمال مساراتُ TMDB) */
export type MemberTaste = {
  themes: string[];
  genres: ({ name: string; pct: number } & Row)[];
  decades: ({ label: string; pct: number } & Row)[];
  languages: ({ code: string; name: string; titles: number } & Row)[];
  countries: ({ name: string; titles: number } & Row)[];
  directors: ({ name: string; titles: number } & Row)[];
  actors: ({ name: string; titles: number } & Row)[];
  all: Record<"genres" | "decades" | "languages" | "countries" | "directors" | "actors", MemberTasteList>;
  posters: Record<"genres" | "decades" | "languages" | "countries" | "directors" | "actors", string[]>;
};

export type MemberMatchRow = { name: string; mine: number; theirs: number };

export type MemberStatsPayload = {
  person: PersonLite & { bio: string | null; followers: number | null };
  locked: boolean;
  /** بلا متابعاتٍ ⇒ الصفحةُ تقول `analysisEmptyOther` */
  empty: boolean;
  totals: { minutes: number; episodes: number; movies: number; shows: number; reviews: number };
  /** ملصقاتُ البطاقة الثلاثة (مسارات TMDB — `trioPosterPaths`) */
  hero_posters: string[];
  taste: MemberTaste | null;
  /** «أنت وهو» — `null` لنفسي وللزائر ولمن لا تُقارَن مكتبتُه (`thin`) */
  match: {
    pct: number;
    shared: MemberMatchRow[];
    apart: MemberMatchRow[];
    picks: { media_type: "tv" | "movie"; tmdb_id: number; title: string; poster_path: string | null }[];
    plus: boolean;
  } | null;
};
