import { setDmPolicy } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import { sanitizeDmPolicy } from "@/core/dmPolicy";
import type { DmPolicyBody } from "@/core/contracts/settings";

/**
 * 🆕 D-1380 — `POST /api/v1/me/settings/messages`: «من يقدر يراسلني» (الكلّ · المتبادلون · لا أحد). كتابةُ عمودٍ واحد
 * (`dm_policy`، الهجرة ٢٠٠)؛ القيمةُ الغريبة تسقط إلى الافتراضيّ في `sanitizeDmPolicy` قبل الرحلة.
 */
export const POST = bodyRoute<DmPolicyBody, DmPolicyBody>(
  async (b) => ({ dm_policy: await setDmPolicy(sanitizeDmPolicy(b.dm_policy)) }),
  () => ["user:me:profile"],
);
