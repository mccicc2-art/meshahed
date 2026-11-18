import type { NextRequest } from "next/server";
import { getSeason, getTv } from "@/lib/tmdb";
import { airedPerSeason, firstEpisodeOf } from "@/core/progress";
import { isWelcomeShow } from "@/lib/welcomeSeeds";
import { handle, requireUser, positiveInt, limited, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import type { SceneEpisodesPayload } from "@/components/welcome/sceneTypes";

/**
 * 🆕 T414 — `GET /api/v1/welcome/episodes?id=&season=` — **حلقاتُ موسمٍ بصورها وأسمائها** لشريط «أين وصلت» في الترحيب
 * العريض (التصميم «ج — المشهد»، أحمد ١٨ نوفمبر: «السحب سيء» ⇒ شريطُ حلقاتٍ بالصور يُضغط).
 *
 * 🔑 **الأرقامُ أرقامُ `welcome/seasons` نفسُها** (`airedPerSeason` · `firstEpisodeOf`): ما عُرض وحدَه، ورقمُ الحلقة
 * `first + i` — فما يُضغط هنا هو ما تكتبه «يالله نبدأ»، في الترقيم النسبيّ والمطلق. والاسمُ والصورةُ بترتيب الحلقة في
 * الموسم لا برقمها عند TMDB: مسلسلٌ مطلقُ الترقيم يرقّم حلقاتِ موسمه بما لا يطابق `first` دائماً.
 * ⚖️ **نداءٌ لكلِّ موسمٍ يُفتح لا لكلِّ المواسم**: الشريطُ يطلب الموسمَ المعروضَ وحده.
 * ⚖️ **لأعمال الترحيب وحدَها و`open`** — كأخيه `welcome/seasons`: من لم يُتمّ الترحيب لا يقرأ غيرَها.
 */
export async function GET(req: NextRequest) {
  return handle<SceneEpisodesPayload>(
    async () => {
      const auth = await requireUser();
      if (!auth.ok) return auth;
      const id = positiveInt(req.nextUrl.searchParams.get("id"));
      const season = positiveInt(req.nextUrl.searchParams.get("season"));
      if (!id || !season || !isWelcomeShow(id)) return fail("invalid_input");
      const slow = limited(`v1:welcome-episodes:${auth.user.id}`, 60, 60_000);
      if (slow) return slow;
      const tv = await getTv(id);
      const count = airedPerSeason(tv).get(season) ?? 0;
      if (count <= 0) return ok({ id, season, episodes: [] });
      const first = firstEpisodeOf(tv).get(season) ?? 1;
      const rows = await getSeason(id, season)
        .then((s) => [...(s.episodes ?? [])].sort((a, b) => a.episode_number - b.episode_number))
        .catch(() => []);
      const episodes = Array.from({ length: Math.min(count, 400) }, (_, i) => ({
        episode: first + i,
        name: rows[i]?.name?.trim() || null,
        still: rows[i]?.still_path ?? null,
      }));
      return ok({ id, season, episodes });
    },
    { open: true },
  );
}
