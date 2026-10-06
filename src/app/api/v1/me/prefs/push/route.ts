import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handle, limited, requireUser, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { parseMuted, type PushPrefsPayload } from "@/core/push";

/**
 * `GET|POST /api/v1/me/prefs/push` — ما كتمه صاحبُه من أنواع إشعارات الدفع (D-1305): `{muted: PushGroup[]}`.
 *
 * 🔑 **في القاعدة لا في كوكي** (بخلاف بقيّة `me/prefs`): الخادمُ يقرؤه وهو يُرسل لمستلمٍ ليس صاحبَ الطلب — ولا كوكيَ
 * له هناك. صفٌّ واحدٌ للحساب (`push_prefs`)، وغيابُه = الكلُّ مفعَّل. المجهولُ في الجسم يسقط (`parseMuted`).
 */
export async function GET() {
  return handle<PushPrefsPayload>(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const supabase = await createClient();
    const { data } = await supabase.from("push_prefs").select("muted").eq("user_id", auth.user.id).maybeSingle();
    return ok({ muted: parseMuted((data as { muted?: unknown } | null)?.muted) });
  });
}

export async function POST(req: NextRequest) {
  return handle<PushPrefsPayload>(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const lim = limited(`v1:push-prefs:${auth.user.id}`, 30, 60_000);
    if (lim) return lim;
    let raw: { muted?: unknown } | null = null;
    try {
      raw = (await req.json()) as { muted?: unknown };
    } catch {
      return fail("invalid_input");
    }
    if (!raw || !Array.isArray(raw.muted)) return fail("invalid_input", { field: "muted" });
    const muted = parseMuted(raw.muted);
    const supabase = await createClient();
    const { error } = await supabase
      .from("push_prefs")
      .upsert({ user_id: auth.user.id, muted, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) return fail("internal");
    return ok({ muted });
  });
}
