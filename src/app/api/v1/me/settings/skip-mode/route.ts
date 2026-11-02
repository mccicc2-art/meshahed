import { setSkipMode } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import type { SkipModeBody } from "@/core/contracts/settings";

/**
 * `POST /api/v1/me/settings/skip-mode` — «إخفاء الفلر» و«المسار الذهبي» للحساب (D-1623). الفعلُ نفسُه الذي يكتبه الويب
 * (`setSkipMode`)، والقيمةُ تُنقّى هناك. **الإبطالُ يشمل كلَّ ما يعدّ الحلقات**: الرئيسيّة (والودجتُ منها) والمكتبة.
 */
export const POST = bodyRoute<SkipModeBody, { mode: string }>(
  (b) => setSkipMode(String(b.mode)),
  () => ["home", "me:library"],
);
