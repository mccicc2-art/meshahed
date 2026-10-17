import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { groupErrorKey } from "@/lib/groupsCore";
import { fail, handle, limited, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { isGroupId, parseGroupManageBody } from "@/core/contracts/groups";

/**
 * 🆕 `POST /api/v1/me/groups/<id>/manage` — ما يُفعل بالقروب غيرَ الكتابة: قرأتُ · كتمتُ · خرجتُ · (والمشرفُ) أضاف ·
 * حذف · غيّر الاسمَ أو الصورة · 🆕 غيّر دورَ عضو (D-1453). **كلُّها دوالُّ القاعدة** (`dm_group_*`) تحكم وتكتب سطرَ النظام بنفسها.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const { id } = await ctx.params;
    if (!isGroupId(id)) return fail("invalid_input");
    const slow = limited(`v1:group-manage:${auth.user.id}`, 60, 60_000);
    if (slow) return slow;
    const b = parseGroupManageBody(await req.json().catch(() => null));
    if (!b) return fail("invalid_input");
    const supabase = await createClient();
    const call = (() => {
      switch (b.action) {
        case "read":
          return supabase.rpc("dm_group_mark_read", { p_group: id });
        case "leave":
          return supabase.rpc("dm_group_leave", { p_group: id });
        case "mute":
          return supabase.rpc("dm_group_mute", { p_group: id, p_muted: b.muted });
        case "add":
          return supabase.rpc("dm_group_add", { p_group: id, p_members: b.member_ids });
        case "remove":
          return supabase.rpc("dm_group_remove", { p_group: id, p_user: b.person_id });
        case "role":
          /* 🆕 D-1453 — المؤسسُ يعيّن الشريكَ والمشرف، والشريكُ المشرف (الهجرة ٢١٢) */
          return supabase.rpc("dm_group_set_role", { p_group: id, p_user: b.person_id, p_role: b.role });
        case "edit":
          if (b.photo_path && !b.photo_path.startsWith(`${auth.user.id}/`)) return null;
          return supabase.rpc("dm_group_edit", { p_group: id, p_name: b.name ?? null, p_photo: b.photo_path ?? null, p_clear_photo: b.clear_photo ?? false });
      }
    })();
    if (!call) return fail("invalid_input");
    const { error } = await call;
    if (error) {
      const key = groupErrorKey(error);
      if (key) return fail("forbidden", { message_key: key });
      if (error.code === "22023" || error.code === "23514") return fail("invalid_input");
      throw new Error(`group ${b.action}: ${error.message}`);
    }
    /* القراءةُ لا تغيّر شيئاً يُعاد رسمُه عند غيري إلّا ✓✓ — والوسمُ نفسُه يجدّد الصندوق */
    return ok({ done: true as const }, ["me:messages"]);
  });
}
