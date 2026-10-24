import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UPLOAD_MAX_BYTES } from "@/lib/imageFile";
import { handle, requireUser, fail, limited } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { sniffBlob } from "@/core/imageMagic";
import type { ThreadImagePayload } from "@/core/contracts/thread";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/**
 * `POST /api/v1/thread/image` — صورةُ منشورٍ في الغرفة من التطبيق (Phase 11-M · M3).
 *
 * 🔑 **المسارُ والمخزنُ والحدُّ حرفاً كما يرفعها `Composer` في المتصفّح** (`avatars` · `${uid}/talk/${Date.now()}.${ext}` ·
 * ٢ ميجابايت) — **وبرمز المستخدم** (`createClient` يحمل `Bearer`)، فسياسةُ المخزن (مجلّدُك وحدَك) هي الحَكَم. والرابطُ يعود
 * ولا يُكتب: «أرسل» هو الذي يكتبه مع المنشور، **وحارسُ بادئة المخزن (D-298) في `addTalkPost` كما هو.**
 * التطبيقُ يصغّر الصورةَ قبل الإرسال (`expo-image-manipulator`) كما يصغّرها `fitForUpload` في الويب.
 */
export async function POST(req: NextRequest) {
  return handle<ThreadImagePayload>(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const slow = limited(`talk-image:${auth.user.id}`, 20, 60_000);
    if (slow) return slow;
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return fail("invalid_input");
    }
    const file = form.get("file");
    if (!(file instanceof Blob)) return fail("invalid_input");
    if (!TYPES[file.type]) return fail("invalid_input", { field: "file", message_key: "apiImageInvalid" });
    if (file.size > UPLOAD_MAX_BYTES) return fail("invalid_input", { field: "file", message_key: "apiImageTooLarge" });
    /* A-20 — النوعُ من البايتات لا من التصريح: ما ليس JPEG/PNG/WEBP فعلاً لا يصل المخزن، ويُخزَّن بنوعه الحقيقيّ */
    const real = await sniffBlob(file);
    if (!real) return fail("invalid_input", { field: "file", message_key: "apiImageInvalid" });
    const ext = real.ext;
    const supabase = await createClient();
    const path = `${auth.user.id}/talk/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: real.type });
    if (error) throw new Error(`upload: ${error.message}`);
    return ok({ url: supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl });
  });
}
