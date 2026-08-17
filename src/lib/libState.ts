import { getFollows, getWatchSummary, getWatchedMovieIds } from "./data";

/**
 * **حالةُ عملٍ في مكتبة القارئ — قراءةٌ واحدة لصفحةٍ كاملة** (D-322).
 *
 * ================= لماذا وُلد هذا الملفّ =================
 *
 * **طلبُ أحمد: «الخط السماوي والأخضر تحت البوستر والأحمر كذلك — نفس
 * المكتبة».** والخيطُ نفسُه مبنيٌّ منذ D-229 في `PosterCard`، **وإنما
 * كانت رفوفُ اكتشف لا تعرف ما تعرفه المكتبة**: تمرّر `following` وحدَها
 * (مجموعةَ «هل هو عندك؟») **فلا لونَ إلا السماويّ** — ولا أخضرَ لمنتهٍ
 * ولا أصفرَ لجارٍ ولا أحمرَ لموقوف.
 *
 * **والحلُّ مصدرٌ واحدٌ للسؤال الرباعيّ** لا أربعُ مجموعاتٍ تُمرَّر جنباً
 * إلى جنب: **أربعةُ معاملاتٍ في كلِّ رفٍّ هي كيف يفترق اثنان منها يوماً**
 * (D-145)، **والسؤالُ واحد: «ما حالُ هذا العمل عندي؟»**.
 *
 * ⚠️ **وثمنُه ثلاثةُ نداءاتٍ للصفحة كلِّها لا لكلِّ ملصق** (D-205):
 * `getFollows` و`getWatchSummary` و`getWatchedMovieIds` **كلُّها مغلَّفةٌ
 * بـ`cache` فالنداءُ واحدٌ للطلب** ولو سألها عشرةُ رفوف. **وشبكةٌ من
 * ستّين بطاقةً تسأل كلُّ واحدةٍ عن نفسها ستّون استعلاماً** — وهو ما لا
 * يُفعل.
 *
 * ⚠️ **وسقوطُ أيِّها لا يُسقط الرفّ**: الحالةُ الفارغة تعني «ليس عندك»،
 * **والخيطُ الغائب أصدقُ من خيطٍ يكذب** (D-063) — وأوّلُ ضغطةٍ تُصلح
 * الحقيقة.
 */
export interface TitleState {
  /** في مكتبتك (صفُّ `follows` قائم) — الخيطُ سماويّ */
  added: boolean;
  /** انتهيتَ منه — الخيطُ أخضر */
  watched: boolean;
  /** ٠..١٠٠ للمسلسل الجاري — الخيطُ أصفرُ بمقدارها */
  progress: number;
  /** بطاقةٌ حمراء — الخيطُ أحمرُ كاملاً مهما كان التقدّم */
  dropped: boolean;
}

const NONE: TitleState = { added: false, watched: false, progress: 0, dropped: false };

export interface LibState {
  of(tmdbId: number, mediaType: "tv" | "movie" | string): TitleState;
}

/** حالةٌ فارغةٌ لا تكذب — لزائرٍ أو لنداءٍ سقط */
export const EMPTY_LIB_STATE: LibState = { of: () => NONE };

export async function getLibState(): Promise<LibState> {
  const [follows, summary, movieIds] = await Promise.all([
    getFollows().catch(() => []),
    getWatchSummary().catch(() => null),
    getWatchedMovieIds().catch(() => new Set<number>()),
  ]);

  const rows = new Map(follows.map((f) => [`${f.media_type}-${f.tmdb_id}`, f]));
  const seenEps = new Map((summary ?? []).map((s) => [s.show_tmdb_id, s.watched]));

  return {
    of(tmdbId, mediaType) {
      const mt = mediaType === "tv" ? "tv" : "movie";
      const row = rows.get(`${mt}-${tmdbId}`);
      if (!row) return NONE;
      const dropped = !!row.dropped;

      if (mt === "movie") {
        const watched = movieIds.has(tmdbId);
        return { added: true, watched, progress: watched ? 100 : 0, dropped };
      }

      /* **المقامُ `aired_episodes` لا `total_episodes`** — نفسُ مقام
         المكتبة (D-216: المقامُ يُذكر مع البسط ومن نفس القوم).
         **ومسلسلٌ لم تُخبَّأ إحصاءاتُه بعد مقامُه صفر**، فيبقى «عندك»
         سماويّاً ولا يُخترع له تقدّم (D-063). */
      const aired = row.aired_episodes ?? 0;
      const watchedEps = seenEps.get(tmdbId) ?? 0;
      const progress = aired > 0 ? Math.round((watchedEps / aired) * 100) : 0;
      return { added: true, watched: aired > 0 && watchedEps >= aired, progress, dropped };
    },
  };
}
