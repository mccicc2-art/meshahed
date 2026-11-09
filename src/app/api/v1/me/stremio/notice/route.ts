import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handle, requireUser, limited, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import type { StremioNoticeBody } from "@/core/contracts/stremio";

/**
 * 🆕 T361 — `POST /api/v1/me/stremio/notice` `{id}`: **رأى ما سجّله Loopz بنفسه** (قيّم الفيلمَ من البطاقة أو ضغط «حسناً» على
 * الحلقة) فيخرج من «من تطبيقاتك» (`noticed_at`، هجرة ٢٤٢).
 * ⚖️ **لا يمسّ التعليمَ نفسَه**: المشاهدةُ محفوظةٌ قبلها — هذا ختمُ «رأيتُه» وحدَه، على إشارةٍ سُجّلت تلقائياً لصاحبها.
 * والوسمُ `me:stremio` يُسقط البطاقةَ والقائمة. قبل الهجرة لا عمود: الكتابةُ تفشل فيُردّ ✓ ولا تعود البطاقةُ تطلب ما لا تجده.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const lim = limited(`v1:stremio-notice:${auth.user.id}`, 60, 60_000);
    if (lim) return lim;
    let body: StremioNoticeBody | null = null;
    try {
      body = (await req.json()) as StremioNoticeBody;
    } catch {
      return fail("invalid_input");
    }
    const id = Number(body?.id);
    if (!Number.isSafeInteger(id) || id < 1) return fail("invalid_input", { field: "id" });
    const supabase = await createClient();
    await supabase
      .from("watch_signals")
      .update({ noticed_at: new Date().toISOString() })
      .match({ id, user_id: auth.user.id })
      .not("auto_at", "is", null)
      .is("noticed_at", null);
    return ok({ done: true }, ["me:stremio"]);
  });
}
