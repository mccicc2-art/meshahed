import type { NextRequest } from "next/server";
import {
  saveWelcomeIdentity,
  follow,
  applyOnboardingProgress,
  requestOrFollowUser,
  completeOnboarding,
} from "@/lib/actions";
import { welcomeSeeds } from "@/lib/welcomeSeeds";
import { handle, requireUser, limited, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import type { WelcomeFinishBody, WelcomeFinishPayload, WelcomeProgress, WelcomeUpTo } from "@/core/contracts/welcome";

/**
 * `POST /api/v1/welcome/finish` — **«يالله نبدأ» للترحيب الأصليّ** (D-1347).
 *
 * 🔑 **ترتيبُ `Onboarding.finish()` حرفاً، بالأفعال نفسِها**: الهويّةُ أوّلاً (اسمٌ يُرفض ⇒ لم يُكتب شيء) ← المتابعات
 * ← التقدّم ← الأشخاص ← الختم. نداءٌ واحدٌ من الهاتف لا ثلاثون: شبكةُ جوّالٍ تنقطع في منتصف سلسلةٍ تترك مكتبةً
 * نصفَها مكتوب، والخادمُ إلى Supabase وTMDB أقربُ منه. وإعادةُ النداء آمنة: كلُّ كتابةٍ `upsert` والختمُ مرّةً.
 *
 * 🔑 **الأعمالُ تُقرأ من قائمة الخادم لا من الجسم**: الشاشةُ ترسل الأرقامَ وحدَها؛ العنوانُ والملصقُ ونوعُ العمل من
 * `welcomeSeeds` — فلا يكتب هذا المسارُ المفتوحُ في مكتبةٍ عملاً ليس من الترحيب ولا عنواناً من عند العميل.
 *
 * ⚖️ النتائجُ المتوقَّعة (اسمٌ مأخوذ · بلا عمل) تعود `ok` بـ`done:false` وخطوتِها — الشاشةُ تعود إليها. ما سواها خطأ.
 */
export const maxDuration = 60;

const asProgress = (v: unknown): WelcomeProgress => (v === "done" ? "done" : v === "some" ? "some" : "none");
/* موضعٌ فاسدٌ يسقط وحدَه («بدأته فقط») — لو عبر لرمى `intIn` داخل الفعل فسقط تقدّمُ الأعمال كلِّها معه */
const asUpTo = (v: unknown): WelcomeUpTo | null => {
  const s = Number((v as WelcomeUpTo | null)?.season);
  const e = Number((v as WelcomeUpTo | null)?.episode);
  return Number.isInteger(s) && s >= 1 && s <= 1000 && Number.isInteger(e) && e >= 1 && e <= 20_000 ? { season: s, episode: e } : null;
};

export async function POST(req: NextRequest) {
  return handle<WelcomeFinishPayload>(
    async () => {
      const auth = await requireUser();
      if (!auth.ok) return auth;
      const slow = limited(`v1:welcome-finish:${auth.user.id}`, 6, 60_000);
      if (slow) return slow;
      const body = (await req.json().catch(() => null)) as WelcomeFinishBody | null;
      if (!body || typeof body !== "object") return fail("invalid_input");

      const seeds = await welcomeSeeds();
      const byId = new Map(seeds.map((s) => [s.id, s]));
      const seen = new Set<number>();
      const chosen = (Array.isArray(body.titles) ? body.titles : [])
        .slice(0, 24)
        .map((t) => ({ seed: byId.get(Number(t?.id)), progress: asProgress(t?.progress), upTo: asUpTo(t?.upTo) }))
        .filter((t): t is { seed: NonNullable<typeof t.seed>; progress: WelcomeProgress; upTo: WelcomeUpTo | null } => {
          if (!t.seed || seen.has(t.seed.id)) return false;
          seen.add(t.seed.id);
          return true;
        });
      if (chosen.length === 0) return ok({ done: false, step: "pick", reason: "missing" });

      const id = await saveWelcomeIdentity({
        nickname: String(body.nickname ?? ""),
        username: String(body.username ?? ""),
        avatarUrl: typeof body.avatarUrl === "string" && body.avatarUrl ? body.avatarUrl : null,
        favoriteGenres: Array.isArray(body.genres) ? body.genres : [],
      });
      if (!id.ok) {
        if (id.reason === "failed") return ok({ done: false, step: "end", reason: "failed" });
        return ok({ done: false, step: "me", reason: id.reason });
      }

      for (const c of chosen) {
        try {
          await follow({ tmdbId: c.seed.id, mediaType: c.seed.mediaType, title: c.seed.title, posterPath: c.seed.posterPath });
        } catch {
          // عملٌ واحدٌ فشل لا يوقف البقيّة
        }
      }
      try {
        await applyOnboardingProgress(
          chosen.map((c) => ({ tmdbId: c.seed.id, mediaType: c.seed.mediaType, progress: c.progress, upTo: c.upTo })),
        );
      } catch {
        // التقدّمُ اختياريّ — المتابعةُ نفسُها نجحت
      }
      for (const uid of (Array.isArray(body.people) ? body.people : []).slice(0, 12)) {
        try {
          await requestOrFollowUser(String(uid));
        } catch {
          // شخصٌ واحدٌ فشل لا يوقف البقيّة
        }
      }

      const done = await completeOnboarding();
      if (!done.ok) {
        if (done.reason === "username") return ok({ done: false, step: "me", reason: "missing" });
        if (done.reason === "titles") return ok({ done: false, step: "pick", reason: "missing" });
        return ok({ done: false, step: "end", reason: "failed" });
      }
      return ok({ done: true }, ["home", "me:library", "me:stats", "user:me:profile"]);
    },
    { open: true },
  );
}
