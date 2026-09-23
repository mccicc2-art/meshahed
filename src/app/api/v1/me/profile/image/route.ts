import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UPLOAD_MAX_BYTES } from "@/lib/imageFile";
import { avatarStoragePath } from "@/core/avatarPath";
import { handle, requireUser, fail, limited } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import type { ProfileImagePayload } from "@/core/contracts/settings";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/**
 * `POST /api/v1/me/profile/image` — رفعُ صورة الملفّ أو الغلاف من التطبيق (D-1106).
 *
 * 🔑 **المخزنُ نفسُه والحدُّ نفسُه** (`avatars` · ٢ ميجابايت — `EditProfileForm`) **وبرمز المستخدم**:
 * `createClient` يحمل `Bearer` التطبيق، فسياسةُ المخزن (مجلّدُك وحدَك) هي التي تحكم لا هذا الملفّ.
 * التطبيقُ يصغّر الصورةَ قبل الإرسال (`expo-image-manipulator`) كما يصغّرها `fitForUpload` في الويب.
 *
 * الرابطُ يعود ولا يُكتب في الملفّ — «حفظ» هو الذي يكتبه. و`replaces` رفعةٌ سابقةٌ في الجلسة نفسِها
 * لم تُحفظ (بدّل صورتَه مرّتين): تُحذف ما دامت ليست المحفوظة؛ المحفوظةُ يحذفها الحفظُ وحدَه.
 */
export async function POST(req: NextRequest) {
  return handle<ProfileImagePayload>(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const slow = limited(`profile-image:${auth.user.id}`, 20, 60_000);
    if (slow) return slow;
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return fail("invalid_input");
    }
    const kind = form.get("kind") === "cover" ? "cover" : form.get("kind") === "avatar" ? "avatar" : null;
    const file = form.get("file");
    if (!kind || !(file instanceof Blob)) return fail("invalid_input");
    const ext = TYPES[file.type];
    if (!ext) return fail("invalid_input", { field: "file", message_key: "apiImageInvalid" });
    if (file.size > UPLOAD_MAX_BYTES) return fail("invalid_input", { field: "file", message_key: "apiImageTooLarge" });

    const supabase = await createClient();
    const path = `${auth.user.id}/${kind}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
    if (error) throw new Error(`upload: ${error.message}`);
    const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;

    const replaces = form.get("replaces");
    if (typeof replaces === "string" && replaces) {
      const { data: saved } = await supabase.from("profiles").select("avatar_url, cover_url").eq("id", auth.user.id).maybeSingle();
      const old = avatarStoragePath(replaces, auth.user.id);
      if (old && old !== path && replaces !== saved?.avatar_url && replaces !== saved?.cover_url) {
        await supabase.storage.from("avatars").remove([old]).catch(() => {});
      }
    }
    return ok({ url });
  });
}
