import type { NextRequest } from "next/server";
import { inviteListMembers, removeListMember, respondListInvite } from "@/lib/actions";
import { handle, requireUser, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { listTag } from "@/core/contracts/tags";
import type { ListMembersBody, ListMembersPayload } from "@/core/contracts/library";

/**
 * `POST /api/v1/lists/members` — القوائمُ المشتركة (هجرة ٢٣٤): دعوةٌ · ردٌّ على دعوة · إزالةٌ أو مغادرة.
 *
 * **مسارٌ واحدٌ لثلاثة أفعالٍ على شيءٍ واحد** (عضويّةُ قائمة) — نمطُ `groups/[id]/manage`. والحرّاسُ في الدوالّ
 * بالقاعدة؛ ما هنا شكلُ الجسم وترجمةُ السببين إلى رمزين يُقرآن: «اكتمل العدد» شيءٌ يفعل به صاحبُها شيئاً.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    let b: ListMembersBody;
    try {
      b = (await req.json()) as ListMembersBody;
    } catch {
      return fail("invalid_input");
    }
    if (!b || typeof b.listId !== "string") return fail("invalid_input");
    const tags = [listTag(b.listId), "me:lists" as const, "me:library" as const];

    if (b.action === "invite") {
      if (!Array.isArray(b.userIds)) return fail("invalid_input");
      const r = await inviteListMembers(b.listId, b.userIds);
      if (!r.ok) {
        return r.reason === "full"
          ? fail("conflict", { message_key: "apiListMembersFull" })
          : fail("forbidden", { message_key: "apiListNotShareable" });
      }
      return ok<ListMembersPayload>({ done: true, count: r.count }, tags);
    }
    if (b.action === "respond") {
      const status = await respondListInvite(b.listId, !!b.accept);
      return ok<ListMembersPayload>({ done: true, status }, tags);
    }
    if (b.action === "remove") {
      if (typeof b.userId !== "string") return fail("invalid_input");
      await removeListMember(b.listId, b.userId);
      return ok<ListMembersPayload>({ done: true }, tags);
    }
    return fail("invalid_input");
  });
}
