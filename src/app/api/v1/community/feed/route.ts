import type { NextRequest } from "next/server";
import { getUser } from "@/lib/data";
import { getT, getFeedStrangers, getTranslateEnabled } from "@/lib/locale";
import { buildFeedPage } from "@/lib/communityCore";
import { feedRows } from "@/lib/communityPayload";
import { vividizeFeed } from "@/lib/vividPoster";
import { handle, limited, fail, personasAware } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import type { CommunityFeedPagePayload } from "@/core/contracts/community";

/** 🆕 D-1596 — حجمُ الصفحة (أحمد «١ أ»: ٣٠) */
const PAGE = 30;

/**
 * `GET /api/v1/community/feed?before=<ISO>` — 🆕 D-1596 (المرحلة الثانية): **صفحةٌ أقدم من نشاط المجتمع**. التطبيقُ يطلبها حين
 * يقترب قاعُ الخطّ، و`before` أقدمُ رأيٍ وصله. الصفوفُ بشكل `feed.rows` حرفاً (`feedRows`) والمرشِّحُ نفسُه («الغرباء» من كوكي
 * صاحبه — الشريحةُ التي على شاشته)، بالأحدث. مفتوحٌ للزائر كالمجتمع (D-627). قبل تشغيل الهجرة ٢٢٧ تعود الدالّةُ بخطأ فيُقرأ
 * «انتهى» (`next_before: null`) — لا شاشةَ خطأ ولا صفٌّ مكسور.
 */
export async function GET(req: NextRequest) {
  return handle<CommunityFeedPagePayload>(async () => {
    const user = await getUser();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
    const lim = limited(`v1:community-feed:${user?.id ?? ip}`, 60, 60_000);
    if (lim) return lim;
    const before = req.nextUrl.searchParams.get("before") ?? "";
    if (!before || Number.isNaN(Date.parse(before))) return fail("invalid_input");

    const { locale, t } = await getT();
    const [showStrangers, translateOn, personas] = await Promise.all([getFeedStrangers(), getTranslateEnabled(), personasAware()]);
    /* 🆕 D-1605 — والصفحاتُ الأقدمُ تحمل مراجعاتِ الشخصيّات المتابَعة بالحدّ نفسِه */
    const page = await buildFeedPage({ user, locale, before: new Date(before).toISOString(), limit: PAGE, translateOn, personas });
    const rows = feedRows(page.core, { meId: user?.id ?? "", showStrangers, sort: "latest", t, locale });
    await vividizeFeed(rows, locale === "en" ? "en" : "ar");
    return ok({ rows, next_before: page.next_before });
  });
}
