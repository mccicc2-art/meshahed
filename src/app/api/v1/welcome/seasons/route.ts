import type { NextRequest } from "next/server";
import { getTv } from "@/lib/tmdb";
import { airedPerSeason, firstEpisodeOf } from "@/core/progress";
import { isWelcomeShow } from "@/lib/welcomeSeeds";
import { handle, requireUser, positiveInt, limited, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import type { WelcomeSeasonsPayload } from "@/core/contracts/welcome";

/**
 * `GET /api/v1/welcome/seasons?id=` — مواسمُ المسلسل لورقة «أين وصلت» (D-1347، قرارُ أحمد ١٠ أكتوبر:
 * «اللي يضغط على مسلسل اني بدأته يظهر له المواسم والحلقات»).
 *
 * 🔑 **الأرقامُ من القاعدتين القائمتين** (`airedPerSeason` · `firstEpisodeOf` — D-145/D-603): ما عُرض وحدَه،
 * ورقمُ أوّل حلقةٍ كما يكتبه الختمُ الكامل. الورقةُ ترسم `first … first + count − 1` — فما يختاره العضوُ هو ما
 * يُكتب، في الترقيم النسبيّ والمطلق (One Piece). **بلا أسماءِ حلقات**: الورقةُ أرقامٌ تُضغط (التصميمُ الموافَق
 * عليه)، ونداءٌ واحدٌ لـTMDB لا نداءٌ لكلِّ موسم.
 *
 * ⚖️ **لأعمال الترحيب وحدَها**: المسارُ `open` (من لم يُتمّ الترحيب لا يقرأ غيرَه)، فلا يكون باباً لصفحة أيِّ عمل.
 */
export async function GET(req: NextRequest) {
  return handle<WelcomeSeasonsPayload>(
    async () => {
      const auth = await requireUser();
      if (!auth.ok) return auth;
      const id = positiveInt(req.nextUrl.searchParams.get("id"));
      if (!id || !isWelcomeShow(id)) return fail("invalid_input");
      const slow = limited(`v1:welcome-seasons:${auth.user.id}`, 60, 60_000);
      if (slow) return slow;
      const tv = await getTv(id);
      const first = firstEpisodeOf(tv);
      const seasons = [...airedPerSeason(tv)]
        .filter(([, count]) => count > 0)
        .sort((a, b) => a[0] - b[0])
        .map(([season, count]) => ({ season, first: first.get(season) ?? 1, count }));
      return ok({ id, seasons });
    },
    { open: true },
  );
}
