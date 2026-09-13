import {
  getPublicListsFeed,
  getForYouLists,
  getMySavedListIds,
  getListCardsByIds,
  getCuratedListIds,
  getListCardStats,
  getCuratedCounts,
  getMyListReviews,
  getTopSavedListCards,
  type PublicListCard,
} from "@/lib/data";
import { toLibraryListCard } from "@/lib/listCard";
import { FRANCHISES, franchiseName, universeName, type Universe } from "@/core/universes";
import { awardBySlug, awardBody } from "@/core/awards";
import { awardWins } from "@/core/awardsWins";
import { LOOPZ_PERSON } from "@/core/loopz";
import { awardWinners, topRatedRows, resolveSetIds, moviesByIds } from "@/lib/tmdb";
import { getLocale } from "@/lib/locale";
import { SITE_URL } from "@/lib/site";
import { getDict } from "@/core/i18n";
import { handle, requireUser, limited } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import type { LibraryListCard } from "@/core/contracts/library";
import type { DiscoverListsPayload } from "@/core/contracts/discover";

/**
 * `GET /api/v1/discover/lists` — تبويبُ «القوائم» في «اكتشف» كلُّه في ردٍّ واحد
 * (Phase 11-C · C3 · D-955).
 *
 * 🔑 **الموجةُ موجةُ `ListsDiscovery` حرفاً** (بالدوالِّ نفسِها وترتيبها): قوائمُ
 * تناسبك · الرائجةُ الآن · من المجتمع · ثمّ **العوالمُ المنسَّقة** بمجموعاتها
 * (`FRANCHISES` → `CuratedCard`): الأربعُ ملصقاتٍ من `awardWinners`/`topRatedRows`/
 * `resolveSetIds` — **كما تحلّها بطاقةُ الصفحة**، بخبيئة `tmdb()` نفسِها. **وما
 * يُكرَّر بين «الرائجة» و«تناسبك» يُحذف من الثانية** (`shown`) كما في الصفحة.
 * بطاقةُ لوبز تُشكَّل هنا (`LibraryListCard`): الاسمُ بلغة القارئ، الصاحبُ Loopz،
 * وسطرُ العدّ مع «بترتيب الأحداث»/جهةِ الجائزة.
 */
export async function GET() {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const lim = limited(`v1:discover:lists:${auth.user.id}`, 20, 60_000);
    if (lim) return lim;
    const locale = await getLocale();
    const t = getDict(locale);
    const loc = locale === "en" ? ("en" as const) : ("ar" as const);

    const community = (await getPublicListsFeed(25).catch(() => [] as PublicListCard[])).slice(0, 15);
    const [forYouRows, savedIds, curated, trending] = await Promise.all([
      getForYouLists(12).catch(() => []),
      getMySavedListIds().catch(() => new Set<string>()),
      getCuratedListIds().catch(() => new Map<string, string>()),
      getTopSavedListCards(30, 12).catch(() => [] as PublicListCard[]),
    ]);
    const shown = new Set(trending.map((c) => c.id));
    const forYou = await getListCardsByIds(forYouRows.map((r) => r.listId).filter((id) => !shown.has(id))).catch(() => [] as PublicListCard[]);
    const ids = [...curated.values()];
    const [stats, counts, mine] = await Promise.all([
      getListCardStats(ids).catch(() => new Map<string, { saves: number; reviews: number; rating: number | null }>()),
      getCuratedCounts(ids).catch(() => new Map<string, number>()),
      getMyListReviews(ids).catch(() => new Map<string, { rating: number; body: string | null; hasSpoiler: boolean }>()),
    ]);

    /* بطاقةُ مجموعةٍ منسَّقة — منطقُ `CuratedCard` (الملصقاتُ الأربع والعدُّ والسطرُ الإضافيّ) */
    const curatedCard = async (u: Universe): Promise<LibraryListCard | null> => {
      const listId = curated.get(u.slug);
      if (!listId) return null;
      const award = u.award ? awardBySlug(u.award) : null;
      const awardFour = u.award ? await awardWinners(u.award, 4).catch(() => []) : null;
      const topRows = u.top ? await topRatedRows(u.top, 8).catch(() => []) : null;
      const setIds = topRows || awardFour ? [] : await resolveSetIds(u, u.titles ? 4 : undefined).catch(() => [] as number[]);
      const four = awardFour ?? (topRows ? topRows.slice(0, 4) : await moviesByIds(setIds.slice(0, 4)).catch(() => []));
      const count = counts.get(listId) ?? (award ? awardWins(award).length : topRows ? (u.topLimit ?? 250) : u.titles ? u.titles.length : setIds.length);
      const st = stats.get(listId);
      const my = mine.get(listId) ?? null;
      const extra = award ? ` · ${awardBody(award, loc)}` : u.storyOrder ? ` · ${t.listsStoryOrder}` : "";
      return {
        id: listId,
        name: universeName(u, loc),
        kind: "curated",
        owner: LOOPZ_PERSON.nickname,
        owner_avatar: LOOPZ_PERSON.avatar_url ? `${SITE_URL}${LOOPZ_PERSON.avatar_url}` : null,
        item_count: count,
        posters: four.map((m) => m.poster_path).filter((p): p is string => !!p),
        saves: st?.saves ?? 0,
        reviews: st?.reviews ?? 0,
        rating: st?.rating ?? null,
        count_label: t.listCount(count) + extra,
        cover: null,
        mine: false,
        is_public: true,
        playlist: null,
        can_save: true,
        saved_by_me: savedIds.has(listId),
        can_review: true,
        my_review: my ? { rating: my.rating, body: my.body, has_spoiler: my.hasSpoiler } : null,
      };
    };
    const franchises = (
      await Promise.all(
        FRANCHISES.map(async (f) => {
          const sets = (await Promise.all(f.sets.map(curatedCard))).filter((c): c is LibraryListCard => !!c);
          return sets.length ? { slug: f.slug, name: franchiseName(f, loc), see_all: `/news?tab=lists&fr=${f.slug}`, sets } : null;
        }),
      )
    ).filter((f): f is NonNullable<typeof f> => !!f);

    const payload: DiscoverListsPayload = {
      for_you: forYou.map((l) => toLibraryListCard(l, locale)),
      trending: trending.map((l) => toLibraryListCard(l, locale)),
      community: community.map((l) => toLibraryListCard(l, locale)),
      franchises,
    };
    return ok(payload);
  });
}
