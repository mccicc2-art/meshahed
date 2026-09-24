import { AppState } from "react-native";
import Constants from "expo-constants";
import * as Updates from "expo-updates";

/**
 * ====== هويّةُ الـJS الذي يعمل + التحقّقُ عند العودة — Phase 11-K · K0 ======
 *
 * **لماذا**: بعد التحديثات عبر الهواء يبقى رقمُ الإصدار ثابتاً على ثنائيٍّ واحد
 * وتتبدّل تحته حزمُ JS — فالرقمُ وحدَه لا يقول أيَّ كودٍ سقط أو أيَّ كودٍ قيس.
 * `BUILD_TAG` = الإصدار، ثمّ أوّلُ ثمانيةِ أحرفٍ من `updateId` إن كان الجاري تحديثاً
 * لا الحزمةَ المدمجة (`1.12.0_a1b2c3d4`) — يمرّ في نمط الخادم `^[\w.]{1,16}$`
 * كما هو، فلا يتغيّر في الويب شيء.
 *
 * ⚖️ **التحقّقُ عند العودة من الخلفيّة** يكمّل `checkAutomatically: ON_LOAD`: من
 * يترك التطبيقَ في الخلفيّة أيّاماً لا يمرّ بإقلاعٍ بارد. نُنزّل التحديثَ ولا نطبّقه —
 * **إعادةُ تحميلٍ في منتصف الاستعمال أسوأُ من يومٍ بلا إصلاح**؛ يُطبَّق في الإقلاع
 * التالي. مرّةً كلَّ ٣٠ دقيقة على الأكثر، والفشلُ صمت.
 */
const VERSION = Constants.expoConfig?.version ?? "0";
const UPDATE_SHORT =
  Updates.isEnabled && !Updates.isEmbeddedLaunch && Updates.updateId ? `_${Updates.updateId.replace(/-/g, "").slice(0, 8)}` : "";

export const BUILD_TAG = `${VERSION}${UPDATE_SHORT}`;

const RESUME_GAP_MS = 30 * 60_000;
let lastCheck = Date.now();
let busy = false;

async function checkOnResume() {
  if (busy || !Updates.isEnabled || __DEV__) return;
  if (Date.now() - lastCheck < RESUME_GAP_MS) return;
  busy = true;
  lastCheck = Date.now();
  try {
    const r = await Updates.checkForUpdateAsync();
    if (r.isAvailable) await Updates.fetchUpdateAsync();
  } catch {
    /* بلا شبكة أو خادمٌ مشغول — المحاولةُ التالية بعد نصف ساعة */
  } finally {
    busy = false;
  }
}

AppState.addEventListener("change", (s) => {
  if (s === "active") void checkOnResume();
});
