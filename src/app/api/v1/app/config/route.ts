import { handle } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import type { AppConfig, WhatsNewItem } from "@/core/contracts/appConfig";
import { STORE_URL } from "@/core/storeLinks";

/**
 * ====== 🆕 `GET /api/v1/app/config` — لافتةُ «حدّث التطبيق» (خطّةُ Loopz+ v2، المرحلة ٠) ======
 *
 * 🔑 **ثابتٌ في الكود** كمفاتيح `app/flags` (D-1140): التشغيلُ رقعةُ ويبٍ بسطرٍ واحد، بلا هجرةٍ ولا متغيّرِ بيئةٍ ولا بناءٍ أصليّ.
 * **مطفأةٌ اليوم** (`MIN_VERSION = null`): تُشغَّل يومَ يصير 1.14.0 في المتجرين — فيرى 1.13.x لافتةً تأخذه إليه، لأنّه لا يصله
 * تحديثٌ عبر الهواء بعد تغيّر البصمة.
 * ⚖️ **عامٌّ بلا هويّة** ويُخزَّن دقيقة: التطبيقُ يسأل قبل أن يملك رمزاً، والردُّ واحدٌ للجميع.
 */
const MIN_VERSION: string | null = null;

/**
 * 🆕 T535 — **شاشةُ التحديث الإلزاميّة، رقمٌ لكلِّ منصّة** (أحمد ٢٤ نوفمبر: «الزامية من اول مره» · «١ أ»).
 * ⚠️ **لا يُضبط رقمٌ إلّا بعد أن تظهر النسخةُ في متجر منصّته للجميع** (آبل: بعد الاعتماد · جوجل: بعد اكتمال النشر لا
 * التدريجيّ) — وبكلمة أحمد: من دونها لحظةَ التشغيل يقف كلُّ صاحب نسخةٍ أقدم أمام زرٍّ لا يجد ما يُحدِّث إليه.
 */
const MIN_VERSIONS: AppConfig["min_versions"] = { ios: null, android: null };

/** 🆕 T535 — «ما الجديد» في الإصدار المطلوب (الفكرة «ب»). يُكتب مع كلِّ رقم؛ فارغاً تبقى الشاشةُ بجملتها وزرّها */
const WHATS_NEW: WhatsNewItem[] = [];

const CONFIG: AppConfig = {
  min_version: MIN_VERSION,
  min_versions: MIN_VERSIONS,
  whats_new: WHATS_NEW,
  /* 🆕 المهمة ٣٧٠ — الرابطان من `core/storeLinks.ts` (صفحةُ الدعوة تقرؤهما أيضاً) */
  store_url: { ...STORE_URL },
};

export async function GET() {
  return handle(async () => ok(CONFIG, []), { cacheControl: "public, max-age=60, s-maxage=60", open: true });
}
