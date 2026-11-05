import "server-only";
import { getProfile } from "@/lib/data";
import { mayLinkDevice, mayLinkUnbound } from "@/lib/linkTokens";
import { fail } from "@/lib/v1";
import { isPlus } from "@/core/plan";
import type { Err } from "@/core/contracts/result";
import type { DeviceKind } from "@/core/deviceLinks";

/**
 * 🆕 **حارسُ الإصدار** (هجرة ٢٣٧) — بابٌ واحدٌ تسأله أبوابُ الربط الثلاثة (Stremio · سيرفرات البيت · رمزُ Kodi) وصفحةُ الويب.
 * - في الخانات متّسَع (أو هو استبدالٌ لجهازٍ مربوط) ⇐ يُصدر.
 * - لا متّسَع ⇐ `conflict` بمفتاح `apiLinkSlotsFull`: التطبيقُ الجديد يعرض «خانتك ممتلئة»؛ والقديمُ (1.13.x) لا يصل هنا أصلاً
 *   للمجانيّ (شاشتُه تعرض الاشتراك)، فلا يرى رمزاً لا يعرفه.
 * - قبل الهجرة ⇐ الحكمُ القديم بحرفه: بلس وحده (`forbidden`).
 */
export async function linkGate(userId: string, kind: DeviceKind | "unbound"): Promise<Err | null> {
  /* `unbound` — رابطُ تطبيق 1.13.x لسيرفرات البيت بلا نوع */
  const may = kind === "unbound" ? await mayLinkUnbound(userId) : await mayLinkDevice(userId, kind);
  if (may === true) return null;
  if (may === null) return isPlus(await getProfile()) ? null : fail("forbidden");
  return fail("conflict", { message_key: "apiLinkSlotsFull" });
}
