import type { NextRequest } from "next/server";
import { suggestPeople } from "@/lib/actions";
import { handle, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { isPlus, isPartner, isVerified, isFounder } from "@/core/plan";
import type { WelcomePeopleBody, WelcomePeoplePayload } from "@/core/contracts/welcome";

/**
 * `POST /api/v1/welcome/people` — «أشخاص قد ترغب بمتابعتهم» (D-1347). البذرةُ من الشاشة لأنّ المتابعاتِ لم
 * تُكتب بعد (كلُّ شيءٍ يُكتب في آخر خطوة — D-126)؛ التصفيةُ كلُّها في `people_to_follow`. الشاراتُ تُحسب هنا
 * (`core/plan`) فلا تحمل الشاشةُ قاعدةَ الخطّة.
 */
const WANT = 6;

export async function POST(req: NextRequest) {
  return handle<WelcomePeoplePayload>(
    async () => {
      const auth = await requireUser();
      if (!auth.ok) return auth;
      const body = (await req.json().catch(() => null)) as WelcomePeopleBody | null;
      const rows = await suggestPeople(Array.isArray(body?.seeds) ? body.seeds : [], WANT).catch(() => []);
      return ok({
        people: rows.map((p) => ({
          id: p.id,
          nickname: p.nickname,
          username: p.username,
          avatar_url: p.avatar_url,
          shared: p.shared,
          followers: p.followers,
          partner: isPartner(p),
          plus: isPlus(p),
          founder: isFounder(p),
          verified: isVerified(p),
        })),
      });
    },
    { open: true },
  );
}
