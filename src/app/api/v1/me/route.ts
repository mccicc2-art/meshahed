import { cookies, headers } from "next/headers";
import { getProfile, getOnboardState } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { platformFromUA } from "@/core/platform";
import { handle, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { isPlus, isPartner, isVerified, isFounder } from "@/core/plan";
import { sanitizeFontSize } from "@/core/fontPrefs";
import { TITLE_MODE_COOKIE, accountTitleMode, parseTitleMode } from "@/core/titleMode";

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
    /* 🆕 D-909: **نبضةُ «فُتح التطبيق»** — هذا البابُ يُنادى عند إقلاع
       تطبيق Expo، **وهو الدليلُ الوحيد على تثبيتٍ حقيقيّ**: الويبُ لا
       يمرّ من هنا. **بالتوازي لا بالتسلسل** فلا تُضاف إليه ملّي ثانية،
       **وفشلُه صمتٌ** — إحصاءٌ يكسر إقلاعَ تطبيقٍ أسوأُ صفقةٍ ممكنة. */
    const ua = (await headers()).get("user-agent");
    const [p, welcome] = await Promise.all([
      getProfile(),
      /* 🆕 D-1341 — هل أتمّ الترحيب؟ التطبيقُ يسأل هنا عند الإقلاع ليعرف أيرفع الرئيسيّةَ الأصليّة أم يترك الويب */
      getOnboardState(),
      (async () => {
        try {
          const supabase = await createClient();
          await supabase.rpc("touch_presence", { p_platform: platformFromUA(ua), p_is_app: true });
        } catch {
          /* لا شيء */
        }
      })(),
    ]);
    if (!p) return ok(null);
    /* 🆕 D-1269 — **إقلاعُ التطبيق يسوّي كوكيَّ «أسماء العناوين» باختيار الحساب**: الخادمُ يقرأ الكوكي في
       كلِّ حمولة، والحسابُ مرجعُه — فجهازٌ دخله صاحبُه للتوّ، أو غُيّر اختيارُه في مكانٍ آخر، يلحق من
       هنا. الملفُّ مقروءٌ أصلاً فلا استعلامَ يُضاف، ومن لم يختر (العمودُ فارغ) لا يُمسّ كوكيُّه. */
    const ownMode = accountTitleMode(p.title_mode);
    if (ownMode) {
      const store = await cookies();
      if (parseTitleMode(store.get(TITLE_MODE_COOKIE)?.value) !== ownMode) {
        store.set(TITLE_MODE_COOKIE, ownMode, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
      }
    }
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
      /* 🆕 D-1105 — حجما الخطّ: الشاشاتُ الأصليّةُ تكبر بهما كالويب (إضافةٌ لا تكسر غلافاً قديماً) */
      font_ui: sanitizeFontSize(p.font_ui),
      font_content: sanitizeFontSize(p.font_content),
      /* 🆕 D-1341 — `false` لمن ثبت أنّه لم يُتمّ وحدَه؛ «لا أعرف» ⇒ `true` (لا يُحبس أحدٌ على شكّ). إضافةٌ لا تكسر غلافاً قديماً */
      onboarded: welcome !== "pending",
    });
    /* D-1341 — يحتاجه من لم يُتمّ الترحيب: لا يُسأل عن الختم */
  }, { open: true });
}
