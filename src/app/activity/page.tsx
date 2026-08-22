import { redirect } from "next/navigation";
import { getUser, getFollows, getAllMovieProgress } from "@/lib/data";
import { getMyActivity } from "@/lib/myActivity";
import { getT } from "@/lib/locale";
import { localizeFollows } from "@/lib/localize";
import { posterUrl } from "@/lib/media";
import { ActivityScreen, type ActivityItem } from "@/components/ActivityScreen";

/**
 * **النشاط — سجلُّك أنت** (D-537، تصميمُ أحمد).
 *
 * ⚖️ **وهي بديلةُ `‎/diary` بقرارِه**: تلك عرضت المشاهدةَ وحدَها،
 * **وهذه تعرض الأربعةَ** — مشاهدةً وتقييماً ورأياً وإضافةً إلى قائمة —
 * **والمسارُ القديم يُحوَّل إلى هنا** فلا رابطٌ يكسر.
 *
 * **والجلبُ ثلاثةُ نداءاتٍ لا أكثر**: النشاطُ نفسُه، والمتابعاتُ
 * ومواضعُ الأفلام **لأسماء الحلقات وملصقاتها** — **فجدولا المشاهدة لا
 * يخزّنان اسماً** (بخلاف التقييمات وعناصر القوائم). **ولا نداءَ TMDB
 * لصفٍّ واحد** (D-164): ما لا نعرف اسمَه يظهر بمعرّفه كما في اليوميات.
 *
 * **والتشكيلُ هنا والقسمةُ في العميل**: حدُّ اليوم يتبع ساعةَ القارئ
 * (انظر رأس `ActivityScreen`).
 */
export default async function ActivityPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();

  const [rows, rawFollows, movieProgress] = await Promise.all([
    getMyActivity(),
    getFollows(),
    getAllMovieProgress(),
  ]);

  /* أسماءُ الأعمال تأتي من المتابعات، فترجمتها هنا تُصلح السجلَّ كلَّه
     دفعةً واحدة (D-048) */
  const follows = await localizeFollows(rawFollows, locale);

  /* **خريطةُ الاسم والملصق — وكلُّ صفٍّ يحمل اسمَه يتبرّع به لغيره**:
     صفُّ تقييمٍ يخزّن الاسمَ والملصق، **فالفيلمُ الذي قيّمتَه يُسمّي
     صفَّ مشاهدته** بلا نداءٍ خارجيّ. */
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

  const items: ActivityItem[] = rows.map((r, i) => {
    const info = meta.get(`${r.mediaType}-${r.tmdbId}`);
    return {
      /* **مفتاحٌ لا يتكرّر**: الطابعُ الزمنيّ وحدَه يتكرّر في دفعةِ
         تأشيرٍ واحدة، **والفهرسُ يفصلها** (وهو ثابتٌ لأن الفرزَ ثابت). */
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

  return (
    <div>
      <h1 className="sr-only">{t.activityTitle}</h1>
      <ActivityScreen items={items} locale={locale} />
    </div>
  );
}
