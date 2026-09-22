import type { NextRequest } from "next/server";
import { getUserId } from "@/lib/data";
import { handle, limited } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { asScope, runSearch } from "@/lib/searchCore";
import type { SearchPayload } from "@/core/contracts/search";

/**
 * `GET /api/v1/search?q&type` — البحثُ للتطبيق الأصليّ (Phase 11-G · G0).
 *
 * 🔑 **النواةُ نواةُ `/api/search` نفسُها** (`lib/searchCore.ts`): السقوفُ والترتيبُ
 * والكتابةُ الصوتيّةُ وحقولُ `more` — حرفاً بحرف؛ الفرقُ غلافُ `{data}` وأخطاءُ
 * `v1` بمفتاحها (القاعدة ٥) بدل ردٍّ فارغٍ برمز 429.
 *
 * 🔑 **مفتوحٌ للزائر كالويب** (D-627): لا سرَّ في كتالوجٍ وملفّاتٍ عامّة؛ والحدُّ
 * ٤٠/دقيقة بالهويّة أو العنوان — الرقمُ نفسُه، فالتطبيقُ يبحث مع كلِّ ضغطةٍ بعد
 * الحرف الثاني كالويب (debounce ٣٠٠ في الطرفين).
 */
export async function GET(req: NextRequest) {
  return handle<SearchPayload>(async () => {
    const uid = await getUserId();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
    const lim = limited(`search:${uid ?? ip}`, 40, 60_000);
    if (lim) return lim;

    const url = new URL(req.url);
    const payload = await runSearch(url.searchParams.get("q") ?? "", asScope(url.searchParams.get("type")));
    return ok(payload);
  }, { cacheControl: "private, max-age=60" });
}
