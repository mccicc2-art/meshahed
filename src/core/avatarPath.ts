/**
 * 🆕 D-1106 — **مسارُ صورةٍ في مخزن `avatars` من رابطها العامّ** — بشرط أن تكون في مجلّد صاحبها
 * (`<uid>/…`)؛ ما سواه `null` فلا يُحذف ملفُّ أحدٍ آخر ولا صورةُ Google. كان دالّةً محلّيّةً في
 * `EditProfileForm`، والآن يقرؤها النموذجُ وبابا الـAPI (الرفعُ والحفظ) — نسخةٌ واحدة (D-145).
 */
export function avatarStoragePath(url: string | null | undefined, uid: string): string | null {
  if (!url) return null;
  const marker = "/storage/v1/object/public/avatars/";
  const at = url.indexOf(marker);
  if (at < 0) return null;
  const path = decodeURIComponent(url.slice(at + marker.length).split("?")[0]);
  return path.startsWith(`${uid}/`) ? path : null;
}
