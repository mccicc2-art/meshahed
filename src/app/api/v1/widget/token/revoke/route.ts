import { type NextRequest } from "next/server";
import { handle, limited, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { revokeWidgetToken } from "@/lib/widgetToken";

/**
 * `POST /api/v1/widget/token/revoke` — 🆕 A-05: التطبيقُ يناديه عند الخروج **برمز الودجت نفسِه** (`Authorization: Bearer lw_…`)
 * قبل أن يمحو ملفَّه، فلا يبقى رمزٌ حيٌّ على الخادم لجهازٍ خرج صاحبُه. **`open`**: لا جلسةَ بعد الخروج، والرمزُ يثبت نفسَه
 * ولا يُلغي غيرَه. `not_found` = لم يكن حيّاً أصلاً (التطبيقُ لا يفرّق — يمحو ملفَّه في الحالين).
 */
export async function POST(req: NextRequest) {
  return handle(
    async () => {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      const rl = limited(`wrevoke:${ip}`, 20, 60 * 60_000);
      if (rl) return rl;
      const done = await revokeWidgetToken(req.headers.get("authorization"));
      if (!done) return fail("not_found");
      return ok({ done: true as const });
    },
    { open: true },
  );
}
