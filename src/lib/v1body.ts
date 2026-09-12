import "server-only";
import type { NextRequest } from "next/server";
import { handle, requireUser, fail } from "@/lib/v1";
import { ok, type Result } from "@/core/contracts/result";
import type { Tag } from "@/core/contracts/tags";

/**
 * ====== غلافُ كتابةٍ تعيد جواباً — أختُ `trackRoute` (D-947) ======
 *
 * `trackRoute` تعيد `{done:true}` دائماً؛ **وكتاباتُ تبويب «قوائم» تعيد شيئاً**
 * (معرّفَ القائمة الجديدة، حالةَ الراية بعد القلب) — فهذا الغلافُ يمرّر
 * ما يعيده الفعلُ كما هو. **والجسمُ يُمرَّر إلى الفعل بلا تعقيمٍ ثانٍ**
 * (حجّةُ `trackRoute` حرفاً): الفعلُ يعقّم ويرمي، و`handle` يترجم.
 */
export function bodyRoute<B, T>(action: (body: B) => Promise<T>, tagsOf: (body: B, out: T) => Tag[]) {
  return async function POST(req: NextRequest) {
    return handle(async (): Promise<Result<T>> => {
      const auth = await requireUser();
      if (!auth.ok) return auth;
      let body: B;
      try {
        body = (await req.json()) as B;
      } catch {
        return fail("invalid_input");
      }
      if (!body || typeof body !== "object") return fail("invalid_input");
      const out = await action(body);
      return ok(out, tagsOf(body, out));
    });
  };
}
