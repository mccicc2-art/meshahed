// مصدر واحد لحساب نسبة التقدّم في كل الشاشات.
//
// المشكلة التي يحلّها: صفحة المسلسل كانت تحسب على الحلقات المعروضة فقط،
// بينما الرئيسية والمكتبة تحسبان على كل الحلقات المعلنة — فتظهر ٨٨٪ هنا و٩٢٪ هناك.
// القاعدة الموحّدة الآن: المقام = الحلقات التي عُرضت فعلاً.

import type { TvDetails } from "@/lib/tmdb";

/**
 * عدد الحلقات التي عُرضت فعلاً، مشتقّ من `last_episode_to_air` بلا أي طلب إضافي:
 * كل مواسم ما قبل آخر حلقة مُذاعة + رقم تلك الحلقة داخل موسمها.
 * الموسم صفر (الحلقات الخاصة) لا يُحتسب لأن TMDB لا يحتسبه في number_of_episodes.
 */
export function airedEpisodeCount(tv: TvDetails): number {
  const last = tv.last_episode_to_air;
  const total = tv.number_of_episodes ?? 0;

  if (!last || !last.season_number || last.season_number < 1) {
    // مسلسل منتهٍ أو بلا بيانات بثّ: كل الحلقات المعلنة معروضة
    return tv.next_episode_to_air ? 0 : total;
  }

  let count = 0;
  for (const s of tv.seasons ?? []) {
    if (s.season_number < 1) continue;
    if (s.season_number < last.season_number) count += s.episode_count ?? 0;
  }
  count += last.episode_number ?? 0;

  // لا تتجاوز العدد المعلن، ولا تنزل تحت الصفر
  return Math.max(0, Math.min(count, total || count));
}

/**
 * كم حلقة عُرضت من كل موسم — لعرض «٨/١٠» على رأس الموسم دون تحميل حلقاته.
 * المواسم قبل موسم آخر حلقة مُذاعة مكتملة، والموسم الجاري حتى رقم تلك الحلقة،
 * وما بعده صفر.
 */
export function airedPerSeason(tv: TvDetails): Map<number, number> {
  const last = tv.last_episode_to_air;
  const out = new Map<number, number>();

  for (const s of tv.seasons ?? []) {
    if (s.season_number < 1) continue;
    const count = s.episode_count ?? 0;

    if (!last?.season_number) {
      out.set(s.season_number, tv.next_episode_to_air ? 0 : count);
    } else if (s.season_number < last.season_number) {
      out.set(s.season_number, count);
    } else if (s.season_number === last.season_number) {
      out.set(s.season_number, Math.min(count, last.episode_number ?? count));
    } else {
      out.set(s.season_number, 0);
    }
  }
  return out;
}

/** النسبة المئوية الموحّدة: مشاهَد ÷ معروض */
export function percentOf(watched: number, aired: number): number {
  if (!aired || aired <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((watched / aired) * 100)));
}

/** هل أنهى المستخدم كل ما عُرض من العمل؟ */
export function isComplete(watched: number, aired: number): boolean {
  return aired > 0 && watched >= aired;
}

/**
 * أول حلقة مُذاعة لم تُشاهد بعد — أساس بطاقة «الحلقة التالية».
 * يمشي على المواسم بالترتيب ويتوقّف عند حدّ آخر حلقة عُرضت،
 * فلا يقترح حلقة لم تنزل. يرجع null لو المستخدم لاحق على كل المعروض.
 */
export function nextUnwatchedEpisode(
  tv: TvDetails,
  watchedKeys: Set<string>,
): { season: number; episode: number } | null {
  const last = tv.last_episode_to_air;
  const seasons = (tv.seasons ?? [])
    .filter((s) => s.season_number >= 1 && (s.episode_count ?? 0) > 0)
    .sort((a, b) => a.season_number - b.season_number);

  for (const s of seasons) {
    // لا تتجاوز الموسم الذي وصلت إليه الإذاعة
    if (last?.season_number && s.season_number > last.season_number) break;

    const ceiling =
      last?.season_number === s.season_number
        ? Math.min(s.episode_count, last.episode_number ?? s.episode_count)
        : s.episode_count;

    for (let e = 1; e <= ceiling; e++) {
      if (!watchedKeys.has(`${s.season_number}:${e}`)) {
        return { season: s.season_number, episode: e };
      }
    }
  }
  return null;
}
