import { getFollows, getAllMovieProgress } from "@/lib/data";
import { getMyActivity } from "@/lib/myActivity";
import { localizeFollows } from "@/lib/localize";
import { posterUrl } from "@/core/media";
import type { Locale } from "@/core/i18n";
import type { ActivityItem } from "@/core/activityDays";

/**
 * ====== نواةُ «النشاط» — سجلُّك أنت (D-537) مشتركٌ بين الصفحة والتطبيق (🆕 D-1213) ======
 *
 * **لماذا ملفٌّ**: صفحةُ `/activity` كانت تبني صفوفَها في جسمها، والتطبيقُ صار يرسم الشاشةَ نفسَها أصليّةً
 * (`GET /api/v1/me/activity`). **وصفتان لسجلٍّ واحد تفترقان في أوّل تعديل** — فالبناءُ هنا مرّةً، والصفحةُ والمسارُ
 * يقرآنه (نهجُ `profileCore`/`memberStatsCore`).
 *
 * **والجلبُ ثلاثةُ نداءاتٍ لا أكثر**: النشاطُ نفسُه، والمتابعاتُ ومواضعُ الأفلام **لأسماء الحلقات وملصقاتها** —
 * **فجدولا المشاهدة لا يخزّنان اسماً** (بخلاف التقييمات وعناصر القوائم). **ولا نداءَ TMDB لصفٍّ واحد** (D-164):
 * ما لا نعرف اسمَه يظهر بمعرّفه كما في اليوميات. **والقسمةُ على الأيّام في العميل** (ساعةُ القارئ — `activityDays`).
 */
export async function getMyActivityItems(locale: Locale): Promise<ActivityItem[]> {
  const [rows, rawFollows, movieProgress] = await Promise.all([getMyActivity(), getFollows(), getAllMovieProgress()]);

  /* أسماءُ الأعمال تأتي من المتابعات، فترجمتها هنا تُصلح السجلَّ كلَّه دفعةً واحدة (D-048) */
  const follows = await localizeFollows(rawFollows, locale);

  /* **خريطةُ الاسم والملصق — وكلُّ صفٍّ يحمل اسمَه يتبرّع به لغيره**: صفُّ تقييمٍ يخزّن الاسمَ والملصق،
     **فالفيلمُ الذي قيّمتَه يُسمّي صفَّ مشاهدته** بلا نداءٍ خارجيّ. */
  const meta = new Map<string, { title: string; poster: string | null }>();
  for (const f of follows) {
    meta.set(`${f.media_type}-${f.tmdb_id}`, { title: f.title, poster: f.poster_path });
  }
  for (const m of movieProgress) {
    const key = `movie-${m.movie_tmdb_id}`;
    if (!meta.has(key) && m.title) meta.set(key, { title: m.title, poster: m.poster_path });
  }
  for (const r of rows) {
    const key = `${r.mediaType}-${r.tmdbId}`;
    if (!meta.has(key) && r.title) meta.set(key, { title: r.title, poster: r.posterPath });
  }

  return rows.map((r, i) => {
    const info = meta.get(`${r.mediaType}-${r.tmdbId}`);
    return {
      /* **مفتاحٌ لا يتكرّر**: الطابعُ الزمنيّ وحدَه يتكرّر في دفعةِ تأشيرٍ واحدة، **والفهرسُ يفصلها**
         (وهو ثابتٌ لأن الفرزَ ثابت). */
      id: `${r.kind}-${r.mediaType}-${r.tmdbId}-${r.at}-${i}`,
      kind: r.kind,
      at: r.at,
      mediaType: r.mediaType,
      tmdbId: r.tmdbId,
      title: r.title ?? info?.title ?? `#${r.tmdbId}`,
      poster: posterUrl(r.posterPath ?? info?.poster ?? null, "w185"),
      season: r.season ?? null,
      episode: r.episode ?? null,
      rating: r.rating ?? null,
      listName: r.listName ?? null,
    };
  });
}
