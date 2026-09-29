import type { NextRequest } from "next/server";
import { getT } from "@/lib/locale";
import { getUserId, getProfileByUsername, getIncomingFollowRequests } from "@/lib/data";
import { loadProfile } from "@/lib/profileCore";
import { handle, limited, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { isPlus } from "@/core/plan";
import { isLoopz } from "@/core/loopz";
import { capCards } from "@/core/cardCount";
import { HIDEABLE_PROFILE_TABS, orderedProfileTabs, sanitizeProfilePrefs } from "@/core/profilePrefs";
import {
  parseProfileHandle,
  type ProfileList,
  type ProfilePayload,
  type ProfileReview,
  type ProfileSectionKey,
  type ProfileTabKey,
  type ProfileTitle,
} from "@/core/contracts/profile";
import type { PublicListCard } from "@/lib/data";

/* العقدُ والصفحةُ على سجلِّ تبويباتٍ واحد — تبويبٌ يُضاف إلى الصفحة ولا يُضاف هنا يكسر البناءَ لا التطبيق */
const TAB_KEYS_MATCH: readonly ProfileTabKey[] = HIDEABLE_PROFILE_TABS;
void TAB_KEYS_MATCH;

const listOut = (l: PublicListCard): ProfileList => ({
  id: l.id,
  name: l.name,
  kind: l.kind,
  item_count: l.item_count,
  posters: l.posters,
  owner: l.owner,
  owner_avatar: l.owner_avatar ?? null,
  saves: l.saves ?? 0,
  reviews: l.reviews ?? 0,
  rating: l.rating ?? null,
});

/**
 * `GET /api/v1/profile/{username}` — ملفُّ الشخص للتطبيق في ردٍّ واحد (Phase 11-N · N0).
 *
 * 🔑 **ما تقرؤه صفحةُ `/u/{username}` حرفاً** (`lib/profileCore.ts`) — والعقدُ في `core/contracts/profile.ts`.
 * 🔑 **مفتوحٌ للزائر** (D-627) كالصفحة: العلاقةُ وقلوبُه و«عندك» فارغةٌ له (RLS).
 * 🔑 **الزيارةُ تُسجَّل هنا** لفتح التطبيق (`recordProfileView` في النواة) — والصفحةُ لفتحها؛ الفتحُ الواحدُ من مصدرٍ واحد.
 * ⚠️ **لا يُخزَّن**: يحمل علاقةَ القارئ وقلوبَه.
 * 🔴 **نشرُه تأخّر رفعتَين** (٢٩ سبتمبر): رسالتا N0 وN1 طويلتان (٦٣٧ و٨٨٤ حرفاً) و`[deploy]` في آخرهما — وVercel لم يبنِ
 *   (`ignoreCommand` في `vercel.json` يقرأ رسالةَ الالتزام)، فأجاب المسارُ 404 والتطبيقُ «حدث خطأ». كلُّ رسالةٍ بُنيت كانت ≤ ٣٣٥ حرفاً.
 *   القاعدةُ من اليوم: **`[deploy]` في أوّل الرسالة، والرسالةُ قصيرة.**
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ username: string }> }) {
  return handle(
    async () => {
      const { username } = await ctx.params;
      const h = parseProfileHandle(username);
      if (!h) return fail("invalid_input");

      const { locale } = await getT();
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
      const uid = await getUserId();
      const lim = limited(`v1:profile:${uid ?? ip}`, 60, 60_000);
      if (lim) return lim;

      const c = await loadProfile(h, locale);
      if (!c) return fail("not_found");
      const { profile, prefs } = c;
      const locked = !c.canView;
      const hidden = (k: string) => (prefs.hiddenTabs as readonly string[]).includes(k);
      const cardCap = capCards(999, prefs.cards);

      const genresOf = (media: "tv" | "movie", id: number) => c.followGenres.get(`${media}-${id}`) ?? null;
      const title = (f: { tmdb_id: number; media_type: "tv" | "movie"; title: string | null; poster_path: string | null }): ProfileTitle => ({
        tmdb_id: f.tmdb_id,
        media_type: f.media_type,
        title: f.title ?? `#${f.tmdb_id}`,
        poster_path: f.poster_path,
        genres: genresOf(f.media_type, f.tmdb_id),
      });
      const review = (r: (typeof c.reviewsNewest)[number]): ProfileReview => {
        const social = c.reviewLikes.get(`${r.media_type}-${r.tmdb_id}`);
        const st = c.myState?.of(r.tmdb_id, r.media_type);
        return {
          tmdb_id: r.tmdb_id,
          media_type: r.media_type,
          title: r.title,
          poster_path: r.poster_path,
          rating: r.rating ?? null,
          review: r.review?.trim() ? r.review : null,
          has_spoiler: !!r.has_spoiler,
          updated_at: r.updated_at,
          likes: social?.likes ?? 0,
          liked_by_me: !!social?.likedByMe,
          mine: {
            added: c.myLibKeys.has(`${r.media_type}-${r.tmdb_id}`),
            watched: !!st?.watched,
            progress: st?.progress ?? 0,
            dropped: !!st?.dropped,
          },
        };
      };
      /* 🆕 N1 — حجمُ الملصق حجمُ القارئ: ملفُّه هو إن كان هذا ملفَّ غيره (نداءٌ واحدٌ خفيفٌ للمسجَّل وحدَه) */
      const density = c.isMe
        ? prefs.density
        : c.me
          ? sanitizeProfilePrefs((await getProfileByUsername(c.me.id))?.profile_prefs).density
          : sanitizeProfilePrefs(null).density;
      /* 🆕 N2-fix — هل طلب صاحبُ الملفّ متابعتي؟ (قائمةُ طلباتي الواردة — قصيرةٌ، للمسجَّل وحدَه) */
      const requestedMe = c.me && !c.isMe ? (await getIncomingFollowRequests()).some((p) => p.id === profile.id) : false;
      const xHandle = c.xHandle && c.xUrl ? { handle: c.xHandle, url: c.xUrl } : null;

      const payload: ProfilePayload = {
        viewer: { signed_in: !!c.me, is_me: c.isMe, density },
        person: {
          id: profile.id,
          nickname: profile.nickname,
          username: profile.username,
          avatar_url: profile.avatar_url,
          hide_name: !!profile.hide_name,
          plan: profile.plan ?? null,
          founder: profile.founder ?? null,
          verified_at: profile.verified_at ?? null,
          cover_url: profile.cover_url,
          cover_pos: profile.cover_pos ?? null,
          avatar_pos: profile.avatar_pos ?? null,
          bio: c.bioText,
          is_private: !!profile.is_private,
          hide_follow_lists: !c.isMe && !!profile.hide_follow_lists,
          joined_at: profile.joined_at && isPlus(profile) ? profile.joined_at : null,
          system: isLoopz(profile.id),
          x: xHandle,
        },
        locked,
        relation: { following: c.relation.following, requested: c.relation.requested, follows_me: c.relation.followsMe, requested_me: requestedMe },
        counts: {
          followers: c.stats.followers,
          following: c.stats.following,
          shows: c.tvFollows.length,
          movies: c.movieFollows.length,
          anime: c.animeFollows.length,
        },
        weekly_ranks: c.weeklyRanks,
        display: { stats: prefs.stats, stats_link: prefs.statsLink, cards: cardCap >= 999 ? null : cardCap },
        tabs: locked ? [] : (orderedProfileTabs(prefs).filter((k) => !hidden(k)) as ProfileTabKey[]),
        sections: prefs.order as ProfileSectionKey[],
        favorites: locked
          ? { order: [...c.favOrder], shows: [], movies: [], anime: [] }
          : { order: [...c.favOrder], shows: c.favShows.map(title), movies: c.favMovies.map(title), anime: c.favAnime.map(title) },
        overview: locked
          ? { shows: [], anime: [], movies: [], artists: [], lists: [], ratings: [] }
          : {
              shows: c.shows.map((s) => ({ tmdb_id: s.id, media_type: "tv", title: s.title, poster_path: s.posterPath, genres: genresOf("tv", s.id), progress: s.progress })),
              anime: c.anime.map((s) => ({ tmdb_id: s.id, media_type: "tv", title: s.title, poster_path: s.posterPath, genres: genresOf("tv", s.id), progress: s.progress })),
              movies: c.movieFollows.map(title),
              artists: c.artistsOrdered.map((a) => ({ person_id: a.person_id, name: a.name, profile_path: a.profile_path })),
              lists: c.listsOrdered.map(listOut),
              ratings: c.topRated.map(review),
            },
        activity: locked
          ? []
          : c.activityItems.map((a) => ({
              id: a.id,
              kind: a.kind,
              at: a.at,
              media_type: a.mediaType,
              tmdb_id: a.tmdbId,
              title: a.title,
              poster: a.poster,
              season: a.season ?? null,
              episode: a.episode ?? null,
              rating: a.rating ?? null,
              list_name: a.listName ?? null,
            })),
        reviews: locked ? [] : c.reviewsNewest.map(review),
        lists: locked ? { public: [], saved: [] } : { public: c.listsOrdered.map(listOut), saved: c.savedLists.map(listOut) },
        owner: c.isMe ? { fav_list_id: c.favListId, fav_keys: c.favKeys, section_order: { ...prefs.sectionOrder } as Record<string, string[]> } : null,
      };
      return ok(payload);
    },
    { cacheControl: "private, no-store" },
  );
}
