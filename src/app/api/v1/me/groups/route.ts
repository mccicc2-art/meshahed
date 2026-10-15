import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { groupErrorKey } from "@/lib/groupsCore";
import { fail, handle, limited, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { parseGroupCreateBody, type GroupCreatePayload } from "@/core/contracts/groups";

/**
 * 🆕 `POST /api/v1/me/groups` — إنشاءُ قروب (الهجرة ٢٠٥): الاسمُ والأعضاءُ وصورةٌ اختياريّة رُفعت قبلُ إلى
 * `/api/v1/me/messages/image`. **الحكمُ كلُّه في `dm_group_create`** (لوبز+ · ممّن تتابعهم · البوّاب · ١٢ معك)،
 * والرفضُ يعود مفتاحاً يُقرأ.
 */
export async function POST(req: NextRequest) {
  return handle<GroupCreatePayload>(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const slow = limited(`v1:group-create:${auth.user.id}`, 10, 60 * 60_000);
    if (slow) return slow;
    const b = parseGroupCreateBody(await req.json().catch(() => null));
    if (!b) return fail("invalid_input");
    if (b.photo_path && !b.photo_path.startsWith(`${auth.user.id}/`)) return fail("invalid_input");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("dm_group_create", { p_name: b.name, p_members: b.member_ids, p_photo: b.photo_path ?? null });
    if (error) {
      const key = groupErrorKey(error);
      if (key) return fail("forbidden", { message_key: key });
      if (error.code === "22023" || error.code === "23514") return fail("invalid_input");
      throw new Error(`group create: ${error.message}`);
    }
    return ok({ group_id: String(data) }, ["me:messages"]);
  });
}
