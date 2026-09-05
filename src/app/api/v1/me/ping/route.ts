import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { platformFromUA } from "@/core/platform";
import { handle, limited, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";

/**
 * `POST /api/v1/me/ping` — نبضةُ حضور التطبيق (D-917).
 *
 * 🔴 **العلّة**: `GET /me` يدقّ مرّةً عند الإقلاع فيقول «فُتح التطبيق» ولا
 * يقول «كم جلس». ولوحةُ المختبِرين تسأل الثانية. فهذه أختُ `PresencePing`
 * في الويب (D-765): التطبيقُ يدقّها كلَّ أربع دقائق ما دام في المقدّمة،
 * **والقاعدةُ تخنقها كلَّ ثلاث** (`touch_presence`، الهجرة ١٨٢) — فأسوأُ
 * الحالات صفٌّ يوميٌّ يزيد ضربةً كلَّ ثلاث دقائق.
 *
 * **لا بياناتَ في الردّ**: الوسومُ فارغةٌ والفشلُ صمتٌ في العميل.
 */
export async function POST() {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    // نبضةٌ كلَّ أربع دقائق لا تحتاج أكثر من هذا — والزائدُ عبثٌ لا حضور
    const lim = limited(`ping:${auth.user.id}`, 6, 60_000);
    if (lim) return lim;
    const ua = (await headers()).get("user-agent");
    try {
      const supabase = await createClient();
      await supabase.rpc("touch_presence", { p_platform: platformFromUA(ua), p_is_app: true });
    } catch {
      /* إحصاءٌ لا يكسر شيئاً */
    }
    return ok({ done: true as const });
  });
}
