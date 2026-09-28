import "server-only";
import { listReviewKey, type FeedItem, type LoopzNewsItem, type TalkRoom } from "@/lib/data";
import type { Dict, Locale } from "@/core/i18n";
import { commentViewKey, newsViewKey } from "@/core/postKeys";
import { newsLine, newsSource } from "@/core/newsLine";
import { bulletinLine } from "@/core/bulletinLine";
import { curatedName } from "@/core/universes";
import { orderCommunityFeed, type FeedSort } from "@/core/communityFeed";
import { LOOPZ_ID } from "@/core/loopz";
import type { CommunityData } from "@/lib/communityCore";
import type {
  CommunityFeedRow,
  CommunityLibState,
  CommunityListCard,
  CommunityRoom,
} from "@/core/contracts/community";

/**
 * ====== من متغيّرات الصفحة إلى JSON — لا حسابَ هنا (Phase 11-M · M0) ======
 * الشكلُ وحدَه يتغيّر (القاعدة ٦، نهجُ `me/home`): الخطُّ بالمرشِّح والمرتِّب نفسَيهما
 * (`orderCommunityFeed`)، والسطورُ بقوالب القاموس نفسِها (`newsLine` · `bulletinLine`).
 */

const NO_LIB: CommunityLibState = { added: false, watched: false, progress: 0, dropped: false };

export function libOf(core: CommunityData, tmdbId: number, mediaType: "tv" | "movie"): CommunityLibState {
  const key = `${mediaType}-${tmdbId}`;
  const s = core.libState?.of(tmdbId, mediaType);
  /* غيابُ `libState` يُبقي `followed` وحدَها — سماويٌّ كما في الويب (D-850) */
  return s ? { ...s } : { ...NO_LIB, added: core.followed.has(key) };
}

export function feedRows(
  core: CommunityData,
  o: { meId: string; showStrangers: boolean; sort: FeedSort; t: Dict; locale: Locale },
): CommunityFeedRow[] {
  const ordered = orderCommunityFeed<FeedItem, LoopzNewsItem>({
    comments: core.localized,
    news: core.newsForMe.filter((n) => newsLine(n, o.t, o.locale) !== null),
    meId: o.meId,
    followingIds: core.followingIds,
    showStrangers: o.showStrangers,
    sort: o.sort,
    reviewReplies: core.reviewReplies,
    newsLikes: core.postLikes.counts,
    newsReplies: core.newsReplies,
  });
  return ordered.map((r): CommunityFeedRow => {
    const mk = `${r.item.media_type}-${r.item.tmdb_id}`;
    if (r.kind === "comment") {
      const a = r.item;
      const vk = commentViewKey(a.person.id, a.media_type, a.tmdb_id);
      const ls = a.listId ? core.listSocial.get(listReviewKey(a.listId, a.person.id)) : undefined;
      return {
        kind: "comment",
        key: `c-${a.person.id}-${a.listId ?? mk}-${a.day}`,
        view_key: vk,
        item: a,
        translated: core.feedTranslations[vk] ?? null,
        replies: core.reviewReplies.get(vk) ?? 0,
        views: core.viewCounts.get(vk) ?? null,
        i_follow_them: core.followingIds.has(a.person.id),
        lib: libOf(core, a.tmdb_id, a.media_type),
        list_social: a.listId
          ? { likes: ls?.likes ?? 0, replies: ls?.replies ?? 0, liked_by_me: ls?.likedByMe ?? false }
          : null,
      };
    }
    const n = r.item;
    const vk = newsViewKey(n.key);
    return {
      kind: "news",
      key: `n-${n.key}`,
      view_key: vk,
      item: n,
      line: newsLine(n, o.t, o.locale) ?? "",
      source: newsSource(n),
      likes: core.postLikes.counts[mk] ?? 0,
      liked_by_me: core.postLikes.mine.has(mk),
      replies: core.newsReplies.get(n.key) ?? 0,
      views: core.viewCounts.get(vk) ?? null,
      lib: libOf(core, n.tmdb_id, n.media_type),
    };
  });
}

export function roomOut(core: CommunityData, r: TalkRoom, t: Dict, locale: Locale): CommunityRoom {
  const key = `${r.mediaType}-${r.tmdbId}`;
  return {
    ...r,
    bulletin_line: r.bulletin ? bulletinLine("episode", r.bulletin, t, locale) : null,
    pin: core.globalPins?.has(key) ? 2 : core.pins?.has(key) ? 1 : 0,
  };
}

export function listOut<C extends { id: string; name: string; source_slug?: string | null }>(
  c: C,
  locale: Locale,
): CommunityListCard {
  return { ...c, name: curatedName(c.source_slug, c.name, locale) };
}

export const followsLoopz = (core: CommunityData) => core.followingIds.has(LOOPZ_ID);
