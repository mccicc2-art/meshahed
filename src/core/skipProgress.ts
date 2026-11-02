import type { TvDetails } from "@/lib/tmdb";
import { skipKeysOf, type SeasonHead, type SkipMode } from "./filler.ts";
import { airedEpisodeCount, airedPerSeason, firstEpisodeOf } from "./progress.ts";

/**
 * ============ التقدّمُ بلا المخفيّ — للرئيسيّة والمكتبة والودجت (D-1623) ============
 *
 * أحمد ٢ نوفمبر («٤أ»): «إخفاء الفلر» و«المسار الذهبي» يُحفظان في الحساب ويُطبَّقان في كلِّ مكان. صفحةُ العمل تعدّ
 * بلا المخفيّ منذ D-1619 (`countKeys` على رؤوس المواسم)؛ هنا الحسابُ نفسُه من تفاصيل TMDB التي يملكها الخادم:
 * رؤوسُ المواسم بنوافذها (`firstEpisodeOf` — مطلقٌ أو نسبيّ، D-603) ⇐ `skipKeysOf` ⇐ المعروضُ والمشاهَدُ بلا المخفيّ.
 * 🔑 **الحسابُ واحد**: المفاتيحُ من الدالّة التي ترسم بها الصفحة، فلا تقول الرئيسيّةُ ٨٠٪ والصفحةُ ٩٠٪.
 */

/** رؤوسُ المواسم المنتظمة بأوّل رقمٍ في كلٍّ منها — شكلُ `SeasonHead` الذي تأخذه قوائمُ الفلر */
export function headsOf(tv: TvDetails): SeasonHead[] {
  const first = firstEpisodeOf(tv);
  return (tv.seasons ?? [])
    .filter((s) => s.season_number >= 1)
    .map((s) => ({ season_number: s.season_number, episode_count: s.episode_count ?? 0, first_episode: first.get(s.season_number) ?? 1 }));
}

/** المفاتيحُ المخفيّة لهذا العمل بهذا الوضع، و`null` إن لم يُخفَ شيء */
export function skipKeysForTv(tv: TvDetails, mode: SkipMode): Set<string> | null {
  if (mode === "all") return null;
  return skipKeysOf(tv.id, headsOf(tv), mode);
}

/**
 * **المعروضُ والمشاهَدُ بلا المخفيّ** — `aired` من `airedEpisodeCount` ناقصاً ما أُخفي من المبثوث (المواسمُ بنوافذها حتى آخر
 * حلقةٍ عُرضت، `airedPerSeason`)، و`watched` مفاتيحُ المواسم المنتظمة غيرُ المخفيّة (لا يتجاوز المعروض).
 */
export function shownProgress(tv: TvDetails, watchedKeys: ReadonlySet<string>, skip: ReadonlySet<string> | null): { aired: number; watched: number } {
  const per = airedPerSeason(tv);
  const first = firstEpisodeOf(tv);
  let hidden = 0;
  if (skip?.size) {
    for (const [season, count] of per) {
      const lo = first.get(season) ?? 1;
      for (let e = lo; e < lo + count; e++) if (skip.has(`${season}:${e}`)) hidden++;
    }
  }
  const aired = Math.max(0, airedEpisodeCount(tv) - hidden);
  let watched = 0;
  for (const k of watchedKeys) {
    const i = k.indexOf(":");
    if (i < 0 || Number(k.slice(0, i)) < 1 || skip?.has(k)) continue;
    watched++;
  }
  return { aired, watched: Math.min(watched, aired || watched) };
}
