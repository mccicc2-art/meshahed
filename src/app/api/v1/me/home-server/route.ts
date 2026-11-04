import { getProfile } from "@/lib/data";
import { homeServerLinkOf } from "@/lib/homeServer";
import { handle, requireUser, limited } from "@/lib/v1";
import { isPlus } from "@/core/plan";
import { ok } from "@/core/contracts/result";
import type { HomeServerState } from "@/core/contracts/homeServer";

/**
 * `GET /api/v1/me/home-server` — حالةُ رابط سيرفرات البيت لشاشتها (هجرة ٢٣٥): مشتركٌ؟ مربوط؟ ومتى وصل آخرُ حدث.
 * والأسئلةُ نفسُها في `GET /api/v1/me/stremio` (بطاقةُ «من أجهزتك» واحدة).
 */
export async function GET() {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const lim = limited(`v1:home-server:${auth.user.id}`, 30, 60_000);
    if (lim) return lim;
    const [profile, link] = await Promise.all([getProfile(), homeServerLinkOf(auth.user.id)]);
    const state: HomeServerState = {
      plus: isPlus(profile),
      linked: !!link,
      linked_at: link?.linked_at ?? null,
      used_at: link?.used_at ?? null,
    };
    return ok(state);
  });
}
