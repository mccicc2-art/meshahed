"use client";

import { useEffect, useRef } from "react";
import { updateUiState } from "@/lib/actions";
import { readTourState, writeTourState } from "@/lib/tour";
import { furtherTour, sameTour, sanitizeUiState } from "@/lib/uiState";

/**
 * مزامنة حالة الواجهة التعليمية عند الدخول — توأم `ThemeCookieSync`
 * و`FontPrefsSync` (طلب أحمد ١٩ أغسطس: الحفظ في الحساب والمزامنة عند
 * تسجيل الدخول).
 *
 * تجري مرةً عند التركيب وفي الاتجاهين:
 * - **من الحساب إلى الجهاز**: تلميحٌ قرأتَه على جهازٍ آخر يُكتب مفتاحُه
 *   هنا قبل أن يقرأه `OneTimeHint` (هذا المكوّن في الترويسة، وآثارُ
 *   React تجري بترتيب الشجرة، و`OneTimeHint` يُظهر في إطارٍ لاحقٍ
 *   أصلاً) — فلا وميضَ تلميحٍ مقروء. وحالةُ الجولة تُؤخذ **الأبعد** لا
 *   الأحدث: `done` يغلب، ثم الخطوة الأعلى.
 * - **من الجهاز إلى الحساب**: ما قُرئ هنا قبل الهجرة أو قبل الدخول
 *   يُدفع اتحاداً — «مقروءٌ في أي مكان مقروءٌ في كل مكان».
 *
 * ولا `router.refresh()`: كل المقروء عميليٌّ (localStorage) فلا شيء
 * خادميٌّ يحتاج إعادة رسم — وهذا فرقُها عن توأمَيها.
 */
export function UiStateSync({ uiState }: { uiState: unknown }) {
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const account = sanitizeUiState(uiState);

    /* التلميحات: مفاتيح الجهاز الحالية */
    const localHints: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith("loopz-hint:")) localHints.push(k.slice("loopz-hint:".length));
      }
    } catch {
      /* تخزين معطّل — تبقى المزامنة من الحساب مستحيلةً وإليه ممكنة */
    }

    // من الحساب إلى الجهاز
    for (const id of account.hints) {
      if (!localHints.includes(id)) {
        try {
          localStorage.setItem(`loopz-hint:${id}`, "1");
        } catch {
          /* تجاهل — سيُعاد في الزيارة القادمة */
        }
      }
    }

    // الجولة: الأبعدُ يفوز ويُكتب في الجانب المتأخر
    const localTour = readTourState();
    const resolved = furtherTour(localTour, account.tour);
    if (resolved && !sameTour(resolved, localTour)) writeTourState(resolved);

    // من الجهاز إلى الحساب — كتابةٌ واحدة إن وُجد فرقٌ فقط
    const missingInAccount = localHints.filter((h) => !account.hints.includes(h));
    const tourAhead = resolved && !sameTour(resolved, account.tour) ? resolved : undefined;
    if (missingInAccount.length || tourAhead) {
      void updateUiState({
        ...(missingInAccount.length ? { addHints: missingInAccount } : {}),
        ...(tourAhead ? { tour: tourAhead } : {}),
      }).catch(() => {});
    }
  }, [uiState]);

  return null;
}
