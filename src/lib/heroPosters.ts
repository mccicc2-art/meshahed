/**
 * **ثلاثيّةُ الترويسة — أوّلُ المفضّلة في كلِّ قائمة** (D-700، حكمُه:
 * «المسلسل والأنمي والفلم مأخوذ من المفضلة أول واحد في كل قائمة»).
 *
 * ================= ولماذا خرجت إلى `lib` =================
 *
 * **جاء قارئُها الثاني** (D-002: يُخرَج المشترَك عند القارئ الثاني لا
 * قبله): **بطاقةُ المشاركة صارت تلبس خلفيّةَ الصفحة** (D-715) — **ونسخُ
 * قاعدةِ الاختيار هناك يعني ملفَّين يقرّران «أيُّ ملصقٍ يمثّلك»**،
 * **ويومَ يتبدّل الترتيبُ في أحدهما تفترق الصفحةُ عن صورتها.**
 *
 * ⚠️ **والسقوطُ إلى الانتقاء الفئويّ ليس هنا**: ذاك يحتاج مكتبةً
 * محسوبةً بكاملها (`pickTasteTrioSlots`)، **والبطاقةُ لا تبني مكتبةً
 * لتملأ خانة** — **فما وجدَته المفضّلةُ يُرسم، وما لم تجده يُترك.**
 * **وهذه دالّةُ الاختيار وحدَها، والسدُّ يبقى عند من يملك ثمنَه.**
 */
export interface FavoriteLike {
  media_type: string;
  tmdb_id: number;
  poster_path?: string | null;
}

export interface FavoriteTrio<T> {
  movie?: T;
  anime?: T;
  series?: T;
}

/**
 * **الأنميُّ أوّلاً ثمّ ما بقي** — **والترتيبُ في الفحص لا في النتيجة**:
 * عملٌ أنميٌّ هو مسلسلٌ أيضاً، **فلو سُئل «مسلسل؟» قبل «أنمي؟» لابتلع
 * خانةَ المسلسل وترك خانتَه فارغة.**
 */
export function favoriteTrio<T extends FavoriteLike>(
  favs: T[],
  isAnime: (f: T) => boolean,
): FavoriteTrio<T> {
  return {
    movie: favs.find((f) => f.media_type === "movie" && !isAnime(f)),
    anime: favs.find((f) => isAnime(f)),
    series: favs.find((f) => f.media_type === "tv" && !isAnime(f)),
  };
}

/**
 * **ترتيبُ الرسم: الفيلمُ عند البداية والمسلسلُ عند النهاية** (D-704) —
 * **منطقيٌّ لا يمينيٌّ ولا يساريّ**، فيرتدّ مع الاتّجاه (القاعدة ١٧).
 */
export function trioPosterPaths<T extends FavoriteLike>(
  trio: FavoriteTrio<T>,
  fallback?: FavoriteTrio<{ posterPath?: string | null }>,
): string[] {
  return [
    trio.movie?.poster_path ?? fallback?.movie?.posterPath,
    trio.anime?.poster_path ?? fallback?.anime?.posterPath,
    trio.series?.poster_path ?? fallback?.series?.posterPath,
  ].filter((x): x is string => !!x);
}
