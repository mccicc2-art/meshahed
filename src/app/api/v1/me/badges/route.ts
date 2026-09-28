import { getUnreadShares, getUnreadSignals } from "@/lib/data";
import { handle, limited, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import type { BadgesPayload } from "@/core/contracts/messages";

/**
 * `GET /api/v1/me/badges` — شارتا الظرف والجرس وحدَهما (M4-fix2). **الرئيسيّةُ تُرسم من كاشها المحفوظ فوراً**، وحمولتُها
 * الكاملةُ ثقيلةٌ تصل بعد ثوانٍ — فالشارةُ القديمةُ تبقى أمام العين حتى تصل (تسجيلُ أحمد: «التنبيه ما ظهر إلا بعد ما دخلت
 * على الرسائل»). هذا رقمان من دالّتَي العدّ نفسِهما (`unread_shares` · `unread_signals`) — أخفُّ طلبٍ يُسأل بعد الرمز
 * مباشرةً وعند كلِّ عودةٍ من الخلفيّة.
 */
export async function GET() {
  return handle<BadgesPayload>(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const lim = limited(`v1:badges:${auth.user.id}`, 30, 60_000);
    if (lim) return lim;
    const [messages, signals] = await Promise.all([getUnreadShares(), getUnreadSignals()]);
    return ok({ messages, signals });
  });
}
