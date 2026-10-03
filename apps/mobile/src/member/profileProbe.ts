import { useEffect, useLayoutEffect, useState } from "react";
import { afterPaint, mark } from "../perfMarks";
import { uiFramesStart, type UiWindow } from "../uiFrames";

/**
 * ====== عدّاداتُ فتح ملفّ الشخص — D-1239 (قياسٌ فقط) ======
 *
 * **لماذا**: `profile.open` من الكاش وسيطُه ٤٩٠ms على جهازٍ رائد (صفحةُ العمل من الكاش ٦٨) — ولا يُعرف من القراءة
 * أين تذهب: في الدفع والانزلاق؟ في رسم الرأس؟ في رسم الألواح بعد قياس الرأس (D-1222)؟ أم في لصق العروض على خيط
 * الواجهة؟ وإصلاحٌ قبل معرفته تخمين (D-152). العلامةُ نفسُها تحمل الآن مراحلَها — **بمفاتيحَ يقبلها الخادمُ أصلاً**:
 * - `go` — ms من الضغطة (`openProfile`) إلى تركيب الشاشة: التنقّلُ وتقييمُ الشاشة قبل أن يبدأ عدُّ `ms`.
 * - `first` — ms من التركيب إلى أوّل التزام (هيكلٌ أو رأس).
 * - `cs` — ms إلى أوّل التزامٍ فيه حمولة (الرأس) · `ce` — ms إلى الالتزام الذي رُسم فيه الجسم (الألواح).
 *   `ce − cs` = ثمنُ الالتزام الثاني حين لا يُعرف طولُ الرأس.
 * - `ready` — ١ إن عُرف طولُ الرأس عند التركيب (زيارةٌ سابقةٌ في الجلسة ⇒ التزامٌ واحد).
 * - `roots` — رسماتُ جذر الشاشة حتى اكتمالها · `from` — من فتحها.
 * - `ud` · `ug` · `ut` · `uf` — خيطُ الواجهة في النافذة نفسِها (`uiFrames.ts`).
 *
 * 🔑 **`ms` لم يتغيّر تعريفُه** (من التركيب إلى إطارين بعد أوّل التزامٍ فيه حمولة) فالأرقامُ تُقارن بما قبلها؛ العلامةُ
 * فقط تُكتب متأخّرةً — بعد أن يُرسم الجسمُ — لتحمل `ce` ورقمَ خيط الواجهة. شاشةٌ أُغلقت قبل ذلك لا تكتب شيئاً، كما كانت.
 */
let tappedAt = 0;
/** الضغطةُ التي تفتح ملفّاً (`openProfile`) — تُقرأ مرّةً عند تركيب الشاشة التالية */
export function profileTapped() {
  tappedAt = performance.now();
}

type Probe = { t0: number; go?: number; first?: number; cs?: number; ce?: number; ms?: number; painted: boolean; roots: number; done: boolean; ui: UiWindow };

export function useProfileProbe({ cached, hasData, hasBody, headKnown, from }: { cached: boolean; hasData: boolean; hasBody: boolean; headKnown: boolean; from: string }) {
  const [p] = useState<Probe & { ready: number }>(() => {
    const t0 = performance.now();
    const go = tappedAt > 0 && t0 - tappedAt < 3000 ? t0 - tappedAt : undefined;
    tappedAt = 0;
    return { t0, go, painted: false, roots: 0, done: false, ui: uiFramesStart(), ready: headKnown ? 1 : 0 };
  });
  if (!p.done) p.roots += 1;
  useLayoutEffect(() => {
    if (p.done) return;
    const at = performance.now() - p.t0;
    if (p.first === undefined) p.first = at;
    const finish = () => {
      if (p.done || p.ms === undefined || !p.painted) return;
      p.done = true;
      const ms = p.ms;
      const extra = {
        cached: cached ? 1 : 0,
        from,
        ...(p.go !== undefined ? { go: Math.round(p.go) } : {}),
        first: Math.round(p.first ?? 0),
        cs: Math.round(p.cs ?? 0),
        ce: Math.round(p.ce ?? 0),
        ready: p.ready,
        roots: p.roots,
      };
      p.ui.stop((u) => mark("profile.open", ms, u ? { ...extra, ...u } : extra));
    };
    if (hasData && p.cs === undefined) {
      p.cs = at;
      afterPaint(() => {
        p.ms = performance.now() - p.t0;
        finish();
      });
    }
    if (hasBody && p.ce === undefined) {
      p.ce = at;
      afterPaint(() => {
        p.painted = true;
        finish();
      });
    }
  });
  /* شاشةٌ أُغلقت قبل أن تكتمل: الحلقةُ على خيط الواجهة لا تبقى دائرة */
  useEffect(
    () => () => {
      if (!p.done) {
        p.done = true;
        p.ui.cancel();
      }
    },
    [p],
  );
}
