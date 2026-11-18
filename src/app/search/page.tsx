import { getT } from "@/lib/locale";
import { SearchScreen } from "@/components/SearchScreen";
import { trendingSearch } from "@/lib/searchCore";
import { getFollows, getUser, getWatchedMovieIds } from "@/lib/data";
import { getLibState } from "@/lib/libState";
import type { SearchScope } from "@/core/searchTypes";

/**
 * **صفحةُ البحث — قشرةٌ خادميّةٌ وحدَها** (D-534، تصميمُ أحمد).
 *
 * **ولا نتيجةَ تُرسم على الخادم هنا، وهذا مقصود:** البحثُ يبدأ بحرفٍ
 * يُكتب لا برابطٍ يُفتح، **وكلُّ ضغطةِ زرٍّ بعده تسأل من جديد** — فرسمُ
 * الجولة الأولى على الخادم يشتري إطاراً واحداً بثمن رحلةٍ كاملة، **ثمّ
 * يتولّى العميلُ الجولاتِ العشرَ التالية على أيّ حال.** ⚖️ **والصفحةُ صارت
 * مفتوحةً للزائر** (D-627) — نقضُ سطر «خلف تسجيل الدخول» هنا: صار
 * للزائر شريطُ بحثٍ في كرومه، وحجّةُ الفهرسة تُحلّ بأن الصفحة قشرةٌ
 * بلا محتوى خادميٍّ أصلاً.
 *
 * **والرابطُ العميق يعمل كاملاً**: `‎/search?q=suits&type=lists` يصل
 * الشاشةَ مكتوباً ومُرشَّحاً، **وهو ما يكتبه العميلُ نفسُه في العنوان
 * أثناء الكتابة** (`replaceState` — D-521).
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const { locale } = await getT();
  const { q = "", type } = await searchParams;

  const scope: SearchScope =
    type === "titles" || type === "artists" || type === "members" || type === "lists"
      ? type
      : "all";

  /* 🆕 «رائج اليوم» (٣ أكتوبر ٢٠٢٦): تُقرأ هنا لا من العميل — الصفحةُ تصل وقائمتُها فيها، بلا وميضِ
     نصّ «ابدأ» ثمّ قفزة. ومن جاء برابطٍ فيه نصٌّ لا يراها أصلاً فلا تُطلب له. لا ترمي (قائمةٌ فارغة). */
  const [trending, lib] = await Promise.all([q.trim() ? Promise.resolve([]) : trendingSearch(), libKeys()]);

  return <SearchScreen locale={locale} initialQ={q} initialScope={scope} trending={trending} lib={lib} />;
}

/**
 * 🆕 R265 — **مفاتيحُ مكتبتك لبوسترات الحاسوب** («+» حين لا يكون العملُ عندك، وعلامةُ «شاهدته»). نفسُ ما تقرؤه
 * `getLibState` (المتابعاتُ والحلقاتُ والأفلامُ المشاهَدة — نداءاتٌ مخبَّأةٌ في الطلب)، مسطّحاً إلى سلاسلَ لأنّ الشاشةَ
 * عميل. للزائر `undefined` فلا زرّ. ولا ترمي: مكتبةٌ لم تُقرأ تعني بوستراتٍ بلا علامة، لا صفحةً ساقطة.
 */
async function libKeys(): Promise<{ added: string[]; watched: string[] } | undefined> {
  try {
    if (!(await getUser())) return undefined;
    const [follows, movies, state] = await Promise.all([getFollows(), getWatchedMovieIds(), getLibState()]);
    const added = follows.map((f) => `${f.media_type}-${f.tmdb_id}`);
    const watched = new Set<string>([...movies].map((id) => `movie-${id}`));
    for (const f of follows) if (state.of(f.tmdb_id, f.media_type).watched) watched.add(`${f.media_type}-${f.tmdb_id}`);
    return { added, watched: [...watched] };
  } catch {
    return undefined;
  }
}
