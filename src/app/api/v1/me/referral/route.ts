import type { NextRequest } from "next/server";
import { handle, limited, requireUser, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { createClient } from "@/lib/supabase/server";
import { codeForUsername, inviterById, ownerOfCode, referralState } from "@/lib/referral";
import { cleanInviteCode } from "@/core/storeLinks";
import type { ClaimReferralBody, ClaimReferralPayload, MyReferralPayload } from "@/core/contracts/referral";

/**
 * 🆕 `/api/v1/me/referral` — **نسبةُ الحساب الجديد إلى داعيه من التطبيق** (المهمة ٣٧٠، قرارُ أحمد ١٠ نوفمبر «1ب … نفذ أ»).
 *
 * 🔴 كانت النسبةُ في ردهة دخول الويب وحدَها، فلا دعوةَ نُسبت لعضوٍ سجّل من التطبيق قطّ (صفرُ صفوفٍ في `referrals` حتّى اليوم).
 * **`open`**: يُنادى من الخطوة الأولى في الترحيب قبل ختمه — وهو الموضعُ الوحيد الممكن، لأنّ `claim_referral` ترفض حساباً
 * تابع عملاً واحداً، والأعمالُ تُكتب في آخر ضغطةٍ من الترحيب.
 *
 * - `GET`: هل يقبل حسابي نسبةً الآن، ومن نُسبتُ إليه إن وُجد.
 * - `POST {code}` (زرُّ الصفحة) أو `POST {username}` (البحثُ بالاسم): النسبةُ بجلسة المدعوّ نفسِه — **والحرّاسُ في جسم الدالّة**.
 */
export async function GET() {
  return handle<MyReferralPayload>(
    async () => {
      const auth = await requireUser();
      if (!auth.ok) return auth;
      const lim = limited(`v1:referral:${auth.user.id}`, 30, 60_000);
      if (lim) return lim;
      const st = await referralState(auth.user.id, auth.user.created_at);
      return ok({ eligible: st.eligible, inviter: st.inviterId ? await inviterById(st.inviterId) : null });
    },
    { open: true },
  );
}

export async function POST(req: NextRequest) {
  return handle<ClaimReferralPayload>(
    async () => {
      const auth = await requireUser();
      if (!auth.ok) return auth;
      /* البحثُ بالاسم يولّد كوداً لمن لا كودَ له — حدٌّ ضيّقٌ كي لا يصير مولّداً لأكواد الأعضاء */
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

      let code = cleanInviteCode(body?.code);
      let ownerId: string | null = null;
      let source: "friend" | "partner" | null = null;
      if (code) {
        const owner = await ownerOfCode(code);
        ownerId = owner?.userId ?? null;
        source = owner?.source ?? null;
      } else if (typeof body?.username === "string" && body.username.trim()) {
        const hit = await codeForUsername(body.username);
        if (hit) {
          code = hit.code;
          ownerId = hit.userId;
          source = hit.source;
        }
      } else {
        return fail("invalid_input");
      }
      if (!code || !ownerId) return ok({ claimed: false, inviter: null, source: null, reason: "unknown" });
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
