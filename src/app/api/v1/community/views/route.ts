import type { NextRequest } from "next/server";
import { recordPostViews } from "@/lib/actions";
import { parsePostViewsBody } from "@/core/communityActs";
import { handle, requireUser, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";

/**
 * `POST /api/v1/community/views` — عدُّ المشاهدات (Phase 11-M · M2): `{keys}` دفعةً كما يجمعها `PostViews` في الويب
 * (نصفُ البطاقة ظاهرٌ ⇒ تُعدّ مرّةً، وتُرسل بعد سكونٍ ثانيةً ونصفاً). **حارسُ الشكل (`isViewKey`) والحدُّ والصمتُ
 * عند الفشل في الفعل** — عدّادٌ ضائعٌ لا يستحقّ رسالةَ خطأ.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const b = parsePostViewsBody(await req.json().catch(() => null));
    if (!b) return fail("invalid_input");
    await recordPostViews(b.keys);
    return ok({ done: true as const }, []);
  });
}
