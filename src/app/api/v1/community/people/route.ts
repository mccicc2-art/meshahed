import type { NextRequest } from "next/server";
import { getUser } from "@/lib/data";
import { getT } from "@/lib/locale";
import { boardRows } from "@/core/communityFeed";
import { BOARD_ALL, asBoardSection } from "@/core/communityParams";
import { buildCommunity } from "@/lib/communityCore";
import { listOut } from "@/lib/communityPayload";
import { handle, limited, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import type { CommunityPeopleAllPayload } from "@/core/contracts/community";

/**
 * `GET /api/v1/community/people?all=<featured|top|rising|reviews|lists>` — «عرض الكل» (D-264).
 *
 * 🔑 **لا يُدفع إلا نداءُ القسم المفتوح** (D-194) — `buildCommunity` بـ`allView` كالصفحة، وحوضُ
 * الصاعدين خمسون (D-311). والصفوفُ المخفيّةُ لا تسري هنا (D-827: من فتح «عرض الكل» يريده).
 * ⚠️ **وخلافاً للصفحة، القسمُ المجهولُ `invalid_input`** لا اللوحة: الصفحةُ تُكتب بيد وتسقط
 * إلى ما يُرسم، والبابُ يطلبه تطبيقٌ يعرف أقسامه — فخطأٌ ظاهرٌ خيرٌ من ردٍّ لا يطابق ما طُلب.
 */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const section = asBoardSection(req.nextUrl.searchParams.get("all"));
    if (!section) return fail("invalid_input", { field: "all" });
    const user = await getUser();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
    const lim = limited(`v1:community:people:${user?.id ?? ip}`, 30, 60_000);
    if (lim) return lim;

    const { locale } = await getT();
    const core = await buildCommunity({
      user,
      locale,
      scope: "all",
      allView: section,
      translateOn: false,
      talkFollowedOnly: false,
    });

    const leaders =
      section === "featured"
        ? boardRows(core.featured, "featured", BOARD_ALL)
        : section === "top" || section === "rising"
          ? boardRows(core.board, section, BOARD_ALL)
          : null;
    const payload: CommunityPeopleAllPayload = {
      section,
      leaders,
      reviews: section === "reviews" ? core.topReviews : null,
      lists: section === "lists" ? core.savedLists.map((c) => listOut(c, locale)) : null,
      empty: core.peopleEmpty,
      following_ids: [...core.boardFollowing],
      me_id: user?.id ?? null,
    };
    return ok(payload);
  });
}
