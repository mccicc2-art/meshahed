import "server-only";
import type { NextRequest } from "next/server";
import { handle, requireUser, fail } from "@/lib/v1";
import { ok, type Result } from "@/core/contracts/result";
import type { Tag } from "@/core/contracts/tags";
import type { TrackResult } from "@/core/contracts/track";

/**
 * ====== غلافُ كتابات التتبّع — سطرٌ لكلِّ مسار ======
 *
 * 🔑 **الوسومُ تُعلَن هنا بما يطابق `revalidatePath` في الفعل نفسِه** —
 * لا أكثر ولا أقلّ: `toggleEpisode` لا يُبطل صفحةَ المسلسل (الواجهةُ
 * تفاؤليّة) **فلا يُعلن وسمَها**؛ و`setSeasonWatched` يُبطلها **فيُعلنه.**
 * حين يُستخرج المنطقُ إلى `core` (الخطوة ٢-ب) تنتقل هذه الوسومُ معه
 * ويصير هذا الملفُّ سطراً — **وحتى ذلك الحين لا يوجد مصدرٌ ثالث.**
 *
 * ⚠️ **الجسمُ يُمرَّر كما هو إلى الفعل**: الفعلُ نفسُه يعقّم (`intId`/`intIn`)
 * ويرمي «مدخل غير صالح» فيُترجم إلى `422` — **لا تعقيمَ ثانٍ هنا يفترق
 * عن الأوّل يوماً.**
 */
export function trackRoute<B>(
  action: (body: B) => Promise<unknown>,
  tagsOf: (body: B) => Tag[],
) {
  return async function POST(req: NextRequest) {
    return handle(async (): Promise<Result<TrackResult>> => {
      const auth = await requireUser();
      if (!auth.ok) return auth;
      let body: B;
      try {
        body = (await req.json()) as B;
      } catch {
        return fail("invalid_input");
      }
      if (!body || typeof body !== "object") return fail("invalid_input");
      await action(body);
      return ok({ done: true }, tagsOf(body));
    });
  };
}
