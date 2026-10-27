import { makeMutable, withTiming, Easing } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import type { NativeRoot } from "../shell";

/**
 * ====== 🆕 D-1505 · D-1506 — حالةُ القائمة الجانبيّة: مخزنٌ خارج React وقيمةُ حركةٍ واحدة ======
 *
 * تُفتح من صورة الحساب (الرئيسيّة وطرفُ ترويسات التبويبات) **ومن سحبةٍ في الرئيسيّة** (D-1506): يمينٌ في الإنجليزيّة، يسارٌ في
 * العربيّة — نحو داخل الشاشة من طرف القائمة.
 *
 * 🔑 **`drawerP` قيمةٌ واحدةٌ على خيط الواجهة** (٠ مغلقة · ١ مفتوحة): الزرُّ يحرّكها بمنحنى، والإصبعُ يحرّكها بنفسه في الرئيسيّة
 * وعلى اللوح — فالقائمةُ **تتبع الإصبع** ولو انشغل JS، ويكمل الإفلاتُ من حيث وقف (نهجُ K2 في `TabSlide`).
 * و`from` حالةُ React: من أيِّ جذرٍ فُتحت — `null` = مغلقةٌ تماماً (لا تأخذ لمساً). يُضبط قبل أن تتحرّك ويُصفَّر بعد أن تستقرّ.
 */
export const DRAWER_MS = 220;
const PANEL_MAX = 296;
/** عرضُ اللوح — دالّةٌ واحدةٌ يقرؤها اللوحُ وسحبةُ الرئيسيّة (نسبةُ الإصبع من العرض نفسِه) */
export function drawerWidth(screen: number): number {
  "worklet";
  return Math.min(PANEL_MAX, Math.round(screen * 0.82));
}

export const drawerP = makeMutable(0);

let from: NativeRoot | null = null;
let after: (() => void) | null = null;
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());

function settled() {
  from = null;
  notify();
  const f = after;
  after = null;
  f?.();
}

export const drawerStore = {
  subscribe(f: () => void) {
    subs.add(f);
    return () => {
      subs.delete(f);
    };
  },
  get: () => from,
  /** الزرُّ: تُضبط الحالةُ ثمّ تنزلق — اللوحُ مركَّبٌ مسبقاً فلا ينتظر شيئاً (D-1506) */
  open(root: NativeRoot) {
    from = root;
    notify();
    drawerP.value = withTiming(1, { duration: DRAWER_MS, easing: Easing.out(Easing.cubic) });
  },
  /** الإصبعُ بدأ يسحب في الرئيسيّة: اللوحُ يأخذ اللمسَ ويُعلن نفسَه، والإصبعُ يحرّك `drawerP` */
  beginDrag(root: NativeRoot) {
    if (from) return;
    from = root;
    notify();
  },
  /** إغلاقٌ بمنحنى، و`then` بعد أن يستقرّ (الوجهةُ تُدفع بعد أن تختفي القائمة) */
  close(then?: () => void) {
    if (!from) {
      then?.();
      return;
    }
    after = then ?? null;
    drawerP.value = withTiming(0, { duration: DRAWER_MS, easing: Easing.in(Easing.quad) }, (done) => {
      if (done) scheduleOnRN(settled);
    });
  },
  /** إفلاتُ إصبعٍ لم يبلغ العتبة — اللوحُ عاد إلى الصفر على خيط الواجهة، وهذه تُصفّر الحالة */
  settled,
};
