import { useEffect, useRef } from "react";
import * as SecureStore from "expo-secure-store";
import * as Updates from "expo-updates";
import { opening } from "./opening/opening";
import { mark } from "./perfMarks";

/**
 * ====== 🆕 1.14.1 — التحديثُ الهوائيُّ في أوّل فتحةٍ بعد التثبيت (قرارُ أحمد ١٥ نوفمبر: «اي احد يحمل مباشرة عنده التحديثات
 * الهوائية ف ما يحتاج يطلع ويدخل عشان تجيه»، ثمّ «١أ ٢أ») ======
 *
 * **لماذا**: `checkAutomatically: ON_LOAD` مع `fallbackToCacheTimeout: 0` يفتح التطبيقَ فوراً على الحزمة المدمجة في البناء،
 * ويُنزّل الأحدثَ في الخلفيّة ليُطبَّق في الفتحة التالية. فمن ثبّت التطبيقَ من المتجر يرى في أوّل جلسةٍ كودَ يومِ البناء —
 * جولةً قديمة، وبلا طلب إذن الإشعارات، وبلا كلِّ ما رُفع بعده — حتى يغلقه ويفتحه.
 *
 * **ما يجري**: في **أوّل** إقلاعٍ على الحزمة المدمجة لهذا البناء (`isEmbeddedLaunch`، ولم يُرَ `runtimeVersion` هذا من قبل)
 * يُمسك ستارَ الفتح (`opening.hold`) بينما يفحص `expo-updates` ويُنزّل بنفسه (فحصُ الإقلاع الأصليّ، لا فحصٌ ثانٍ منّا يتزاحم معه):
 *  - نزل تحديثٌ قبل ثلاث ثوانٍ ⇐ إعادةُ تحميلٍ والستارُ ما زال معتماً (الإمساكُ يمنع انكشافه، وسقفُه الخاصُّ خمسُ ثوانٍ بعد
 *    ظهوره — دائماً بعد قرارنا)، والإقلاعُ التالي يبدأ بالستار الهادئ (D-1463)؛
 *  - لا تحديث / خطأ / مرّت الثواني الثلاث ⇐ يُفلت الستارُ ويمضي على المدمجة، وما نزل متأخّراً يُطبَّق في الفتحة التالية كالمعتاد.
 * ⚖️ **الأعضاءُ الحاليّون لا يتغيّر عليهم شيء** («٢أ»): من يعمل على تحديثٍ هوائيٍّ ليس في إقلاعٍ مدمج، فلا إمساكَ ولا إعادة.
 * ⚖️ **أوّلُ فتحةٍ لا كلُّ فتحة** (المراجعةُ المستقلّة): البناءُ يُعلَّم «رُئي» بعد القرار — فمن بقي بلا شبكةٍ لا ينتظر كلَّ مرّة.
 * ⚖️ **لا حلقة**: إقلاعُ الطوارئ مستثنى، وتحديثٌ أُعيد التحميلُ إليه مرّةً لا يُعاد إليه ثانيةً.
 * 🔴 **لا ستارَ عالقاً** (المراجعةُ المستقلّة): لا نطلب `opening.cover()` هنا — ذاك يقفل الستارَ عن الإفلات، فلو رفضت
 *   `reloadAsync` لبقي الأسودُ يبتلع اللمس. الستارُ معتمٌ أصلاً لحظةَ القرار، والرفضُ يُفلته ويمحو علامةَ الستار الهادئ.
 * 📏 `ota.first` — ms من الإقلاع إلى القرار، و`result` = applied · none · cap · err. «applied» يُحفظ في المخزن قبل الإعادة
 *   ويُرسل من الإقلاع التالي، لأنّ الإعادةَ تهدم مخزنَ العلامات في الذاكرة قبل أن يُرسَل.
 */
const CAP_MS = 3000;
const TRIED_KEY = "loopz.ota.firstTried";
const SEEN_KEY = "loopz.ota.firstSeen";
const APPLIED_KEY = "loopz.ota.appliedMs";

