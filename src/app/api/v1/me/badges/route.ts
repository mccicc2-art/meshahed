import { after } from "next/server";
import { runEpisodePush } from "@/lib/push";
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
    /* 🆕 D-1305 — «حلقةٌ جديدة اليوم» بحركة المرور (نمطُ D-210، بلا cron): هذا أكثرُ مسارٍ يُسأل من التطبيق، والدورةُ
       تحرس نفسَها (عشرُ دقائق في الذاكرة ثمّ نافذةُ ساعتين في القاعدة) — فأغلبُ النداءات مقارنةُ رقمين */
    after(() => runEpisodePush().then(() => undefined).catch(() => undefined));
    return ok({ messages, signals });
  });
}
