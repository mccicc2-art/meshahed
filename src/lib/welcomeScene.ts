import "server-only";
import { GENRES } from "@/core/media";
import { discoverByGenres, isTalkOrNews } from "@/lib/tmdb";

/**
 * ====== 🆕 T414 — مشاهدُ بطاقات الأنواع في الترحيب العريض (التصميم «ج — المشهد»، أحمد ١٨ نوفمبر) ======
 *
 * كلُّ نوعٍ بطاقةٌ عليها مشهدٌ من عملٍ ينتمي إليه — **من TMDB حيّاً لا مساراتٍ مكتوبة**: مسارُ صورةٍ يُحفظ هنا يشيخ
 * بصمت (القاعدةُ نفسُها في `welcomeSeeds`).
 *
 * 🔑 **الأشهرُ بعدد المقيّمين لا بالرواج اليوميّ**: رواجُ اليوم يضع مسلسلاً مجهولاً على «عائلي»؛ عددُ الأصوات يضع ما
 * يعرفه الناس. ونداءُ الرفّ نفسُه (`discoverByGenres`) فالخبيئةُ مشتركةٌ مع بِركة الاقتراحات.
 * 🔑 **وعملٌ واحدٌ لا يتكرّر على بطاقتين**: مسلسلٌ في «دراما» و«جريمة» معاً يجعل البطاقتين صورةً واحدة.
 * ⚖️ **والفشلُ خريطةٌ ناقصة لا خطأ**: نوعٌ بلا مشهدٍ يُرسم بلونٍ وحده — زينةٌ لا شرطُ خطوة.
 */
export async function genreBackdrops(): Promise<Record<number, string>> {
  const lists = await Promise.all(
    GENRES.map((g) => discoverByGenres([g.id], "tv").catch(() => [])),
  );
  const used = new Set<number>();
  const out: Record<number, string> = {};
  GENRES.forEach((g, i) => {
    const best = lists[i]
      .filter((r) => r.backdrop_path && !isTalkOrNews(r) && !used.has(r.id))
      .sort((a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0))[0];
    if (!best?.backdrop_path) return;
    used.add(best.id);
    out[g.id] = best.backdrop_path;
  });
  return out;
}
