import { getProfile } from "@/lib/data";
import { handle, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { isPlus, isPartner, isVerified, isFounder } from "@/core/plan";

/**
 * `GET /api/v1/me` — من أنا، بما يكفي لرسم الترويسة والإعدادات.
 *
 * 🔑 **الحقولُ المشتقّةُ تُحسب هنا لا في التطبيق** (`plus`/`partner`/`verified`):
 * القاعدةُ التي تقرأ `plus_until` **عاشت عطلاً حيّاً** (D-773) حين قُرئت في
 * موضعين بطريقتين — **فتُقرأ في `core/plan.ts` وحدَه** ويأخذ التطبيقُ جواباً.
 *
 * ⚠️ **ولا بريدَ ولا هويّةَ Google هنا**: الملفُّ العامُّ هو ما يحتاجه الرسم،
 * وما يعرفه الجهازُ أصلاً (بريدُ الدخول) لا يُعاد عبر الشبكة.
 */
export async function GET() {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const p = await getProfile();
    if (!p) return ok(null);
    return ok({
      id: p.id,
      username: p.username,
      nickname: p.nickname,
      avatar_url: p.avatar_url,
      cover_url: p.cover_url,
      bio: p.bio,
      theme: p.theme,
      theme_accent: p.theme_accent,
      is_private: p.is_private,
      timezone: p.timezone,
      plan: p.plan,
      plus: isPlus(p),
      partner: isPartner(p),
      verified: isVerified(p),
      founder: isFounder(p),
    });
  });
}
