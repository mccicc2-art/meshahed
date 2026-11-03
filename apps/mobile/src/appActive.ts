import { useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { mark } from "./perfMarks";

/**
 * ====== 🆕 D-1604 — الخروجُ من التطبيق يُلغي الإيماءاتِ المعلّقة ======
 *
 * **لماذا** (تسجيلُ خالد ٣٠ أكتوبر: «كنت حاط على صفحة المجتمع … رجعت عالتطبيق وضغطت الدوك لاكن ما يضغط»): الرأسُ والدوكُ
 * لا يستجيبان والوسطُ يُمرَّر، **ولا `js.hang` ولا `dock.miss` ولا `edge.tap`** — اللمسةُ لم تبلغ JS أصلاً. وعاد كلُّ شيءٍ حين
 * فُتحت ورقةُ البحث وأُغلقت. هو بلاغُ أحمد ٢٢ أكتوبر نفسُه (D-1536). المرجَّحُ — **لا المُثبَت**: إيماءةٌ أصليّةٌ (RNGH) بدأت
 * بلمسةٍ لحظةَ الخروج بسحبة النظام فلم يصلها رفعُ الإصبع، فبقيت معلّقةً تأخذ اللمسَ عند الحوافّ.
 *
 * فهنا أمران:
 * 1. **`useAppAway()`**: صحيحٌ ما دام التطبيقُ غيرَ نشط. السحباتُ تُطفأ به (`.enabled(!away)`) فتُلغى أيُّ إيماءةٍ جاريةٍ عند
 *    الخروج، وتعود نظيفةً عند الرجوع — ما تفعله الورقةُ حين تُفتح، بلا ورقة.
 * 2. **`gesture.stuck`**: كلُّ سحبةٍ تسجّل «إصبعٌ عليها» (`gestureProbe`)؛ خروجٌ والإصبعُ ما زال عليها في حسابها ⇒ علامةٌ عند
 *    الرجوع باسمها. فإن تكرّر البلاغُ ولا علامة، فالسببُ غيرُها ونعرف ذلك.
 */
let away = AppState.currentState != null && AppState.currentState !== "active";
const subs = new Set<() => void>();
const probes = new Map<string, () => boolean>();
let stuck: string[] = [];

AppState.addEventListener("change", (s) => {
  const next = s !== "active";
  if (next === away) return;
  if (next) {
    stuck = [];
    for (const [name, down] of probes) {
      try {
        if (down()) stuck.push(name);
      } catch {
        /* المقياسُ لا يكسر شيئاً */
      }
    }
  } else if (stuck.length) {
    mark("gesture.stuck", 0, { src: stuck.join("+") });
    stuck = [];
  }
  away = next;
  for (const f of subs) f();
});

function subscribe(f: () => void) {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
}

export function useAppAway(): boolean {
  return useSyncExternalStore(subscribe, () => away);
}

/** سحبةٌ تعلن «هل إصبعٌ عليها الآن» — تُقرأ لحظةَ الخروج وحدَها. يعيد ما يسحبها */
export function gestureProbe(name: string, down: () => boolean): () => void {
  probes.set(name, down);
  return () => {
    if (probes.get(name) === down) probes.delete(name);
  };
}
