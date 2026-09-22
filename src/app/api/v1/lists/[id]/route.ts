import { NextRequest } from "next/server";
import { getList, getPublicList, getMyListSave, getListCardStats, getMyListReview, getListReviews, getListReviewSocial, getListReviewReplies, listReviewKey, getUserId } from "@/lib/data";
import { displayNameOf } from "@/core/people";
import { getDict } from "@/core/i18n";
import { resolveSmartItems } from "@/lib/listItems";
import { localizeRows } from "@/lib/localize";
import { awardWinners } from "@/lib/tmdb";
import { curatedName, curatedBlurb, universeBySlug } from "@/core/universes";
import { LOOPZ_PERSON } from "@/core/loopz";
import { getLocale } from "@/lib/locale";
import { SITE_URL } from "@/lib/site";
import { handle, limited, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { listTag } from "@/core/contracts/tags";
import type { ListDetailPayload } from "@/core/contracts/library";

/**
 * ====== `GET /api/v1/lists/[id]` — صفحةُ القائمة للشاشة الأصليّة (D-1036) ======
 *
 * **لماذا** (طلبُ أحمد بعد بلاغ D-1035: «اجعل صفحة القائمة تطبيق أصليّة»): كانت أكثرَ صفحة ويب تُفتح
 * من داخل شاشتين أصليّتين (تبويبُ القوائم في «المكتبة» وفي «اكتشف») — برأسٍ مختلفٍ وانتقالٍ أبطأ.
 *
 * 🔑 **القرّاءُ قرّاءُ الصفحة أنفسُهم** (`getList` · `public_list` · `resolveSmartItems` · `localizeRows`
 * · `awardWinners`) — فالحراسةُ حراستُها: قائمةٌ خاصّةٌ لغيري لا يردّها RLS أصلاً ⇒ `not_found`.
 * **والزائرُ يقرأ المعلنة** كما في الصفحة (D-627): لا `requireUser` هنا؛ الكتابةُ يردّها مسارُها.
 * ⚖️ **الشريحةُ الأولى قراءةٌ**: آراءُ الناس وردودُهم وتحريرُ المالك تبقى في الويب ببابٍ من الشاشة.
 * **لا `unstable_cache`**: الردُّ يحمل حالتي ويقرأ `cookies()` (درسُ D-1013) ⇒ `private, no-store`.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(
    async () => {
      const { id } = await ctx.params;
      if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("invalid_input");
      const uid = await getUserId();
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
      const lim = limited(`v1:list:${uid ?? ip}`, 60, 60_000);
      if (lim) return lim;

      const data = await getList(id);
      if (!data) return fail("not_found");
      const locale = await getLocale();
      const loc = locale === "en" ? ("en" as const) : ("ar" as const);
      const mine = !!uid && data.list.user_id === uid;
      const award = data.list.source_slug ? (universeBySlug(data.list.source_slug)?.award ?? null) : null;

      const [pub, mySave, stats, myReview, smart, winners, reviews, social, replies] = await Promise.all([
        mine ? Promise.resolve(null) : getPublicList(id),
        mine || !uid ? Promise.resolve(null) : getMyListSave(id),
        data.list.is_public ? getListCardStats([id]).catch(() => new Map<string, { saves: number; reviews: number; rating: number | null }>()) : Promise.resolve(new Map<string, { saves: number; reviews: number; rating: number | null }>()),
        data.list.is_public && !mine && uid ? getMyListReview(id).catch(() => null) : Promise.resolve(null),
        resolveSmartItems(data.list, locale),
        award ? awardWinners(award).catch(() => []) : Promise.resolve([]),
        data.list.is_public ? getListReviews(id).catch(() => []) : Promise.resolve([]),
        data.list.is_public ? getListReviewSocial([id]).catch(() => new Map()) : Promise.resolve(new Map()),
        data.list.is_public ? getListReviewReplies(id).catch(() => []) : Promise.resolve([]),
      ]);
      const t = getDict(locale);
      const badges = new Map(winners.map((r) => [`${r.media_type === "tv" ? "tv" : "movie"}-${r.id}`, r.awarded]));
      const rows = await localizeRows(smart.rows ?? data.items, locale);
      const st = stats.get(id);
      const curated = !!data.list.source_slug;

      const payload: ListDetailPayload = {
        id: data.list.id,
        name: curatedName(data.list.source_slug, data.list.name, loc),
        subtitle: curatedBlurb(data.list.source_slug, loc) ?? data.list.subtitle,
        kind: data.list.kind,
        is_public: data.list.is_public,
        mine,
        smart: !!smart.rule,
        /* G5 — الشرطُ للمالك وحدَه: الويبُ لا يكشف شرطَ المكتبة لغيره (`ListDetail` يرسم رابطَ التعديل للمالك فقط) */
        smart_rule: mine && smart.rule ? smart.rule : null,
        smart_source: mine && smart.rule ? smart.source : null,
        owner: mine
          ? null
          : curated
            ? { name: LOOPZ_PERSON.nickname ?? "Loopz", username: LOOPZ_PERSON.username ?? null, avatar: `${SITE_URL}${LOOPZ_PERSON.avatar_url}` }
            : pub
              ? { name: pub.owner_nickname ?? pub.owner_username ?? "", username: pub.owner_username, avatar: pub.owner_avatar }
              : null,
        items: rows.map((r) => ({ kind: r.media_type, id: r.tmdb_id, title: r.title ?? "", poster_path: r.poster_path, badge: badges.get(`${r.media_type}-${r.tmdb_id}`) ?? null })),
        saves: st?.saves ?? 0,
        reviews: st?.reviews ?? 0,
        rating: st?.rating ?? null,
        can_save: !!uid && !mine && data.list.is_public,
        saved_by_me: !!mySave?.saved,
        can_review: !!uid && !mine && data.list.is_public,
        review_rows: reviews.slice(0, 30).map((r) => {
          const soc = social.get(listReviewKey(id, r.userId));
          return {
            user_id: r.userId,
            name: displayNameOf({ nickname: r.nickname, username: r.username, hide_name: r.hideName }, t.anonymousUser),
            username: r.hideName ? null : r.username,
            avatar_url: r.hideName ? null : r.avatarUrl,
            rating: r.rating,
            review: r.body,
            has_spoiler: r.hasSpoiler,
            updated_at: r.updatedAt,
            likes: soc?.likes ?? 0,
            replies: soc?.replies ?? 0,
            mine: !!uid && r.userId === uid,
            liked_by_me: !!soc?.likedByMe,
          };
        }),
        reply_rows: replies.slice(0, 200).map((r) => ({
          reply_id: r.replyId,
          review_user_id: r.reviewUserId,
          parent_id: r.parentId,
          name: displayNameOf(r, t.anonymousUser),
          username: r.hide_name ? null : r.username,
          avatar_url: r.hide_name ? null : r.avatar_url,
          body: r.body,
          created_at: r.createdAt,
          mine: r.isMine,
        })),
        playlist: mine ? !!data.list.is_playlist : mySave?.saved ? !!mySave.playlist : null,
        cover: mine ? { tmdb_id: data.list.cover_tmdb_id ?? null, media_type: (data.list.cover_media_type as "tv" | "movie" | null) ?? null, backdrop_path: data.list.cover_backdrop ?? null } : null,
        my_review: myReview ? { rating: myReview.rating, body: myReview.body ?? null, has_spoiler: !!myReview.hasSpoiler } : null,
      };
      return ok(payload, [listTag(id), "me:lists"]);
    },
    { cacheControl: "private, no-store" },
  );
}
