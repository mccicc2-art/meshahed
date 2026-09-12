import {
  getFollows,
  getWatchedMovieIds,
  getMyLists,
  getSavedLists,
  getSavedListsCount,
  getMyListedMovieIds,
  getProfile,
  getMyPlaylistIds,
  getListCardStats,
  getTitleMetaFor,
  listsForDisplay,
  type PublicListCard,
} from "@/lib/data";
import { sanitizeHomePrefs, applyQueueOrder, unwatchedOf } from "@/core/homePrefs";
import { buildAutoGroups } from "@/core/autoGroups";
import { isPlus } from "@/core/plan";
import { backdropUrl } from "@/core/media";
import { curatedName } from "@/core/universes";
import { getDict } from "@/core/i18n";
import { getLocale } from "@/lib/locale";
import { handle, requireUser, limited } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import type { LibraryListCard, LibraryListsPayload } from "@/core/contracts/library";

/**
 * `GET /api/v1/me/library/lists` — تبويبُ «قوائم» كلُّه في ردٍّ واحد (D-947).
 *
 * 🔑 **الموجةُ هي موجةُ صفحة المكتبة حين يُفتح تبويبُ «القوائم»** (D-350/
 * D-559/D-820): قوائمي · المحفوظة · طابورُ «للمشاهدة» · رايةُ التشغيل ·
 * الأرقامُ · «تجتمع عندك» — **بالدوالِّ نفسِها وبترتيبها**، فلا عددٌ يختلف
 * بين الصفحة والشاشة. **وصفرُ نداءِ TMDB** كما في الصفحة (`title_meta` مخزَّنة).
 *
 * 🔑 **والبطاقةُ تُشكَّل هنا لا في الشاشة**: نصُّ العدّ (`count_label`)
 * واسمُ قائمةِ لوبز بلغة القارئ (`curatedName`) ورابطُ الغلاف — **كلُّها
 * قراراتُ عرضٍ اتّخذها الويب مرّةً** (`ListManager` · `CommunityListCard`)،
 * والشاشةُ ترسم ما يصلها. مصدرٌ واحدٌ للحقيقة (D-145).
 */
export async function GET() {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const lim = limited(`v1:library:lists:${auth.user.id}`, 30, 60_000);
    if (lim) return lim;

    const [locale, followRows, watchedMovieIds, lists, saved, listedMovieIds, profileRow, savedCount, playlistIds] =
      await Promise.all([
        getLocale(),
        getFollows(),
        getWatchedMovieIds(),
        getMyLists().catch(() => []),
        getSavedLists().catch(() => [] as PublicListCard[]),
        getMyListedMovieIds().catch(() => new Set<number>()),
        getProfile().catch(() => null),
        getSavedListsCount().catch(() => 0),
        getMyPlaylistIds().catch(() => [] as string[]),
      ]);
    const t = getDict(locale);
    const shown = listsForDisplay(lists);

    const [stats, metas] = await Promise.all([
      getListCardStats(shown.filter((l) => l.is_public).map((l) => l.id)).catch(
        () => new Map<string, { saves: number; reviews: number; rating: number | null }>(),
      ),
      getTitleMetaFor(followRows.map((f) => ({ media_type: f.media_type, tmdb_id: f.tmdb_id }))).catch(
        () => new Map(),
      ),
    ]);

    /* طابورُ «للمشاهدة» — حسابُ الصفحة حرفاً (D-559 · D-719 · D-848) */
    const prefs = sanitizeHomePrefs(profileRow?.home_prefs);
    const queue = followRows
      .filter((f) => f.media_type === "movie" && !listedMovieIds.has(f.tmdb_id))
      .sort((a, b) => a.added_at.localeCompare(b.added_at));
    const left = unwatchedOf(queue, watchedMovieIds);
    const ordered = applyQueueOrder(left, (f) => `tw-mv-${f.tmdb_id}`, prefs.towatchListOrder);
    const to_watch = left.length
      ? {
          on: prefs.toWatch,
          count: left.length,
          posters: ordered.slice(0, 3).map((f) => f.poster_path ?? null),
          /* D-948 — بذرةُ ورقة الترتيب كما تبنيها الصفحة (`toWatchListItems`، D-719) */
          items: ordered.map((f) => ({ key: `tw-mv-${f.tmdb_id}`, title: f.title, poster_path: f.poster_path ?? null, media_type: "movie" as const })),
        }
      : null;

    const playlists = new Set(playlistIds);
    const mine: LibraryListCard[] = shown.map((l) => {
      const st = stats.get(l.id);
      return {
        id: l.id,
        name: l.name,
        kind: l.kind,
        owner: null,
        owner_avatar: null,
        item_count: l.item_count,
        posters: l.posters ?? [],
        saves: st?.saves ?? 0,
        reviews: st?.reviews ?? 0,
        rating: st?.rating ?? null,
        count_label:
          l.kind === "smart"
            ? locale === "en"
              ? "Fills itself"
              : "تمتلئ وحدَها"
            : typeof l.shows_count === "number" || typeof l.movies_count === "number"
              ? t.listContentCount(l.shows_count ?? 0, l.movies_count ?? 0)
              : null,
        cover: backdropUrl(l.cover_backdrop ?? null, "w780"),
        mine: true,
        is_public: l.is_public,
        playlist: playlists.has(l.id),
        can_save: false,
        saved_by_me: false,
      };
    });
    const savedCards: LibraryListCard[] = saved.map((l) => ({
      id: l.id,
      name: curatedName(l.source_slug, l.name, locale === "en" ? "en" : "ar"),
      kind: l.kind,
      owner: l.owner,
      owner_avatar: l.owner_avatar ?? null,
      item_count: l.item_count,
      posters: l.posters,
      saves: l.saves ?? 0,
      reviews: l.reviews ?? 0,
      rating: l.rating ?? null,
      count_label: null,
      cover: null,
      mine: !!l.mine,
      is_public: true,
      playlist: typeof l.playlist === "boolean" ? l.playlist : null,
      can_save: !!l.can_save,
      saved_by_me: l.saved_by_me !== false,
      can_review: !!l.can_review,
      my_review: l.my_review ? { rating: l.my_review.rating, body: l.my_review.body, has_spoiler: l.my_review.hasSpoiler } : null,
    }));

    const groups = buildAutoGroups(followRows, metas);
    const payload: LibraryListsPayload = {
      lists: mine,
      to_watch,
      saved: savedCards,
      saved_count: savedCount,
      auto_groups: groups.map((g) => ({
        kind: g.kind,
        name: g.name,
        photo: g.photo,
        items: g.items.map((x) => ({ key: x.key, media_type: x.media_type, tmdb_id: x.tmdb_id, title: x.title, poster: x.poster })),
      })),
      plus: isPlus(profileRow),
      has_smart: shown.some((l) => l.kind === "smart"),
    };
    return ok(payload);
  });
}
