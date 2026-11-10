import type { NextRequest } from "next/server";
import { handle, limited, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { searchPeople } from "@/lib/data";
import { isLoopz } from "@/core/loopz";
import { isPersonaId } from "@/core/personas";
import { isVerified } from "@/core/plan";
import type { ReferralPeoplePayload } from "@/core/contracts/referral";

/**
 * 🆕 `GET /api/v1/me/referral/people?q=` — **«هل دعاك أحد؟» بالاسم** (المهمة ٣٧٠): لمن ذهب إلى المتجر مباشرةً ولم يرجع إلى
 * صفحة الدعوة (iPhone لا يمرّر مصدرَ التثبيت). بحثُ الأعضاء نفسُه (`search_people`، يستبعد الموقوف) — بلا نفسي، وبلا الحساب الرسميّ
 * وشخصيّات Loopz AI، وبلا
 * من أخفى اسمَه (لا وجهَ يُختار). `open`: يُنادى من الخطوة الأولى في الترحيب.
 */
export async function GET(req: NextRequest) {
  return handle<ReferralPeoplePayload>(
    async () => {
      const auth = await requireUser();
      if (!auth.ok) return auth;
      const lim = limited(`v1:referral-people:${auth.user.id}`, 30, 60_000);
      if (lim) return lim;
      const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 40);
      const rows = await searchPeople(q);
      const people = rows
        .filter((p) => p.id !== auth.user.id && !isLoopz(p.id) && !isPersonaId(p.id) && !p.hide_name && !!p.username)
        .slice(0, 12)
        .map((p) => ({ name: p.nickname || p.username, username: p.username as string, avatar_url: p.avatar_url, verified: isVerified(p) }));
      return ok({ people });
    },
    { open: true },
  );
}
