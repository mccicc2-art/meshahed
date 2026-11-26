import type { NextRequest } from "next/server";
import { handle, limited, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { GET as shareImage } from "@/app/api/share/route";
import { asHistoryPeriod, parseHide } from "@/lib/historyShare";

/* صورةُ البطاقة تُرسم بـ`ImageResponse` وتقرأ خطوطَها من القرص — كمسارها الأصل */
export const runtime = "nodejs";

/**
 * `GET /api/v1/me/history-card/image?p=week|month&hide=tv-1,movie-2` — 🆕 صورةُ بطاقة سجلّ المشاهدة للتطبيق («ن٥ ب»).
 * **الراسمُ راسمُ الويب نفسُه** (`/api/share?kind=history`) — بابُه للتطبيق لا نسخةٌ منه، كـ`/me/report/image`. الردُّ ملفٌّ خامّ
 * يكتبه التطبيقُ على القرص ويسلّمه لورقة المشاركة.
 */
export async function GET(req: NextRequest) {
  const gate = await handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const lim = limited(`v1:history-image:${auth.user.id}`, 8, 60_000);
    if (lim) return lim;
    return ok({ done: true });
  });
  if (!gate.ok) return gate;
  const target = new URL("/api/share", req.url);
  target.searchParams.set("kind", "history");
  target.searchParams.set("p", asHistoryPeriod(req.nextUrl.searchParams.get("p")));
  const hide = [...parseHide(req.nextUrl.searchParams.get("hide"))];
  if (hide.length) target.searchParams.set("hide", hide.join(","));
  return shareImage(new Request(target));
}
