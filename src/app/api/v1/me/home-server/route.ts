import { getProfile } from "@/lib/data";
import { homeServerLinkOf, kodiLinkOf } from "@/lib/homeServer";
import { kodiDeviceOf, kodiPairPending } from "@/lib/linkTokens";
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
    const uid = auth.user.id;
    const [profile, link, kodi, device, pairing] = await Promise.all([getProfile(), homeServerLinkOf(uid), kodiLinkOf(uid), kodiDeviceOf(uid), kodiPairPending(uid)]);
    const state: HomeServerState = {
      plus: isPlus(profile),
      linked: !!link,
      linked_at: link?.linked_at ?? null,
      used_at: link?.used_at ?? null,
      /* 🆕 هجرة ٢٣٦ — Kodi برابطه الخاصّ */
      kodi: { linked: !!kodi, device: kodi ? device : null, linked_at: kodi?.linked_at ?? null, used_at: kodi?.used_at ?? null, pairing },
    };
    return ok(state);
  });
}
