import type { NextRequest } from "next/server";
import { getCinema } from "@/lib/cinemaTitles";
import { handle, limited } from "@/lib/v1";
import { routeName } from "@/lib/reqTrace";
import { ok } from "@/core/contracts/result";
import type { CinemaPayload } from "@/core/contracts/discover";

/**
 * `GET /api/v1/cinema` — قسمُ السينما للشاشة الأصليّة (T512): الرئيسيّةُ و«اكتشف ← أفلام» تقرآن الردَّ نفسَه.
 * **الحالتان معاً** (يُعرض الآن · قريباً) فتبديلُ القائمة لا ينتظر نداءً. **مفتوحٌ للضيف** كـ«اكتشف»؛ الحدُّ بعنوان
 * الشبكة. ⚠️ **`private`**: الأسماءُ بلغة القارئ (`Accept-Language` · الكوكي)، فلا يُخزَّن ردٌّ لقارئٍ عند آخر.
 */
export async function GET(req: NextRequest) {
  return handle(
    async () => {
      routeName("cinema");
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
      const lim = limited(`v1:cinema:${ip}`, 60, 60_000);
      if (lim) return lim;
      const payload: CinemaPayload = await getCinema();
      return ok(payload);
    },
    { cacheControl: "private, max-age=600" },
  );
}
