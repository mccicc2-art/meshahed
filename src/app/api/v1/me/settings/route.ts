import { cookies } from "next/headers";
import { getProfile, getContentPrefs } from "@/lib/data";
import { getT, getWatchRegion, getTitleMode } from "@/lib/locale";
import { myBlocksList } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { handle, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { isPlus, isPartner, isVerified, isFounder, planNameOf } from "@/core/plan";
import { DEFAULT_THEME } from "@/core/themes";
import { FONT_UI_COOKIE, FONT_CONTENT_COOKIE, sanitizeFontSize } from "@/core/fontPrefs";
import { TOUR_IDS, TOUR_META } from "@/lib/tour";
import type { SettingsPayload } from "@/core/contracts/settings";

/** بريدُ الدعم كما في `profile/settings/help` — سطرٌ واحدٌ لا يُكتب مرّتين */
const CONTACT_EMAIL = "alharbiahmed3bd@gmail.com";

/**
 * `GET /api/v1/me/settings` — الإعداداتُ كلُّها في قراءةٍ واحدة (Phase 11-I · I0).
 *
 * 🔑 **كلُّ قيمةٍ من مصدرها الذي يقرؤه الويب حرفاً**: الثيمُ من الملفّ،
 * الخطُّ من الكوكي ثمّ عمودَي الملفّ (وصفةُ `appearance/page.tsx`)، أسماءُ
 * الأعمال والمنطقةُ من كوكييهما (`getTitleMode` · `getWatchRegion`)،
 * وتفضيلاتُ المحتوى من `getContentPrefs`. **لا قراءةَ ثانيةً بطريقةٍ ثانية**
 * — وهو درسُ D-773 بحرفه.
 *
 * ⚠️ العدّان (الممنوحون · المحظورون) للقيمة على صفِّ الفهرس فقط؛ القائمتان
 * بابان (`library-access` · `blocked`) يُفتحان عند الطلب.
 */
export async function GET() {
  return handle<SettingsPayload>(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const [{ locale, t }, p, region, titleMode, prefs, store, supabase] = await Promise.all([
      getT(),
      getProfile(),
      getWatchRegion(),
      getTitleMode(),
      getContentPrefs(),
      cookies(),
      createClient(),
    ]);
    const [grants, blocked] = await Promise.all([
      supabase.from("library_grants").select("grantee_id", { count: "exact", head: true }).eq("owner_id", auth.user.id),
      myBlocksList().catch(() => []),
    ]);
    const fontUi = sanitizeFontSize(store.get(FONT_UI_COOKIE)?.value ?? p?.font_ui ?? undefined);
    const fontContent = sanitizeFontSize(store.get(FONT_CONTENT_COOKIE)?.value ?? p?.font_content ?? undefined);
    return ok({
      account: {
        username: p?.username ?? null,
        nickname: p?.nickname ?? null,
        avatar_url: p?.avatar_url ?? null,
        avatar_pos: p?.avatar_pos ?? 50,
        email: auth.user.email ?? null,
        plan_label: planNameOf(p, t),
        plus: isPlus(p),
        partner: isPartner(p),
        verified: isVerified(p),
        founder: isFounder(p),
      },
      appearance: {
        locale,
        theme: p?.theme ?? DEFAULT_THEME.id,
        font_ui: fontUi,
        font_content: fontContent,
      },
      content: { title_mode: titleMode, region, prefs },
      privacy: {
        hide_name: !!p?.hide_name,
        is_private: !!p?.is_private,
        hide_follow_lists: !!p?.hide_follow_lists,
        library_grants: grants.count ?? 0,
        blocked: blocked.length,
      },
      help: {
        tours: TOUR_IDS.map((id) => ({ id, title: TOUR_META[id].title(t), sub: TOUR_META[id].sub(t) })),
        contact_email: CONTACT_EMAIL,
      },
      about: { build: (process.env.VERCEL_GIT_COMMIT_SHA ?? "dev").slice(0, 7) },
    });
  });
}
