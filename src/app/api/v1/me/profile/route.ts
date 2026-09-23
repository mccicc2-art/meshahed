import type { NextRequest } from "next/server";
import { getProfile } from "@/lib/data";
import { updateProfile } from "@/lib/actions";
import { xLinkEnabled } from "@/lib/xLink";
import { sanitizeSocials } from "@/core/socials";
import { SITE_URL } from "@/lib/site";
import { handle, requireUser, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import type { ProfileEditPayload, ProfileSaveBody } from "@/core/contracts/settings";

/** حدُّ النبذة في هذه الشاشة — `BIO_MAX` في `EditProfileForm` (مواصفةُ أحمد)، والقاعدةُ تقبل ١٦٠ */
const BIO_MAX = 120;

function payloadOf(
  p: Awaited<ReturnType<typeof getProfile>>,
  xOn: boolean,
): ProfileEditPayload {
  return {
    nickname: p?.nickname ?? "",
    username: p?.username ?? "",
    bio: p?.bio ?? "",
    avatar_url: p?.avatar_url ?? null,
    cover_url: p?.cover_url ?? null,
    cover_pos: p?.cover_pos ?? 30,
    avatar_pos: p?.avatar_pos ?? 50,
    is_private: !!p?.is_private,
    site_url: SITE_URL,
    x: xOn ? { handle: sanitizeSocials(p?.socials).x ?? null, verified: !!p?.x_verified_at } : null,
  };
}

/**
 * `GET /api/v1/me/profile` — نموذجُ «تعديل الملف» (Phase 11-I · I3، D-1106): ما تقرؤه
 * `app/profile/edit/page.tsx` حرفاً، وقسمُ X يغيب حين يغيب مزوّدُه (D-217).
 */
export async function GET() {
  return handle<ProfileEditPayload>(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const [p, xOn] = await Promise.all([getProfile(), xLinkEnabled()]);
    return ok(payloadOf(p, xOn));
  });
}

/**
 * `POST /api/v1/me/profile` — حفظُ النموذج بـ`updateProfile` نفسِه (الكاتبُ الواحد — D-462).
 *
 * 🔑 **الأنواعُ تُقرأ من الملفّ لا من الجسم**: الفعلُ يطلبها في كلِّ نداء، ونموذجٌ لا يعرضها لا
 * يرسلها (فلا يمحوها). و`socials` لا تُرسل أبداً — كاتبُها `syncXIdentity` وحدَها (D-839).
 *
 * **والصورةُ القديمةُ تُحذف بعد الحفظ لا قبله** — في `updateProfile` (D-1108)، للويب وللتطبيق.
 */
export async function POST(req: NextRequest) {
  return handle<ProfileEditPayload>(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    let b: ProfileSaveBody;
    try {
      b = (await req.json()) as ProfileSaveBody;
    } catch {
      return fail("invalid_input");
    }
    if (!b || typeof b !== "object" || typeof b.nickname !== "string" || typeof b.username !== "string" || typeof b.bio !== "string")
      return fail("invalid_input");
    const cleaned = b.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (cleaned.length > 0 && cleaned.length < 3) return fail("invalid_input", { field: "username" });

    const before = await getProfile();
    try {
      await updateProfile({
        nickname: b.nickname,
        username: cleaned,
        bio: b.bio.slice(0, BIO_MAX),
        avatarUrl: typeof b.avatar_url === "string" ? b.avatar_url : null,
        coverUrl: typeof b.cover_url === "string" ? b.cover_url : null,
        coverPos: Number(b.cover_pos),
        avatarPos: Number(b.avatar_pos),
        favoriteGenres: before?.favorite_genres ?? [],
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("Username is taken")) return fail("conflict", { field: "username", message_key: "apiUsernameTaken" });
      throw e;
    }

    /* الصورتان القديمتان يحذفهما `updateProfile` نفسُه بعد الحفظ (D-1108) — للويب والتطبيق معاً */
    const [p, xOn] = await Promise.all([getProfile(), xLinkEnabled()]);
    return ok(payloadOf(p, xOn), ["user:me:profile", "home"]);
  });
}
