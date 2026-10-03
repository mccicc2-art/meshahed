import { makeMutable } from "react-native-reanimated";
import { scheduleOnRN, scheduleOnUI } from "react-native-worklets";

/**
 * ====== مسبارُ خيط الواجهة في نافذة تبديل التبويب — D-1235 (قياسٌ فقط) ======
 *
 * **لماذا**: بعد D-1231 بقي أكبرُ جزءٍ من `tab.switch` هو ما بعد الظهور (٦٣–٨٦ms) — وهو واحدٌ في كلِّ الجذور.
 * `drop` يعدّ ما ضاع على خيط JS وحدَه، فلا يقول إن كان الانتظارُ في كودنا أم في أندرويد وهو يُلصق عروضَ الشاشة
 * ويرسمها («اكتشف» تُبقي ~٧٧ بطاقةً مركّبة). والعلاجان مختلفان: تأجيلُ عملٍ في JS، أو عروضٌ أصليّةٌ أقلّ، أو
 * قبولُه حدّاً للجهاز — وإصلاحٌ قبل معرفة الخيط تخمين (D-152).
 *
 * 🔑 **الحلقةُ على خيط الواجهة نفسِه** (`requestAnimationFrame` في وقت تشغيل Reanimated — فكرةُ `gesture.jank`
 * بـ`thread=ui`، D-1140): نداءُ الإطار يجري على الخيط الذي يُلصق العروض، فإن انشغل تأخّر النداءُ وظهرت الفجوة.
 * - `ud` — إطاراتٌ ضاعت على خيط الواجهة في النافذة (ميزانيّةُ 60Hz الثابتةُ كـ`drop`، فيُقارَن الرقمان).
 * - `ug` — أطولُ فجوةٍ بين إطارين (ms): لا تتعلّق بتردّد الشاشة، وتُرى بها وقفةٌ أقصرُ من عتبة `ud` على 120Hz.
 * - `ut` — ms من أوّل إطارٍ في النافذة إلى بداية تلك الفجوة: يُقارَن بـ`focus` ليُعرف أهي قبل الظهور أم بعده.
 * - `uf` — عددُ الإطارات التي وصلت: `uf` صغيرٌ مع نافذةٍ طويلة = الخيطُ كان واقفاً.
 *
 * 🔑 **الإغلاقُ ينتظر إطاراً واحداً بعد طلبه**: لو كان الخيطُ واقفاً لحظةَ الطلب لَسبق الإغلاقُ الإطارَ الذي يحمل
 * الفجوةَ فضاعت — وهي ما نبحث عنه. فالطلبُ يعلّم، والإطارُ التالي يسجّل فجوتَه ثمّ يبلّغ.
 *
 * ⚖️ **ما لا يراه**: خيطُ الرسم (`RenderThread`/GPU) — نداءُ الإطار على الخيط الرئيس. و**قياسٌ لا يُسقط ما
 * يقيسه**: كلُّ عبورٍ إلى خيط الواجهة في `try`، وإن لم يعد الرقمُ خلال `REPORT_WAIT_MS` كُتبت العلامةُ بلا هذه المفاتيح.
 */
const FRAME_MS = 1000 / 60;
const REPORT_WAIT_MS = 400;

export type UiFrames = { ud: number; ug: number; ut: number; uf: number };
export type UiWindow = {
  /** يطلب الرقمَ ويُغلق النافذة — `done` تُنادى مرّةً واحدة، بـ`null` إن لم يصل شيء */
  stop: (done: (r: UiFrames | null) => void) => void;
  /** يُطفئ الحلقةَ بلا رقم (ضغطةٌ لم تصل، أو ضغطةٌ جديدةٌ سبقت) */
  cancel: () => void;
};

/* هويّةُ النافذة الحيّة (٠ = لا حلقة) والنافذةِ التي طُلب إغلاقُها — عددان فقط يعبران بين الخيطين */
const liveId = makeMutable(0);
const closingId = makeMutable(0);

let seq = 0;
const waiting = new Map<number, (r: UiFrames | null) => void>();

function settle(id: number, r: UiFrames | null) {
  const done = waiting.get(id);
  if (!done) return;
  waiting.delete(id);
  done(r);
}
function uiDone(id: number, ud: number, ug: number, ut: number, uf: number) {
  settle(id, { ud, ug: Math.round(ug), ut: Math.round(ut), uf });
}

function uiStart(id: number) {
  "worklet";
  liveId.value = id;
  /* متغيّراتُ الحلقة محلّيّةٌ في خيط الواجهة: لا قيمةَ مشتركةً تُكتب في كلِّ إطار */
  let t0 = -1;
  let last = -1;
  let dropped = 0;
  let maxGap = 0;
  let maxAt = 0;
  let frames = 0;
  const tick = (ts: number) => {
    if (liveId.value !== id) return;
    if (t0 < 0) t0 = ts;
    else {
      const gap = ts - last;
      frames += 1;
      if (gap > FRAME_MS * 1.5) dropped += Math.round(gap / FRAME_MS) - 1;
      if (gap > maxGap) {
        maxGap = gap;
        maxAt = last - t0;
      }
    }
    last = ts;
    if (closingId.value === id) {
      liveId.value = 0;
      scheduleOnRN(uiDone, id, dropped, maxGap, maxAt, frames);
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
function uiClose(id: number) {
  "worklet";
  if (liveId.value === id) closingId.value = id;
}
function uiCancel(id: number) {
  "worklet";
  if (liveId.value === id) liveId.value = 0;
}

export function uiFramesStart(): UiWindow {
  const id = ++seq;
  let open = true;
  try {
    scheduleOnUI(uiStart, id);
  } catch {
    open = false;
  }
  return {
    stop(done) {
      if (!open) return done(null);
      open = false;
      waiting.set(id, done);
      try {
        scheduleOnUI(uiClose, id);
      } catch {
        return settle(id, null);
      }
      setTimeout(() => {
        if (!waiting.has(id)) return;
        settle(id, null);
        try {
          scheduleOnUI(uiCancel, id);
        } catch {
          /* لا خيطَ واجهةٍ يُطفأ */
        }
      }, REPORT_WAIT_MS);
    },
    cancel() {
      if (!open) return;
      open = false;
      try {
        scheduleOnUI(uiCancel, id);
      } catch {
        /* لا خيطَ واجهةٍ يُطفأ */
      }
    },
  };
}
