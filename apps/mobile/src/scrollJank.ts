import { makeMutable } from "react-native-reanimated";
import { scheduleOnRN, scheduleOnUI } from "react-native-worklets";
import { frameCounter, scrollSample } from "./perfMarks";

/**
 * ====== عدّادُ إطارات التمرير — D-1334 ======
 *
 * **لماذا**: `scroll.jank` (شرحُه في `perfMarks.ts`) يحتاج من يقول «بدأ الإصبعُ التمرير» و«وقف الانزلاق» ويعدّ
 * الإطاراتِ بينهما **على خيط الواجهة** — الخيطِ الذي يحرّك التمريرَ فعلاً؛ خيطُ JS قد يقف والتمريرُ يمشي.
 *
 * 🔑 **جلسةٌ واحدةٌ للتطبيق كلِّه لا عدّادٌ لكلِّ قائمة**: «اكتشف» تحمل عشرةَ صفوفٍ أفقيّةٍ في عمودٍ واحد — عدّادٌ
 * لكلٍّ منها كان سيزرع عشرَ حلقاتٍ على خيط الواجهة ليقيس واحدة. الإصبعُ يحرّك قائمةً واحدةً في المرّة، فحلقةٌ
 * واحدةٌ تكفي: تبدأ عند `onScrollBeginDrag` وتنطفئ عند وقوف الانزلاق. **خارج التمرير لا شيءَ يدور** — قياسٌ
 * يثقل ما يقيسه قياسٌ فاسد.
 *
 * 🔑 **حدودُ الجلسة**: من لمس الإصبع إلى `onMomentumScrollEnd`؛ وإن رفع بلا انزلاقٍ فبعد `SETTLE_MS` من الرفع
 * (iOS لا يعلن انزلاقاً لم يحدث). إصبعٌ يلتقط القائمةَ نفسَها وهي تنزلق يكمل الجلسةَ نفسَها. قائمةٌ أخرى تبدأ
 * (صفٌّ أفقيٌّ والعمودُ ما زال ينزلق) تُنهي الأولى وتفتح جلستَها.
 *
 * ⚖️ **جلسةٌ بلغت `CAP_MS` تُرمى ولا تُسجَّل**: معناها أنّ نهايتَها لم تُعلَن (شاشةٌ جُمّدت تحت الإصبع، أو منصّةٌ
 * لم ترسل نهايةَ الانزلاق) — ومدّتُها حينها وقتُ انتظارٍ لا تمرير، يذيب الإطاراتِ الضائعةَ في معدّلٍ كاذب.
 *
 * ⚖️ **وكلُّ فشلٍ هنا صمت**: إن لم تُنشأ القيمُ المشتركة أو رفض خيطُ الواجهة الجدولة، ينطفئ العدّادُ لبقيّة
 * العمليّة — التمريرُ لا ينكسر لأجل رقم.
 */
const UI_FRAME_MS = 1000 / 60;
const SETTLE_MS = 150;
const CAP_MS = 8_000;

type Src = "v" | "h";
type Ui = { start: (id: number) => void; stop: (id: number) => void };

/* `undefined` = لم يُجرَّب · `null` = فشل فانطفأ */
let ui: Ui | null | undefined;

