import { handle } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import type { AppConfig } from "@/core/contracts/appConfig";

/**
 * ====== 🆕 `GET /api/v1/app/config` — لافتةُ «حدّث التطبيق» (خطّةُ Loopz+ v2، المرحلة ٠) ======
 *
 * 🔑 **ثابتٌ في الكود** كمفاتيح `app/flags` (D-1140): التشغيلُ رقعةُ ويبٍ بسطرٍ واحد، بلا هجرةٍ ولا متغيّرِ بيئةٍ ولا بناءٍ أصليّ.
 * **مطفأةٌ اليوم** (`MIN_VERSION = null`): تُشغَّل يومَ يصير 1.14.0 في المتجرين — فيرى 1.13.x لافتةً تأخذه إليه، لأنّه لا يصله
 * تحديثٌ عبر الهواء بعد تغيّر البصمة.
 * ⚖️ **عامٌّ بلا هويّة** ويُخزَّن دقيقة: التطبيقُ يسأل قبل أن يملك رمزاً، والردُّ واحدٌ للجميع.
 */
const MIN_VERSION: string | null = null;

const CONFIG: AppConfig = {
  min_version: MIN_VERSION,
  store_url: {
    /* ascAppId في `apps/mobile/eas.json` */
    ios: "https://apps.apple.com/app/id6820369011",
    android: "https://play.google.com/store/apps/details?id=com.loopztv.app",
  },
};

export async function GET() {
  return handle(async () => ok(CONFIG, []), { cacheControl: "public, max-age=60, s-maxage=60", open: true });
}
