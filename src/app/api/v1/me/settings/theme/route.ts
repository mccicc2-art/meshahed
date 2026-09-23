import { getProfile } from "@/lib/data";
import { updateProfile, syncThemeCookie } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import { THEMES, DEFAULT_THEME } from "@/core/themes";
import { isPlus, themeNeedsPlus } from "@/core/plan";
import type { ThemeBody } from "@/core/contracts/settings";

/**
 * `POST /api/v1/me/settings/theme` — الثيم (Phase 11-I). وصفةُ `ThemeSection`
 * حرفاً: `updateProfile({theme})` (وفيه حارسُ البلس — D-791) ثمّ `syncThemeCookie`
 * فتقرأ الصفحةُ تحت الشاشة الثيمَ الجديد قبل أوّل بكسل. `needsPlus` يعود صريحاً
 * ليفتح التطبيقُ بابَ البلس بدل صمتٍ لا يفسَّر (وصفةُ `me/prefs/tabs`).
 */
export const POST = bodyRoute<ThemeBody, { theme: string; needsPlus?: true }>(
  async (b) => {
    const id = THEMES.some((t) => t.id === b.theme) ? String(b.theme) : DEFAULT_THEME.id;
    const p = await getProfile();
    if (themeNeedsPlus(id) && !isPlus(p)) return { theme: p?.theme ?? DEFAULT_THEME.id, needsPlus: true };
    await updateProfile({
      nickname: p?.nickname ?? "",
      bio: p?.bio ?? "",
      avatarUrl: p?.avatar_url ?? null,
      coverUrl: p?.cover_url ?? null,
      coverPos: p?.cover_pos ?? 30,
      avatarPos: p?.avatar_pos ?? 50,
      favoriteGenres: p?.favorite_genres ?? [],
      theme: id,
    });
    await syncThemeCookie(id);
    return { theme: id };
  },
  () => ["user:me:profile", "home"],
);
