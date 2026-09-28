import type { NextRequest } from "next/server";
import { getUser } from "@/lib/data";
import {
  getT,
  getTabPrefs,
  getFeedStrangers,
  getFeedSort,
  getTalkFollowedOnly,
  getTranslateEnabled,
  getHiddenRails,
} from "@/lib/locale";
import { applyTabPrefs, defaultTab } from "@/core/tabPrefs";
import { railsHiddenFor, railOff } from "@/core/railPrefs";
import { boardRows } from "@/core/communityFeed";
import { BOARD_PREVIEW, COMMUNITY_PAGER_TABS, asCommunityTab, type CommunityPagerTab } from "@/core/communityParams";
import { buildCommunity, refreshCommunityAfter } from "@/lib/communityCore";
import { feedRows, roomOut, listOut, followsLoopz } from "@/lib/communityPayload";
import { handle, limited } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import type { CommunityPayload } from "@/core/contracts/community";

/**
 * `GET /api/v1/community` — «المجتمع» بتبويباته الثلاثة للتطبيق (Phase 11-M · M0).
 *
 * 🔑 **ما تقرؤه `/people` حرفاً** (`lib/communityCore.ts`) — والتفضيلاتُ من كوكيزها نفسِها
 * (جرّةُ الكوكي مشتركةٌ بين `fetch` والـWebView في أندرويد، D-997)، فورقةُ الأدوات في الويب
 * وفي التطبيق تقرأ قيمةً واحدة.
 * 🔑 **مفتوحٌ للزائر** (D-627) كالصفحة: `me_id` فارغ، والخطُّ «الأفضل» (D-629)، وخمسُ غرفٍ (D-628).
 * `?scope=following` للعضو وحدَه (D-628).
 */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await getUser();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
    const lim = limited(`v1:community:${user?.id ?? ip}`, 30, 60_000);
    if (lim) return lim;

    const { locale, t } = await getT();
    const [tabPrefs, hiddenAll, showStrangers, feedSort, talkFollowedOnly, translateOn] = await Promise.all([
      getTabPrefs("community"),
      getHiddenRails(),
      getFeedStrangers(),
      getFeedSort(),
      getTalkFollowedOnly(),
      getTranslateEnabled(),
    ]);
    const scope: "all" | "following" =
      user && req.nextUrl.searchParams.get("scope") === "following" ? "following" : "all";

    const core = await buildCommunity({ user, locale, scope, allView: null, translateOn, talkFollowedOnly });
    await refreshCommunityAfter(true);

    /* التبويبُ الأوّلُ بترتيب صاحبه (جوابُ أحمد ٢٨ سبتمبر: `defaultTab(tabPrefs, "activity")`) */
    const initial = asCommunityTab(defaultTab(tabPrefs, "activity")) as CommunityPagerTab;
    const visible = applyTabPrefs(
      COMMUNITY_PAGER_TABS.map((key) => ({ key })),
      tabPrefs,
      initial,
    ).map((x) => x.key);

    const hiddenRails = railsHiddenFor(hiddenAll, "community");
    const off = (k: Parameters<typeof railOff>[1]) => railOff(hiddenRails, k);
    const meId = user?.id ?? "";
    const sort = user ? feedSort : "top";

    const payload: CommunityPayload = {
      viewer: { signed_in: !!user, me_id: user?.id ?? null, admin: core.amAdmin },
      tabs: { visible, initial: (COMMUNITY_PAGER_TABS as readonly string[]).includes(initial) ? initial : "activity" },
      prefs: user
        ? {
            strangers: showStrangers,
            sort: feedSort,
            talk_followed: talkFollowedOnly,
            translate: translateOn,
            tabs: tabPrefs,
            hidden_rails: [...hiddenAll],
          }
        : null,
      feed: {
        rows: feedRows(core, { meId, showStrangers, sort, t, locale }),
        sort,
        empty_text: t.feedEmptyForYou,
        follow_loopz: followsLoopz(core),
      },
      rooms: core.roomsShown.map((r) => roomOut(core, r, t, locale)),
      board: {
        featured: off("featured") ? null : boardRows(core.featured, "featured", BOARD_PREVIEW),
        top: off("topweek") ? null : boardRows(core.board, "top", BOARD_PREVIEW),
        reviews: off("topreviews") ? null : core.topReviews,
        talked_about: off("talked") || !core.talkedAbout ? null : roomOut(core, core.talkedAbout, t, locale),
        lists: off("savedlists") ? null : core.savedLists.map((c) => listOut(c, locale)),
        rising: off("rising") ? null : boardRows(core.board, "rising", BOARD_PREVIEW),
        empty: core.peopleEmpty,
      },
      following_ids: [...core.boardFollowing],
    };
    return ok(payload);
  });
}
