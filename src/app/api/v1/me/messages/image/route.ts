import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handle, requireUser, fail, limited } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { DM_IMAGE_MAX_BYTES, type MsgImagePayload } from "@/core/contracts/messages";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/**
 * 🆕 D-1387 — `POST /api/v1/me/messages/image`: صورةُ رسالةٍ خاصّة من التطبيق (multipart `file`).
 *
 * 🔑 **المخزنُ خاصّ** (`dm-media`، الهجرة ٢٠٢ — أحمد «٢ أ»): لا رابطَ عامّاً يعود، بل **المسار** `<uid>/<uuid>.<ext>`
 * يُرسَل بعدها مع الرسالة (`/text` بـ`image_path`)، والخادمُ يصنع لطرفَيها وحدهما رابطاً مؤقّتاً عند القراءة.
 * الرفعُ **برمز المستخدم** فسياسةُ المخزن (مجلّدُك وحدَك) هي الحَكَم — نهجُ `/api/v1/thread/image` نفسُه.
 * التطبيقُ يصغّر الصورةَ قبل الإرسال (١٩٢٠ طرفاً، JPEG) فتأتي عادةً تحت ميجابايت.
 */
export async function POST(req: NextRequest) {
  return handle<MsgImagePayload>(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const slow = limited(`dm-image:${auth.user.id}`, 20, 60_000);
    if (slow) return slow;
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return fail("invalid_input");
    }
    const file = form.get("file");
    if (!(file instanceof Blob)) return fail("invalid_input");
    const ext = TYPES[file.type];
    if (!ext) return fail("invalid_input", { field: "file", message_key: "apiImageInvalid" });
    if (file.size > DM_IMAGE_MAX_BYTES) return fail("invalid_input", { field: "file", message_key: "apiImageTooLarge" });
    const supabase = await createClient();
    const path = `${auth.user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("dm-media").upload(path, file, { contentType: file.type });
    if (error) throw new Error(`upload: ${error.message}`);
    return ok({ path });
  });
}
