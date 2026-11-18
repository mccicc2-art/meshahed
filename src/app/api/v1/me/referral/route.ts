import type { NextRequest } from "next/server";
import { handle, limited, requireUser, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { createClient } from "@/lib/supabase/server";
import { inviterById, ownerOfCode, referralState } from "@/lib/referral";
import { cleanInviteCode } from "@/core/storeLinks";
import { isLoopz } from "@/core/loopz";
import type { ClaimReferralBody, ClaimReferralPayload, MyReferralPayload, ReferralSource } from "@/core/contracts/referral";

/**
 * 🆕 `/api/v1/me/referral` — **نسبةُ الحساب الجديد إلى داعيه من التطبيق** (المهمة ٣٧٠، قرارُ أحمد ١٠ نوفمبر «1ب … نفذ أ»).
 *
 * 🔴 كانت النسبةُ في ردهة دخول الويب وحدَها، فلا دعوةَ نُسبت لعضوٍ سجّل من التطبيق قطّ (صفرُ صفوفٍ في `referrals` حتّى اليوم).
 * **`open`**: يُنادى من الخطوة الأولى في الترحيب قبل ختمه — وهو الموضعُ الوحيد الممكن، لأنّ `claim_referral` ترفض حساباً
 * تابع عملاً واحداً، والأعمالُ تُكتب في آخر ضغطةٍ من الترحيب.
 *
 * - `GET`: هل يقبل حسابي نسبةً الآن، ومن نُسبتُ إليه إن وُجد.
 * - `POST {code}`: النسبةُ بجلسة المدعوّ نفسِه — **والحرّاسُ في جسم الدالّة**. الكودُ من زرّ «افتح Loopz»، أو 🆕 ملصوقاً من الحافظة
 *   (المهمة ٤٢٨)، أو مكتوباً بيده.
 * 🗑️ المهمة ٤٢٨ — **`POST {username}` (النسبةُ باختيار الاسم) أُغلق** (قرارُ أحمد ١٨ نوفمبر «اذا خليته يختار الشخص يسير فيه تلاعب»):
 *   الاسمُ ليس دليلَ دعوة. والطلبُ القديمُ (نسخُ تطبيقٍ لم يصلها التحديث) يُجاب `unknown` فتقول شاشتُه «لا يمكن نسبة دعوتك».
 */
export async function GET() {
  return handle<MyReferralPayload>(
    async () => {
      const auth = await requireUser();
      if (!auth.ok) return auth;
      const lim = limited(`v1:referral:${auth.user.id}`, 30, 60_000);
      if (lim) return lim;
      const st = await referralState(auth.user.id, auth.user.created_at);
      /* 🆕 المهمة ٣٩٤ — من نُسب إلى الحملة (الحساب الرسميّ) لا يُرسم له «دعاك Loopz»: الحملةُ عدٌّ لا داعٍ */
      const inviter = st.inviterId && !isLoopz(st.inviterId) ? await inviterById(st.inviterId) : null;
      return ok({ eligible: st.eligible, inviter });
    },
    { open: true },
  );
}

export async function POST(req: NextRequest) {
  return handle<ClaimReferralPayload>(
    async () => {
      const auth = await requireUser();
      if (!auth.ok) return auth;
      /* حدٌّ ضيّق: ستُّ محاولاتٍ في الدقيقة تكفي من يكتب كودَه بيده، ولا تكفي من يجرّب الأكوادَ تخميناً */
      const lim = limited(`v1:referral-claim:${auth.user.id}`, 6, 60_000);
      if (lim) return lim;
      let body: ClaimReferralBody;
      try {
        body = (await req.json()) as ClaimReferralBody;
      } catch {
        return fail("invalid_input");
      }
      const st = await referralState(auth.user.id, auth.user.created_at);
      if (!st.eligible) return ok({ claimed: false, inviter: st.inviterId ? await inviterById(st.inviterId) : null, source: null, reason: "ineligible" });

      const code = cleanInviteCode(body?.code);
      /* طلبُ الاسم القديم — جوابٌ دائمٌ لا خطأ، كي لا تقول الشاشةُ القديمة «حاول مجدداً» */
      if (!code) return typeof (body as { username?: unknown })?.username === "string" ? ok({ claimed: false, inviter: null, source: null, reason: "unknown" }) : fail("invalid_input");
      const owner = await ownerOfCode(code);
      const ownerId: string | null = owner?.userId ?? null;
      const source: ReferralSource | null = owner?.source ?? null;
      if (!ownerId) return ok({ claimed: false, inviter: null, source: null, reason: "unknown" });
      if (ownerId === auth.user.id) return ok({ claimed: false, inviter: null, source: null, reason: "self" });

      const supabase = await createClient();
      const { data, error } = await supabase.rpc("claim_referral", { ref_code: code });
      if (error) throw new Error(error.message);
      return data === true
        ? ok({ claimed: true, inviter: await inviterById(ownerId), source })
        : ok({ claimed: false, inviter: null, source: null, reason: "refused" });
    },
    { open: true },
  );
}
