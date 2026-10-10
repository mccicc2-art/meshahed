import { getProfile, getOnboardState } from "@/lib/data";
import { welcomeSeeds } from "@/lib/welcomeSeeds";
import { handle, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import type { WelcomePayload } from "@/core/contracts/welcome";

/**
 * `GET /api/v1/welcome` — **ما يقرؤه الترحيبُ الأصليّ عند فتحه** (D-1347): ما تقرؤه صفحةُ `/welcome` حرفاً
 * (الاسمُ والصورةُ واسمُ المستخدم كما في الملفّ · الأنواعُ المحفوظة · الأعمالُ الأربعةُ والعشرون) ومعه البريد
 * («دخلتَ بحساب …» — D-885) و`onboarded` لمن أتمّه على جهازٍ آخر.
 *
 * ⚖️ `open`: يُنادى ممّن لم يُتمّ الترحيب — وهو كلُّ من ينادي هذا المسار.
 */
export async function GET() {
  return handle<WelcomePayload>(
    async () => {
      const auth = await requireUser();
      if (!auth.ok) return auth;
      const [profile, state, seeds] = await Promise.all([getProfile(), getOnboardState(), welcomeSeeds()]);
      return ok({
        email: auth.user.email ?? null,
        nickname: profile?.nickname ?? "",
        username: profile?.username ?? "",
        avatar_url: profile?.avatar_url ?? null,
        genres: profile?.favorite_genres ?? [],
        seeds,
        onboarded: state === "done",
      });
    },
    { open: true },
  );
}
