/**
 * ====== عقدُ الرئيسية في التطبيق — `GET /api/v1/me/home` ======
 *
 * 🆕 D-919 (حكمُ أحمد بعد أوّل تثبيت: «التطبيق ناقص جدّاً — نحتاج تحديثاً
 * ممتازاً»). ثلاثةُ صفوفٍ لا عشرة: **ما أُكمله** و**ما يُذاع هذا الأسبوع**
 * و**ما أبدؤه** — وهي الأسئلةُ الثلاثة التي يفتح المرءُ التطبيقَ ليجيبها.
 * الرئيسيةُ الكاملةُ في الويب (٢٦٠٠ سطراً) لا تُنقل؛ تُنقل الإجاباتُ.
 *
 * 🔑 **الحلقةُ التالية تُحسب في الخادم** بـ`nextUnwatchedEpisode` نفسِها
 * (D-603/D-374) — فلا تقترح الرئيسيةُ في الجوّال حلقةً لم تُذَع.
 */

import type { TitleKind } from "./tags.ts";

/** بطاقةُ «أكمل المشاهدة» — مسلسلٌ بدأتُه ولم أُكمل ما أُذيع منه */
export type ContinueItem = {
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  /** أوّلُ حلقةٍ مُذاعةٍ لم تُشاهَد — أو null إن لحقتُ بكلِّ المعروض */
  next: { season: number; episode: number; runtime: number | null } | null;
  watched: number;
  aired: number;
  last_watched: string | null;
};

/** حلقةٌ تُذاع خلال سبعة أيّام لعملٍ أتابعه */
export type WeekEpisode = {
  id: number;
  title: string;
  poster_path: string | null;
  air_date: string;
  season: number | null;
  episode: number | null;
  name: string | null;
};

/** ما أضفتُه ولم أبدأه — بابُ «ابدأ» */
export type StartItem = {
  kind: TitleKind;
  id: number;
  title: string;
  poster_path: string | null;
  added_at: string;
};

export type HomePayload = {
  continue: ContinueItem[];
  week: WeekEpisode[];
  start: StartItem[];
};

/** `GET /api/v1/discover` — صفوفٌ عامّةٌ من TMDB، الشكلُ واحدٌ لكلِّ صفّ */
export type DiscoverCard = {
  kind: TitleKind;
  id: number;
  title: string;
  poster_path: string | null;
  vote_average: number;
  year: string | null;
};

export type DiscoverRail = {
  key: "trending_tv" | "trending_movie" | "anime" | "airing" | "upcoming";
  items: DiscoverCard[];
};

export type DiscoverPayload = { rails: DiscoverRail[] };
