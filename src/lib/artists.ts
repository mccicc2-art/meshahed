import { getFollowedArtists, getWatchedMovieIds, getWatchSummary, type ArtistLite } from "@/lib/data";
import { getPersonCredits } from "@/lib/tmdb";

export interface ArtistShelfItem extends ArtistLite {
  /** كم عملاً من أعماله شاهدتَه — صفرٌ يعني «لا تكتب السطر» */
  watchedWorks: number;
}

/**
 * كم عملاً من أعمال هذا الفنان شاهدتُه — نُطلب لتبويب الفنانين وحده.
 *
 * **لماذا العدد وليس الأبجدية هو الترتيب:** رفُّ الفنانين ليس دليل هاتف.
 * من تابعتَه بعد فيلمٍ واحد ومن شاهدتَ له اثني عشر عملاً ليسا سواءً في
 * ذهنك، والأبجدية تسوّي بينهما فتُخفي الوحيد الذي تبحث عنه. الرقم نفسه
 * هو ما يجعل الرفّ يشبه ذوقك بدل أن يشبه قائمة متابعاتٍ عشوائية.
 *
 * **الكلفة، بصدق:** نداءٌ لـTMDB لكل فنان (`combined_credits`). لكنه
 * نداءٌ **لا يعتمد على المستخدم** فيسكن خبيئة fetch المشتركة، ويُطلب
 * **حين يُفتح تبويب الفنانين وحده** لا مع كل فتحةٍ للمكتبة: صفحة المكتبة
 * اليوم لا تفتح اتصالاً واحداً مع TMDB، وجعلُ ذلك ثمناً لتبويبٍ يفتحه
 * قليلون تراجعٌ في أسخن صفحة.
 *
 * **سقفٌ معلَن لا صامت:** يُحسب العدد لأوّل `CREDIT_LOOKUPS` فنّاناً
 * (بترتيب المتابعة، الأحدث أولاً)؛ ومن بعدهم يظهر بلا سطر عددٍ وفي ذيل
 * الترتيب. من يتابع أكثر من ثلاثين فناناً حالةٌ لم تقع بعد، وثلاثون
 * نداءً متوازياً حدُّ ما يُقبل دفعُه لرسم رفّ.
 */
const CREDIT_LOOKUPS = 30;

export async function getArtistShelf(limit = 60): Promise<ArtistShelfItem[]> {
  const artists = await getFollowedArtists(limit);
  if (!artists.length) return [];

  const [movieIds, summary] = await Promise.all([getWatchedMovieIds(), getWatchSummary()]);
  /* «شاهدتُه» للمسلسل = حلقةٌ واحدة على الأقل — نفس تعريف `title_circle`
     (D-127). مفهومٌ واحد، تعريفٌ واحد، أينما سُئل عنه. */
  const watched = new Set<string>([
    ...[...movieIds].map((id) => `movie-${id}`),
    ...(summary ?? []).filter((s) => s.watched > 0).map((s) => `tv-${s.show_tmdb_id}`),
  ]);

  const counted = await Promise.all(
    artists.slice(0, CREDIT_LOOKUPS).map(async (a) => {
      try {
        const credits = await getPersonCredits(a.person_id);
        let n = 0;
        for (const c of credits) if (watched.has(`${c.media_type}-${c.id}`)) n++;
        return { ...a, watchedWorks: n };
      } catch {
        // فنانٌ واحد فشل جلبه لا يُسقط الرفّ — يظهر بلا عدد
        return { ...a, watchedWorks: 0 };
      }
    }),
  );
  const rest = artists.slice(CREDIT_LOOKUPS).map((a) => ({ ...a, watchedWorks: 0 }));

  return [...counted, ...rest].sort(
    (a, b) => b.watchedWorks - a.watchedWorks || (a.name ?? "").localeCompare(b.name ?? ""),
  );
}
