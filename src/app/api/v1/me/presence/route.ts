import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { platformFromUA } from "@/core/platform";
import { handle, limited, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";

/**
 * `POST /api/v1/me/presence` — نبضةُ حضور التطبيق الأصليّ (D-1307).
 *
 * الويبُ يدقّ بـ`PresencePing` كلَّ أربع دقائق؛ والتطبيقُ كان يكتب حضورَه مرّةً عند الإقلاع (`GET /api/v1/me`) ثمّ يصمت —
 * فمن بقي فيه ساعةً يكتب ظهر لصاحبه «آخر ظهور قبل ساعة» (بلاغُ خالد، ٦ أكتوبر: هو نفسُه مسجَّلٌ «قبل ١٢ دقيقة» وهو يكتب).
 * بابٌ خفيفٌ لا `GET /me` كاملاً: النبضةُ لا تحتاج الملفَّ ولا تستحقّ قراءتَه كلَّ أربع دقائق.
 * `is_app` ثابتةٌ كما في `/me` (الويبُ لا يمرّ من هنا)، والمنصّةُ من ترويسة الطلب لا من جسمه (D-666). فشلُ الكتابة صمت.
 */
export async function POST() {
  return handle<{ ok: true }>(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const lim = limited(`v1:presence:${auth.user.id}`, 5, 60_000);
    if (lim) return lim;
    try {
      const ua = (await headers()).get("user-agent");
      const supabase = await createClient();
      await supabase.rpc("touch_presence", { p_platform: platformFromUA(ua), p_is_app: true });
    } catch {
      /* لا شيء */
    }
    return ok({ ok: true });
  });
}
