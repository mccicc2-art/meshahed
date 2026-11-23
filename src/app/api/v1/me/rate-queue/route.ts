import type { NextRequest } from "next/server";
import { handle, limited, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { getLocale } from "@/lib/locale";
import { getRateQueue } from "@/lib/rateQueue";
import type { RateQueuePayload } from "@/core/rateQueue";

/**
 * `GET /api/v1/me/rate-queue` — 🆕 T530 «بانتظار تقييمك»: ما شاهدتَه ولم تقيّمه، الأحدثُ مشاهدةً أوّلاً.
 * `?summary=1` لبطاقة الرئيسيّة وسطرَي «تقييماتي» والمكتبة: العددُ وأوّلُ ثلاثة (لا ترجمةَ لكلِّ اسم).
 */
export async function GET(req: NextRequest) {
  return handle<RateQueuePayload>(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const lim = limited(`v1:rate-queue:${auth.user.id}`, 60, 60_000);
    if (lim) return lim;
    const summary = req.nextUrl.searchParams.get("summary") === "1";
    const out = await getRateQueue(await getLocale(), { summary });
    return ok(out ?? { items: [], total: 0, movies: 0, shows: 0, card: false });
  });
}
