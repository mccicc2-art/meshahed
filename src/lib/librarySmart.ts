import "server-only";

import {
  getFollows,
  getWatchSummary,
  getAllWatchedEpisodes,
  getWatchedMovieIds,
  getMyAnimeFlags,
  getMyRatings,
  getTitleMetaFor,
  type FollowRow,
} from "@/lib/data";
import { BROWSE_GENRES, BROWSE_ERAS, eraRange } from "@/core/browse";
import { showStatusOf, movieStatusOf } from "@/core/libraryStatus";
import type { SmartRule } from "@/lib/smartLists";

/**
 * ====== مقوِّمُ شرط المكتبة (D-876) — `rule_source = "library"` ======
 *
 * **حكمُ أحمد**: «مفردات المكتبة وحدها» — **فكلُّ ما هنا من جداولنا،
 * وصفرُ نداءٍ إلى TMDB.** **والتصفيةُ في الذاكرة بقصد**: مكتبةُ عضوٍ
 * مئاتٌ، **والقرّاءُ الخمسةُ هم قرّاءُ صفحة المكتبة أنفسُهم** (`cache()`)
 * — **فمن فتح قائمتَه بعد مكتبته لا يدفع ثمنَ استعلامٍ ثانٍ.**
 *
 * 🔑 **والحالةُ من `libraryStatus.ts`** لا من نسخةٍ هنا — **الوصفةُ
 * الواحدةُ التي تقرؤها الشبكةُ** (D-145/D-376).
 *
 * ⚠️ **وما لا `title_meta` له يسقط من محاور السنة/اللغة/البلد وحدَها**:
 * **شرطٌ يسأل عن الحقبة لا يستطيع أن يجيب عن عملٍ لا سنةَ له**، **فيُترك
 * لا يُخمَّن** (D-063). **وما لا شرطَ له من هذه الثلاثة لا يمسّه غيابُ
 * `title_meta`.**
 */
export interface LibrarySmartRow {
  tmdb_id: number;
  media_type: "tv" | "movie";
  title: string;
  poster_path: string | null;
  added_at: string;
}

function yearOfEra(slug: string): { from: number | null; to: number | null } | null {
  const era = BROWSE_ERAS.find((e) => e.slug === slug);
  if (!era) return null;
  const r = eraRange(era);
  return {
    from: r.from ? Number(r.from.slice(0, 4)) : null,
    to: r.to ? Number(r.to.slice(0, 4)) : null,
  };
}

export async function evaluateLibraryRule(
  rule: SmartRule,
  limit: number,
): Promise<LibrarySmartRow[]> {
  const wantsMeta = !!(rule.era || rule.lang || rule.co);
  const [follows, summary, watchedMovies, animeFlags, ratings] = await Promise.all([
    getFollows(),
    getWatchSummary(),
    getWatchedMovieIds(),
    getMyAnimeFlags(),
    rule.my ? getMyRatings() : Promise.resolve([]),
  ]);

  /* **نفسُ احتياط صفحة المكتبة قبل `watch_summary`** — بلا دورات الإعادة
     هنا لأنّ القائمةَ جردٌ لا عدّاد. */
  const watchedByShow = new Map<number, number>();
  if (summary) {
    for (const s of summary) watchedByShow.set(s.show_tmdb_id, s.watched);
  } else {
    for (const w of await getAllWatchedEpisodes()) {
      watchedByShow.set(w.show_tmdb_id, (watchedByShow.get(w.show_tmdb_id) ?? 0) + 1);
    }
  }

  const myRating = new Map<string, number>();
  for (const r of ratings) myRating.set(`${r.media_type}-${r.tmdb_id}`, r.rating);

  /* **النوعُ من التبويب**: `movie` · `tv` · و`all` = الأنمي (كما في
     `sectionToRuleType`) — **والأنمي علمٌ على `follows` لا استنتاج** (D-648). */
  const type = rule.type === "movie" ? "movie" : rule.type === "tv" ? "tv" : rule.type === "all" ? "anime" : null;
  const genre = rule.g ? BROWSE_GENRES.find((g) => g.slug === rule.g) ?? null : null;
  const era = rule.era ? yearOfEra(rule.era) : null;
  const minMy = rule.my ? Number(rule.my) : null;

  const pre = follows.filter((f: FollowRow) => {
    const key = `${f.media_type}-${f.tmdb_id}`;
    if (type === "movie" && f.media_type !== "movie") return false;
    if (type === "tv" && (f.media_type !== "tv" || animeFlags.get(key) === true)) return false;
    if (type === "anime" && animeFlags.get(key) !== true) return false;
    if (genre) {
      const ids = f.media_type === "tv" ? genre.tv : genre.movie;
      if (!f.genres || !ids.some((id) => f.genres!.includes(id))) return false;
    }
    if (rule.wst) {
      const status =
        f.media_type === "tv"
          ? showStatusOf(f, watchedByShow.get(f.tmdb_id) ?? 0)
          : movieStatusOf(f, watchedMovies.has(f.tmdb_id));
      if (status !== rule.wst) return false;
    }
    if (minMy !== null && (myRating.get(key) ?? 0) < minMy) return false;
    return true;
  });

  let rows = pre;
  if (wantsMeta && pre.length) {
    const meta = await getTitleMetaFor(pre.map((f) => ({ media_type: f.media_type, tmdb_id: f.tmdb_id })));
    rows = pre.filter((f) => {
      const m = meta.get(`${f.media_type}-${f.tmdb_id}`);
      if (!m) return false;
      if (era) {
        if (m.release_year === null) return false;
        if (era.from !== null && m.release_year < era.from) return false;
        if (era.to !== null && m.release_year > era.to) return false;
      }
      if (rule.lang && m.original_language !== rule.lang) return false;
      if (rule.co && !(m.origin_countries ?? []).includes(rule.co)) return false;
      return true;
    });
  }

  /* **الأحدثُ إضافةً أوّلاً** — نفسُ افتراض «الأحدث» في الشبكة (D-350) */
  return rows
    .sort((a, b) => (b.added_at > a.added_at ? 1 : b.added_at < a.added_at ? -1 : 0))
    .slice(0, limit)
    .map((f) => ({
      tmdb_id: f.tmdb_id,
      media_type: f.media_type,
      title: f.title,
      poster_path: f.poster_path,
      added_at: f.added_at,
    }));
}
