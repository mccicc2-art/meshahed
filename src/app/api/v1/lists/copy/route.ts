import type { NextRequest } from "next/server";
import { copyList } from "@/lib/actions";
import { handle, requireUser, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { listTag } from "@/core/contracts/tags";
import type { CopyListBody, CopyListPayload } from "@/core/contracts/library";

/**
 * `POST /api/v1/lists/copy` — نسخُ قائمةِ غيري إلى قوائمي (هجرة ٢٣٣ · رقاقةُ «انسخها لقوائمي»).
 *
 * **لا `bodyRoute`**: الفعلُ يعيد سببَ الرفض لا يرميه، فالسببان يصلان رمزين يُقرآن
 * (`apiListCopyTooMany` · `apiListCopyUnavailable`) **لا «تعذّر إتمام العملية» واحدةً للحالتين** —
 * السقفُ شيءٌ يفعل به العضوُ شيئاً (يحذف قائمة)، والقائمةُ التي أُخفيت ليس له فيها شيء.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    let body: CopyListBody;
    try {
      body = (await req.json()) as CopyListBody;
    } catch {
      return fail("invalid_input");
    }
    if (!body || typeof body.listId !== "string") return fail("invalid_input");
    const r = await copyList(body.listId);
    if (!r.ok) {
      return r.reason === "too_many"
        ? fail("conflict", { message_key: "apiListCopyTooMany" })
        : fail("not_found", { message_key: "apiListCopyUnavailable" });
    }
    return ok<CopyListPayload>({ id: r.id, created: r.created }, ["me:lists", "me:library", listTag(r.id)]);
  });
}
