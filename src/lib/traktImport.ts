// خطّةُ استيراد Trakt — دالّةٌ نقيّة تقرّر ما يُكتب وما يُترك، والكتابةُ نفسُها في مسار العودة.
//
// 🆕 R277 — **ما في مكتبة Loopz يبقى لصاحبه** (أحمد ١٩ نوفمبر: «العمل موجود من قبل في مكتبة لوبز يتكمل وينحط تقييمه،
// لاكن اذا كان مقيمه ف لوبز ما يتغير يبقى حق لوبز»). كانت العودةُ تكتب فوق كلِّ عملٍ موجود: اسمُه يصير اسمَ Trakt
// وملصقُه يُمسح (`poster_path: null`)، وتقييمُ Trakt يدهس تقييمَ Loopz. فالخطّةُ الآن:
//   • عملٌ جديد ⇐ يُضاف (بملصقه واسمه من TMDB إن وصلا).
//   • عملٌ موجود ⇐ صفُّه لا يُمسّ؛ وإن كان بلا ملصق (استيرادٌ سابق) يُعبّأ ملصقُه وحدَه.
//   • المشاهداتُ ⇐ تُضاف وما عند العضو يبقى بتاريخه (الكتابةُ `ignoreDuplicates`).
//   • التقييمُ ⇐ يُكتب فقط لعملٍ لا تقييمَ له في Loopz.

import type { TraktHarvest } from "./trakt";

export type TraktKind = "tv" | "movie";
export const traktKey = (kind: TraktKind, tmdbId: number) => `${kind}-${tmdbId}`;

/** كم عملاً تُجلب تفاصيلُه من TMDB داخل ردّ العودة — والباقي تعبّئه مزامنةُ المكتبة كما كانت */
export const TRAKT_POSTER_CAP = 100;

export interface TraktLibrary {
  /** مفتاحُ كلِّ عملٍ في المكتبة ⇐ هل له ملصق */
  follows: Map<string, { hasPoster: boolean }>;
  /** مفاتيحُ ما قيّمه العضو في Loopz */
  rated: Set<string>;
}

export interface TraktPlan {
  /** أعمالٌ تدخل المكتبةَ أوّلَ مرّة */
  add: { kind: TraktKind; tmdbId: number; title: string }[];
  /** أعمالٌ تُجلب تفاصيلُها: الجديدُ أوّلاً ثم الموجودُ بلا ملصق، حتى السقف */
  posters: { kind: TraktKind; tmdbId: number; isNew: boolean }[];
  /** تقييماتٌ تُكتب — لما لا تقييمَ له في Loopz فقط */
  rate: { kind: TraktKind; tmdbId: number; title: string; rating: number }[];
}

export function planTraktImport(
  h: Pick<TraktHarvest, "shows" | "movies">,
  lib: TraktLibrary,
  posterCap = TRAKT_POSTER_CAP,
): TraktPlan {
  const add: TraktPlan["add"] = [];
  const fill: TraktPlan["posters"] = [];
  const rate: TraktPlan["rate"] = [];
  const seen = new Set<string>();

  const items: { kind: TraktKind; tmdbId: number; title: string; rating?: number }[] = [
    ...h.shows.map((s) => ({ kind: "tv" as const, tmdbId: s.tmdbId, title: s.title, rating: s.rating })),
    ...h.movies.map((m) => ({ kind: "movie" as const, tmdbId: m.tmdbId, title: m.title, rating: m.rating })),
  ];

  for (const it of items) {
    const k = traktKey(it.kind, it.tmdbId);
    // التكرارُ يُطوى: Postgres يرفض إصابةَ الصفِّ مرّتين في أمرٍ واحد
    if (seen.has(k)) continue;
    seen.add(k);

    const have = lib.follows.get(k);
    if (!have) add.push({ kind: it.kind, tmdbId: it.tmdbId, title: it.title });
    else if (!have.hasPoster) fill.push({ kind: it.kind, tmdbId: it.tmdbId, isNew: false });

    if (it.rating && !lib.rated.has(k)) {
      rate.push({ kind: it.kind, tmdbId: it.tmdbId, title: it.title, rating: Math.max(1, Math.min(10, Math.round(it.rating))) });
    }
  }

  const posters = [...add.map((a) => ({ kind: a.kind, tmdbId: a.tmdbId, isNew: true })), ...fill].slice(0, posterCap);
  return { add, posters, rate };
}
