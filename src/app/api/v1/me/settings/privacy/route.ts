import { getProfile } from "@/lib/data";
import { updateProfile } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import type { PrivacyBody } from "@/core/contracts/settings";

/**
 * `POST /api/v1/me/settings/privacy` — المفاتيحُ الثلاثة (إخفاءُ الاسم · حسابٌ خاص ·
 * قفلُ قائمتَي المتابعة) في كتابةٍ واحدة كما يرسلها `AccountSettings` في الويب.
 * الحاملُ (`nickname` · `avatarUrl` · `favoriteGenres`) يُقرأ من الملفّ لا من
 * الجسم — الفعلُ يطلبه، والتطبيقُ لا يملك سبباً لإعادة إرساله.
 */
export const POST = bodyRoute<PrivacyBody, PrivacyBody>(
  async (b) => {
    const p = await getProfile();
    const next = { hide_name: !!b.hide_name, is_private: !!b.is_private, hide_follow_lists: !!b.hide_follow_lists };
    await updateProfile({
      nickname: p?.nickname ?? "",
      avatarUrl: p?.avatar_url ?? null,
      favoriteGenres: p?.favorite_genres ?? [],
      hideName: next.hide_name,
      isPrivate: next.is_private,
      hideFollowLists: next.hide_follow_lists,
    });
    return next;
  },
  () => ["user:me:profile", "home"],
);
