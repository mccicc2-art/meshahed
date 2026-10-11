import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handle, requireUser, fail, limited } from "@/lib/v1";
import { ok } from "@/core/contracts/result";

/**
 * `POST /api/v1/me/partner/id/confirm` — **تثبيتُ وثيقة الهويّة بعد وصولها** (🆕 D-1362 · V-C · C7 · الدفعة ٢).
 *
 * ترتيبُ `PartnerIdUpload` حرفاً: الملفُّ أوّلاً، ثمّ `partner_details.id_file`، **ثمّ يُمسح القديمُ بعد نجاح الجديد لا قبله** —
 * فانقطاعٌ في المنتصف يُبقي هويّةً صالحةً لا صفراً.
 *  - 🔴 **المسارُ يُفحص شكلاً ومجلّداً ووجوداً**: `<uid>/id-<أرقام>.<امتداد>` في مجلّد صاحب الطلب، **والملفُّ موجودٌ فعلاً** في
 *    المخزن (قراءةٌ بجلسته) — فلا يُكتب في الصفّ مسارٌ لم يُرفع، ولا مسارٌ في مجلّد غيره.
 *  - الكتابةُ بجلسة العضو: RLS (`partner writes own` — صفُّه وهو شريكٌ قائم) هي الحَكَم.
 */
const NAME = /^id-\d{10,16}\.(jpg|png|webp|pdf)$/;

export async function POST(req: NextRequest) {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const slow = limited(`v1:partner-id:${auth.user.id}`, 10, 60_000);
    if (slow) return slow;
    let body: { path?: unknown };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return fail("invalid_input");
    }
    const path = typeof body?.path === "string" ? body.path : "";
    const [folder, name, ...rest] = path.split("/");
    if (folder !== auth.user.id || !name || rest.length > 0 || !NAME.test(name)) return fail("invalid_input", { field: "path" });

    const supabase = await createClient();
    const { data: found, error: listErr } = await supabase.storage.from("partner-ids").list(folder, { search: name, limit: 10 });
    if (listErr) throw new Error(`partner-id list: ${listErr.message}`);
    if (!found?.some((f) => f.name === name)) return fail("not_found", { message_key: "apiPartnerIdUpload" });

    const { data: before } = await supabase.from("partner_details").select("id_file").eq("user_id", auth.user.id).maybeSingle();
    const { error: rowErr } = await supabase
      .from("partner_details")
      .upsert({ user_id: auth.user.id, id_file: path, updated_at: new Date().toISOString() });
    if (rowErr) {
      /* الصفُّ لم يُكتب (ليس شريكاً قائماً): الملفُّ المرفوعُ يتيم — يُزال ولا يُترك وثيقةً بلا صاحبِ صفّ */
      await supabase.storage.from("partner-ids").remove([path]).catch(() => {});
      return fail("forbidden", { message_key: "apiPartnerIdUpload" });
    }
    const old = (before as { id_file: string | null } | null)?.id_file ?? null;
    if (old && old !== path) await supabase.storage.from("partner-ids").remove([old]).catch(() => {});
    return ok({ done: true }, []);
  });
}
