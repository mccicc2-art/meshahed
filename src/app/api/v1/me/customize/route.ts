import type { NextRequest } from "next/server";
import { getProfile } from "@/lib/data";
import { updateProfile } from "@/lib/actions";
import { isPlus } from "@/core/plan";
import { sanitizeHomePrefs, touchesPaidHomePrefs } from "@/core/homePrefs";
import { sanitizeProfilePrefs, touchesPaidProfilePrefs } from "@/core/profilePrefs";
import { sanitizeUiState } from "@/lib/uiState";
import { handle, requireUser, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import type { CustomizePayload, CustomizeSaveBody, CustomizeSaveResult } from "@/core/contracts/settings";

/**
 * 🆕 D-1112 — بابُ «الرئيسيّة والملفّ» للتطبيق (Phase 11-I · I3).
 *
 * 🔑 **كاتبٌ واحد**: الحفظُ يمرّ من `updateProfile` نفسِه الذي تناديه `HomeCustomize`/`ProfileCustomize`
 * في الويب — فحارسُ بلس (`keepPaid*`) والتصفيةُ وإبطالُ الويب (`revalidatePath`) واحدٌ للسطحين.
 * **والاسمُ والصورةُ والأنواعُ تُقرأ هنا من الملفّ المحفوظ** لا يرسلها التطبيق: `updateProfile` يطلبها
 * في كلِّ نداء، **ورقمٌ يرسله العميلُ لحقلٍ لا يعرضه محوٌ صامتٌ ينتظر أوّلَ نسخةٍ قديمة** (درسُ D-546).
 *
 * ⚖️ **وغيرُ المشترك يُردّ بـ`needsPlus` قبل الكتابة** — كما يفتح الويبُ بوّابتَه قبل النداء؛ والخادمُ
 * كان سيحفظ المجّانيَّ وحدَه صامتاً، **وحفظٌ يُعلن النجاحَ وقد أسقط نصفَ ما اختير أسوأُ من المنع المعلن** (D-217).
 */
function payloadOf(p: Awaited<ReturnType<typeof getProfile>>): CustomizePayload {
  return {
    home: sanitizeHomePrefs(p?.home_prefs),
    profile: sanitizeProfilePrefs(p?.profile_prefs),
    templates: sanitizeUiState(p?.ui_state).tpl,
    plus: isPlus(p),
  };
}

export async function GET() {
  return handle<CustomizePayload>(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    return ok(payloadOf(await getProfile()));
  });
}

export async function POST(req: NextRequest) {
  return handle<CustomizeSaveResult>(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    let b: CustomizeSaveBody;
    try {
      b = (await req.json()) as CustomizeSaveBody;
    } catch {
      return fail("invalid_input");
    }
    if (!b || typeof b !== "object" || (b.home === undefined && b.profile === undefined)) return fail("invalid_input");
    const p = await getProfile();
    /* 🆕 D-1322 — **البوّابةُ على الحقل المدفوع لا على الطلب كلِّه** (حكمُ أحمد ٨ أكتوبر): غيرُ المشترك يجرّب في
       المعاينة، وما هو مجّانيٌّ (وضعُ العرض) يُحفظ له؛ و`needsPlus` يعود **قبل الكتابة** حين يمسّ الوارِدُ حقلاً
       يبيعه بلس — فلا يُعلَن نجاحٌ وقد أُسقط نصفُ ما اختير (D-217). `keepPaid*` في `updateProfile` حارسٌ ثانٍ. */
    if (!isPlus(p)) {
      const paid =
        (b.home !== undefined && touchesPaidHomePrefs(sanitizeHomePrefs(p?.home_prefs), sanitizeHomePrefs(b.home))) ||
        (b.profile !== undefined && touchesPaidProfilePrefs(sanitizeProfilePrefs(p?.profile_prefs), sanitizeProfilePrefs(b.profile)));
      if (paid) return ok({ data: null, needsPlus: true });
    }
    await updateProfile({
      nickname: p?.nickname ?? "",
      avatarUrl: p?.avatar_url ?? null,
      favoriteGenres: p?.favorite_genres ?? [],
      ...(b.home !== undefined ? { homePrefs: sanitizeHomePrefs(b.home) } : {}),
      ...(b.profile !== undefined ? { profilePrefs: sanitizeProfilePrefs(b.profile) } : {}),
    });
    return ok({ data: payloadOf(await getProfile()) }, ["home", "user:me:profile"]);
  });
}
