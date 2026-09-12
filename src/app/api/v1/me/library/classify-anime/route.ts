import { classifyMyFollows } from "@/lib/actions";
import { handle, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";

/**
 * `POST /api/v1/me/library/classify-anime` — تصنيفُ ما لم يُصنَّف (D-182).
 * الويبُ يطلقه من المتصفّح عند أوّل فتحٍ لتبويب «أنمي»؛ الشاشةُ الأصليّة
 * تفعل الشيءَ نفسَه من هنا (يسدّ KNOWN_GAP-12). الحدُّ داخل الفعل (٦/دقيقة).
 */
export async function POST() {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const n = await classifyMyFollows();
    return ok({ classified: n }, n > 0 ? ["me:library"] : []);
  });
}
