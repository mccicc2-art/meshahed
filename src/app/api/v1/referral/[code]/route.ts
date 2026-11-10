import { headers } from "next/headers";
import { handle, limited } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { inviterById, ownerOfCode } from "@/lib/referral";
import type { ReferralPreviewPayload } from "@/core/contracts/referral";

/**
 * 🆕 `GET /api/v1/referral/{code}` — **من صاحبُ هذا الكود؟** (المهمة ٣٧٠). يرسم به التطبيقُ «هل دعاك أحمد؟» حين يُفتح من زرّ
 * «افتح الدعوة في التطبيق» — قبل الدخول أحياناً، فهو عامٌّ (`open`) بلا هويّة. **لا يكشف إلّا ما يكشفه رابطُ الدعوة نفسُه**:
 * صفحةُ `/invite/{code}` تعرض الوجهَ ذاتَه لكلِّ من فتحها، ومن أخفى اسمَه لا يُرسَل اسمُه.
 * ⚖️ حدٌّ لكلِّ عنوان: الكودُ ثمانيةُ أحرفٍ من ٣٢ — التخمينُ بلا حدٍّ قائمةُ أعضاء.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  return handle<ReferralPreviewPayload>(
    async () => {
      const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
      const lim = limited(`v1:refpreview:${ip}`, 20, 60_000);
      if (lim) return lim;
      const { code } = await params;
      const owner = await ownerOfCode(code);
      if (!owner) return ok({ inviter: null, source: null });
      return ok({ inviter: await inviterById(owner.userId), source: owner.source });
    },
    { open: true },
  );
}
