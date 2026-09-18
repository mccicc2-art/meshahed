import { AppState, Platform } from "react-native";
import Constants from "expo-constants";
import { launchT0 } from "./perf";
import { api } from "./api";
import { session } from "./session";

/**
 * ====== علاماتُ الأداء في الشاشات الأصليّة — Phase 11-F · F0 (D-1024) ======
 *
 * **لماذا**: كلُّ ما في Phase 11-F مبنيٌّ على قراءة الكود لا على قياس — الحاويةُ
 * لا تصل الهاتف، و`perfMs` لا يُنادى إلّا في `web.tsx` وبـ`console.log`. فالتطبيقُ
 * يقيس نفسَه على هاتف صاحبه ويرسل الأرقام، **فنعرف ما قبل F1 وما بعدها** بدل
 * أن نخمّن.
 *
 * 🔑 **ملفٌّ ثانٍ لا `perf.ts` نفسُه**: `perf.ts` يُستورد أوّلاً في `index.ts` كي
 * يكون صفرُ الساعة أوّلَ كودٍ يُقيَّم — واستيرادُ `api` هناك كان سيقيّم العميلَ
 * و`auth` وSupabase **قبل** أخذ الصفر فيكذب الرقم.
 *
 * ⚖️ **صفرُ هويّةٍ وصفرُ نصٍّ حرّ** (نهجُ D-881): الاسمُ من قائمةٍ ثابتةٍ يتحقّق
 * منها الخادم، والقيمُ أرقامٌ، و`tab`/`screen` من قوائمَ مغلقة. والإرسالُ مجمَّعٌ:
 * مرّةً كلَّ ٣٠ ثانية على الأكثر وعند نزول التطبيق إلى الخلفيّة — **قياسٌ يثقل
 * ما يقيسه قياسٌ فاسد.** وضياعُ دفعةٍ لا يُقلق أحداً.
 */
export type PerfName =
  | "library.open"
  | "library.shelf.open"
  | "library.flatgrid"
  | "tab.arm"
  | "discover.open"
  | "coldstart.library";

type Extra = Record<string, number | string>;
type Mark = { name: PerfName; ms: number; extra?: Extra };

const FLUSH_MS = 30_000;
const MAX_BUFFER = 40;
const APP_VERSION = Constants.expoConfig?.version ?? "0";
const MODEL = Platform.OS === "android" ? String((Platform.constants as { Model?: string }).Model ?? "android") : Platform.OS;

let buffer: Mark[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let lastFlush = 0;

function flush() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  /* بلا رمزٍ لا نداء: `api()` كان سيطلب رمزاً من الـWebView لأجل قياس — لا يستحقّ */
  if (buffer.length === 0 || !session.has()) return;
  const marks = buffer;
  buffer = [];
  lastFlush = Date.now();
  void api("/api/v1/app/perf", { method: "POST", body: { marks, version: APP_VERSION, model: MODEL } }).catch(() => {});
}

export function mark(name: PerfName, ms: number, extra?: Extra) {
  if (!Number.isFinite(ms) || ms < 0) return;
  if (buffer.length >= MAX_BUFFER) buffer.shift();
  buffer.push({ name, ms: Math.round(ms), ...(extra ? { extra } : {}) });
  if (!timer) timer = setTimeout(flush, Math.max(2_000, FLUSH_MS - (Date.now() - lastFlush)));
}

/** علامةٌ بطرفين: تُفتح الآن وتُغلق مرّةً واحدة — نداءٌ ثانٍ للإغلاق لا يكتب شيئاً */
export function span(name: PerfName, extra?: Extra): (more?: Extra) => void {
  const t0 = performance.now();
  let done = false;
  return (more) => {
    if (done) return;
    done = true;
    mark(name, performance.now() - t0, extra || more ? { ...extra, ...more } : undefined);
  };
}

/** «بعد أن تُرسم»: إطاران بعد الالتزام — الأوّلُ يُنهي التخطيط والثاني يصل الشاشة */
export function afterPaint(fn: () => void) {
  requestAnimationFrame(() => requestAnimationFrame(fn));
}

/** الإقلاعُ البارد إلى أوّل شاشةٍ أصليّة — يُكتب مرّةً في عمر العمليّة */
let coldDone = false;
export function coldStartOnce(name: "coldstart.library") {
  if (coldDone) return;
  coldDone = true;
  mark(name, performance.now() - launchT0);
}
/** شاشةٌ أصليّةٌ أخرى فُتحت أوّلاً ⇒ الإقلاعُ لم يعد «إلى المكتبة» فلا يُسجَّل */
export function coldStartVoid() {
  coldDone = true;
}

AppState.addEventListener("change", (s) => {
  if (s !== "active") flush();
});
