import { handle, limited, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/data";
import type { SupportersPayload, Supporter } from "@/core/contracts/supporters";

/**
 * `GET /api/v1/supporters` — **لوحةُ داعمي لوبز** (🆕 D-gold-perks، أحمد ١٠ نوفمبر). القائمةُ من `gold_supporters` (الهجرة ٢٤٤ —
 * الحكمُ في جسمها: Gold فعّالٌ ظاهرٌ باسمه)، و`me` من `my_supporter_state` لصاحب الجلسة. قبل الهجرة: قائمةٌ فارغة لا خطأ.
 */
export async function GET() {
  return handle<SupportersPayload>(async () => {
    const user = await getUser().catch(() => null);
    const lim = limited(`v1:supporters:${user?.id ?? "anon"}`, 30, 60_000);
    if (lim) return lim;
    const supabase = await createClient();
    const [rows, mine] = await Promise.all([
      supabase.rpc("gold_supporters"),
      user ? supabase.rpc("my_supporter_state") : Promise.resolve({ data: null, error: null }),
    ]);
    /* الهجرةُ غائبةٌ = قائمةٌ فارغة (مقصود)؛ أمّا خطأٌ آخرُ فخطأٌ — لا «لا داعمين بعد» كاذبة */
    if (rows.error && !/gold_supporters|does not exist|PGRST202/i.test(`${rows.error.message ?? ""} ${rows.error.code ?? ""}`)) return fail("upstream");
    const list: Supporter[] = ((rows.data as { username: string; nickname: string | null; avatar_url: string | null; avatar_pos: number | null; since: string | null }[] | null) ?? [])
      .filter((r) => !!r.username)
      .map((r) => ({ username: r.username, name: r.nickname, avatar_url: r.avatar_url, avatar_pos: r.avatar_pos, since: r.since }));
    const m = (mine.data as { gold: boolean; hidden: boolean; since: string | null }[] | null)?.[0] ?? null;
    return ok({ list, me: user && m ? { gold: !!m.gold, hidden: !!m.hidden, since: m.since } : null });
  });
}
