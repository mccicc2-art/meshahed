import type { NextRequest } from "next/server";
import { handle, limited, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { getLocale } from "@/lib/locale";
import { getProfile } from "@/lib/data";
import { asTimeZone } from "@/core/zone";
import { asHistoryPeriod, cardArt, historyTitles } from "@/lib/historyShare";
import type { HistoryCardPayload } from "@/core/contracts/profile";

/**
 * `GET /api/v1/me/history-card?p=week|month` — 🆕 أعمالُ بطاقة سجلّ المشاهدة قبل مشاركتها («٣أ»: يُخفي العضوُ ما لا يريده).
 * الترتيبُ ترتيبُ البطاقة نفسُه (الأكثرُ دقائقَ أوّلاً — الأوّلُ بطلُها)، والاسمُ بقاعدة لوبز كما سيُرسم.
 */
export async function GET(req: NextRequest) {
  return handle<HistoryCardPayload>(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const lim = limited(`v1:history-card:${auth.user.id}`, 20, 60_000);
    if (lim) return lim;
    const period = asHistoryPeriod(req.nextUrl.searchParams.get("p"));
    const profile = await getProfile();
    const { range, titles } = await historyTitles(period, await getLocale(), asTimeZone(profile?.timezone));
    /* الاسمُ كما سيُرسم للأوائل وحدَهم (نداءُ TMDB مخبّأ) — والباقي باسم المكتبة */
    const art = await Promise.all(titles.slice(0, 8).map(cardArt));
    return ok({
      period,
      range,
      titles: titles.map((x, i) => ({
        key: x.key,
        kind: x.mediaType,
        id: x.tmdbId,
        title: art[i]?.title ?? x.title,
        poster_path: art[i]?.poster ?? x.poster,
        episodes: x.episodes,
      })),
    });
  });
}