function read(key: string): string | null {
  try {
    return SecureStore.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) void SecureStore.deleteItemAsync(key).catch(() => {});
    else SecureStore.setItem(key, value);
  } catch {
    /* المخزنُ تعذّر — أسوأُ ما فيه انتظارٌ ثانٍ أو علامةٌ لا تصل */
  }
}

/* «applied» من الإقلاع السابق: يُرسل الآن ويُمحى */
const appliedMs = read(APPLIED_KEY);
if (appliedMs !== null) {
  write(APPLIED_KEY, null);
  if (!Updates.isEmbeddedLaunch && Number.isFinite(Number(appliedMs))) mark("ota.first", Number(appliedMs), { result: "applied" });
}

const runtime = Updates.runtimeVersion ?? "";
const active =
  Updates.isEnabled && !__DEV__ && Updates.isEmbeddedLaunch && !Updates.isEmergencyLaunch && !!runtime && read(SEEN_KEY) !== runtime;
const t0 = Date.now();
/* يُمسك الستارَ لحظةَ تحميل الوحدة — قبل أن تقول أيُّ شاشةٍ إنّها جاهزة */
const release = active ? opening.hold() : () => {};

let decided = false;
function decide(result: "applied" | "none" | "cap" | "err") {
  if (decided) return;
  decided = true;
  write(SEEN_KEY, runtime);
  if (result === "applied") {
    write(APPLIED_KEY, String(Date.now() - t0));
    return;
  }
  mark("ota.first", Date.now() - t0, { result });
  release();
}

if (active) setTimeout(() => decide("cap"), CAP_MS);

/** يُرسم مرّةً في الجذر؛ لا يرسم شيئاً — يقرأ حالَ `expo-updates` ويقرّر، ثمّ يصمت */
export function FirstLaunchUpdate() {
  return active ? <Watcher /> : null;
}

function Watcher() {
  const u = Updates.useUpdates();
  const applying = useRef(false);
  const pendingId = u.downloadedUpdate?.updateId;

  useEffect(() => {
    if (decided || applying.current) return;
    if (u.isUpdatePending) {
      /* نزل التحديثُ نفسُه الذي أُعيد التحميلُ إليه مرّةً ورجع الإقلاعُ مدمجاً ⇐ لا إعادةَ ثانية؛ يُطبَّق في الفتحة التالية */
      if (pendingId && read(TRIED_KEY) === pendingId) return decide("none");
      applying.current = true;
      if (pendingId) write(TRIED_KEY, pendingId);
      decide("applied");
      opening.skipNext();
      Updates.reloadAsync({ reloadScreenOptions: { backgroundColor: "#050505", spinner: { enabled: false }, fade: true } }).catch(() => {
        /* الإعادةُ رُفضت ⇐ الستارُ يُفلت والجلسةُ تمضي على المدمجة، والإقلاعُ التالي بأنميشنه لا بالستار الهادئ */
        write(APPLIED_KEY, null);
        opening.clearSkip();
        mark("ota.first", Date.now() - t0, { result: "err" });
        release();
      });
      return;
    }
    if (u.checkError || u.downloadError) return decide("err");
    const idle = !u.isStartupProcedureRunning && !u.isChecking && !u.isDownloading;
    /* انتهى فحصُ الإقلاع ولا شيءَ يُنزَّل ⇐ لا انتظارَ بعد الآن */
    if (idle && u.lastCheckForUpdateTimeSinceRestart) return decide("none");
    /* إعادةُ تحميلٍ طلبها التطبيقُ (تصحيحُ الاتّجاه D-1502) تُصفّر الحالَ ولا يُعاد فحصُ الإقلاع ⇐ لا شيءَ ننتظره */
    if (idle && u.restartCount > 0) decide("none");
  }, [u.isUpdatePending, u.isStartupProcedureRunning, u.isChecking, u.isDownloading, u.checkError, u.downloadError, u.lastCheckForUpdateTimeSinceRestart, u.restartCount, pendingId]);

  return null;
}