function build(): Ui {
  const sid = makeMutable(0);
  const t0 = makeMutable(-1);
  const last = makeMutable(-1);
  const drop = makeMutable(0);
  const worst = makeMutable(0);
  const frames = makeMutable(0);
  const start = (id: number) => {
    "worklet";
    sid.value = id;
    t0.value = -1;
    last.value = -1;
    drop.value = 0;
    worst.value = 0;
    frames.value = 0;
    const tick = (ts: number) => {
      /* جلسةٌ أحدثُ أخذت الرقم، أو أُوقفت ⇒ هذه الحلقةُ تنتهي */
      if (sid.value !== id) return;
      if (t0.value < 0) t0.value = ts;
      else {
        const gap = ts - last.value;
        frames.value += 1;
        if (gap > worst.value) worst.value = gap;
        if (gap > UI_FRAME_MS * 1.5) drop.value += Math.round(gap / UI_FRAME_MS) - 1;
      }
      last.value = ts;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const stop = (id: number) => {
    "worklet";
    if (sid.value !== id) return;
    sid.value = 0;
    const dur = t0.value >= 0 ? last.value - t0.value : 0;
    scheduleOnRN(uiDone, id, drop.value, dur, worst.value, frames.value);
  };
  return { start, stop };
}

type Live = {
  id: number;
  key: string;
  screen: string;
  src: Src;
  tab?: string;
  stopJs: () => number;
  settle: ReturnType<typeof setTimeout> | null;
  cap: ReturnType<typeof setTimeout>;
};
let nextId = 0;
let cur: Live | null = null;
/* جلساتٌ أُوقفت وتنتظر رقمَ خيط الواجهة */
const waiting = new Map<number, { screen: string; src: Src; tab?: string; js: number }>();

function uiDone(id: number, dropped: number, dur: number, worstGap: number, frameCount: number) {
  const w = waiting.get(id);
  if (!w) return;
  waiting.delete(id);
  scrollSample({ screen: w.screen, src: w.src, tab: w.tab, ui: dropped, js: w.js, dur, worst: worstGap, frames: frameCount });
}

function finish(keep: boolean) {
  const c = cur;
  if (!c) return;
  cur = null;
  if (c.settle) clearTimeout(c.settle);
  clearTimeout(c.cap);
  const js = c.stopJs();
  if (keep) waiting.set(c.id, { screen: c.screen, src: c.src, tab: c.tab, js });
  /* ما لم يُحفظ في `waiting` يصل رقمُه فلا يجد صاحباً فيُرمى */
  try {
    if (ui) scheduleOnUI(ui.stop, c.id);
  } catch {
    ui = null;
  }
  if (waiting.size > 8) waiting.clear();
}

function begin(key: string, screen: string, src: Src, tab?: string) {
  if (ui === null) return;
  if (cur) {
    if (cur.key === key) {
      /* الإصبعُ التقط القائمةَ نفسَها وهي تنزلق — الجلسةُ نفسُها تكمل */
      if (cur.settle) {
        clearTimeout(cur.settle);
        cur.settle = null;
      }
      return;
    }
    finish(true);
  }
  try {
    if (ui === undefined) ui = build();
    const id = ++nextId;
    scheduleOnUI(ui.start, id);
    cur = { id, key, screen, src, tab, stopJs: frameCounter(), settle: null, cap: setTimeout(() => finish(false), CAP_MS) };
  } catch {
    ui = null;
    cur = null;
  }
}
function release(key: string) {
  const c = cur;
  if (!c || c.key !== key) return;
  if (c.settle) clearTimeout(c.settle);
  c.settle = setTimeout(() => finish(true), SETTLE_MS);
}
function momentum(key: string) {
  const c = cur;
  if (!c || c.key !== key || !c.settle) return;
  clearTimeout(c.settle);
  c.settle = null;
}
function end(key: string) {
  if (cur && cur.key === key) finish(true);
}

export type ScrollJankProps = {
  onScrollBeginDrag: () => void;
  onScrollEndDrag: () => void;
  onMomentumScrollBegin: () => void;
  onMomentumScrollEnd: () => void;
};
const cache = new Map<string, ScrollJankProps>();
/**
 * خصائصُ القياس لقائمةٍ تمرّر — تُنشر على `ScrollView`/`FlatList`/`FlashList` (`{...scrollJank("discover", "v", tab)}`).
 * الكائنُ نفسُه يعود لكلِّ (شاشة · اتّجاه · تبويب) فلا يكسر `memo` ولا يعيد رسمَ القائمة.
 * الصفوفُ الأفقيّةُ في شاشةٍ واحدةٍ تتشارك المفتاح: الجمعُ لها كلِّها، والإصبعُ على واحدٍ منها في المرّة.
 */
export function scrollJank(screen: string, src: Src, tab?: string): ScrollJankProps {
  const key = `${screen}|${tab ?? ""}|${src}`;
  let p = cache.get(key);
  if (!p) {
    p = {
      onScrollBeginDrag: () => begin(key, screen, src, tab),
      onScrollEndDrag: () => release(key),
      onMomentumScrollBegin: () => momentum(key),
      onMomentumScrollEnd: () => end(key),
    };
    cache.set(key, p);
  }
  return p;
}
