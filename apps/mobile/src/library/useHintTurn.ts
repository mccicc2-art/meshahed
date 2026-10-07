import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { tourStore } from "../tour/store";

/**
 * ====== دورُ التلميح — أيُّ تلميحٍ يظهر في هذه الزيارة (🆕 D-1318 · Phase 11-T · T2) ======
 *
 * **لماذا**: «اكتشف» صار يحمل تلميحتين (الضغط المطوّل ثمّ السحب)، والقاعدةُ القائمة «لا تلميحتان معاً» (D-1273).
 * والجذورُ تبويباتٌ ثابتة (K3) لا تُنزع عند التبديل — فتلميحٌ يُعلن قراءتَه عند نزعه (`OneTimeHint`) كان يبقى حتى
 * يُضغط «×»، والتالي لا يأتي دورُه أبداً.
 *
 * 🔑 **الزيارةُ هي الوحدة**: عند ظهور الشاشة يُختار أوّلُ ما لم يُقرأ من قائمتها — واحدٌ لا أكثر. وعند مغادرتها
 * يُنزع (فيُعلن قراءتَه بنفسه)، والتالي في الزيارة التالية. هو سلوكُ الويب نفسُه: الصفحةُ تُنزع عند المغادرة.
 *
 * 🔑 **والجولةُ تُسكت التلميحات**: شيئان يُقرآن في وقتٍ واحد لا يُقرأ أحدُهما. الدورُ يُحسب عند الظهور، والجولةُ
 * تُبحر إلى الشاشة قبل أن تظهر — فمن دخل «اكتشف» في خطوته الأولى لا يرى تلميحاً، ولا يُحسب عليه مقروءاً.
 *
 * `seen` = ما قُرئ في الحساب (`me:library.hints`). **غائبٌ ⇒ لا تلميح** (أهونُ من تلميحٍ يعود — D-1259)، ويُختار
 * حين يصل إن كانت الشاشةُ ما زالت ظاهرة. `scope` يتبدّل حين يتبدّل ما تعرضه الشاشةُ نفسُها (تبويبٌ داخل المكتبة):
 * زيارةٌ جديدةٌ بقائمةٍ أخرى.
 */
export function useHintTurn(ids: readonly string[], seen: readonly string[] | undefined, scope = ""): string | null {
  const [turn, setTurn] = useState<string | null>(null);
  const live = useRef({ ids, seen });
  live.current = { ids, seen };
  /* مرّةً لكلِّ زيارة: ما أُغلق بـ«×» لا يخلفه التالي في الزيارة نفسِها */
  const visit = useRef({ on: false, picked: false });

  const pick = useCallback(() => {
    const v = visit.current;
    const { ids: list, seen: read } = live.current;
    if (!v.on || v.picked || !read) return;
    v.picked = true;
    if (tourStore.busy()) return;
    setTurn(list.find((id) => !read.includes(id)) ?? null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      visit.current = { on: true, picked: false };
      pick();
      return () => {
        visit.current = { on: false, picked: false };
        setTurn(null);
      };
      // `scope` عمداً: تبدّلُه مغادرةٌ ثمّ زيارة
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pick, scope]),
  );

  const known = seen !== undefined;
  useEffect(() => {
    if (known) pick();
  }, [known, pick]);

  return turn;
}
