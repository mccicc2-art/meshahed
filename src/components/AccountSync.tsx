import { getProfile } from "@/lib/data";
import { ThemeCookieSync } from "./ThemeCookieSync";
import { FontPrefsSync } from "./FontPrefsSync";
import { UiStateSync } from "./UiStateSync";

/**
 * 🆕 **مزامنةُ الحساب — مضيفٌ لا يُلغى في الإعدادات** (D-498).
 *
 * ================= العطلُ الذي تُغلقه =================
 *
 * التوائمُ الثلاثة (الثيم · حجمُ الخطّ · التلميحاتُ والجولة) كانت تسكن
 * `Navbar`، **و`Navbar` يعود `null` في كلِّ مسارِ إعدادات** (D-462) —
 * **فجهازٌ جديدٌ يهبط مباشرةً على `‎/profile/settings/appearance` يرى
 * الافتراضيَّ ولا يرث تفضيلَ حسابه حتى يزور صفحةً فيها الشريط.**
 * **وهي بالضبط الصفحةُ التي يفتحها ليضبط ذلك التفضيل** — قِيس حيّاً،
 * وكُتب ديناً في `05` منذ D-474.
 *
 * ================= ولماذا مكوّنٌ رابعٌ لا سطرٌ في التخطيط =================
 *
 * التخطيطُ لا يقرأ البروفايل عمداً (D-122): `getUser()` رحلةُ شبكةٍ
 * كاملة، **ووضعُها في التخطيط يحبس أوّل بايتٍ لكلِّ صفحةٍ في التطبيق.**
 * **فهذا مكوّنُ خادمٍ يُغلَّف بـ`Suspense`** كما يُغلَّف الشريطُ — **يصل
 * حين يجهز ولا يحبس شيئاً**، ولا يرسم بكسلاً واحداً.
 *
 * ⚠️ **ولا نداءَ إضافيّ**: `getProfile` مغلَّفةٌ بـ`cache()` — **فقراءةُ
 * الشريطِ وقراءةُ هذا الملفِّ في الطلب الواحد استعلامٌ واحد** (D-470).
 *
 * ⚠️ **والزائرُ لا يدفع شيئاً**: `getProfile` تعود `null` بلا حساب،
 * **والتوائمُ لا تُركَّب أصلاً** — والتفضيلُ يبقى بالكوكي على جهازه.
 */
export async function AccountSync() {
  const profile = await getProfile().catch(() => null);
  if (!profile) return null;

  return (
    <>
      {/* يهاجر ثيم الحساب إلى الكوكي مرة واحدة — ثم لا يفعل شيئاً */}
      {profile.theme && <ThemeCookieSync theme={profile.theme} />}
      {/* وحجمُ الخطّ سواء — ولا يُركَّب قبل الهجرة 121 (العمود null) */}
      {profile.font_ui && profile.font_content && (
        <FontPrefsSync fontUi={profile.font_ui} fontContent={profile.font_content} />
      )}
      {/* والتلميحاتُ والجولة سواء: الحسابُ ينزل إلى الجهاز والجهازُ يصعد
          إليه مرةً — ولا يُركَّب قبل الهجرة */}
      {profile.ui_state != null && <UiStateSync uiState={profile.ui_state} />}
    </>
  );
}
