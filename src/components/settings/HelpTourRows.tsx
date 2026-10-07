"use client";

import { getDict, type Locale } from "@/core/i18n";
import { TOUR_META, TOUR_IDS, TOUR_START_EVENT } from "@/lib/tour";
import { updateUiState } from "@/lib/actions";
import { toast } from "@/lib/toast";
import { SettingsRow } from "./SettingsRow";

/**
 * صفّا المساعدة التفاعليان — «الجولة التعريفية» و«إعادة عرض التلميحات».
 *
 * جزيرةُ عميلٍ صغيرة داخل صفحة المساعدة الخادمية (D-152: الحالة تسكن
 * أصغرَ جزيرةٍ تكفيها). الجولةُ تُبثّ حدثاً يسمعه `TourMount` في
 * التخطيط، والمحرّكُ يُبحر إلى خطوتها الأولى؛ والتلميحاتُ تُمحى
 * مفاتيحُها (`loopz-hint:*`) فتظهر من جديد في صفحاتها — وهذان سطحان
 * مختلفان عمداً: الجولة تقدّم Loopz كلَّه والتلميح يشرح صفحتَه.
 */
export function HelpTourRows({ locale }: { locale: Locale }) {
  const t = getDict(locale);

  return (
    <>
      {/* **الصفُّ يُشتقّ من `TOUR_IDS` لا يُكتب بيد** (D-826/D-827) — وهو اليوم صفٌّ واحد: الجولتان
          صارتا واحدة (D-1318).
          🔑 **ولا `router.push` هنا**: المحرّكُ يُبحر إلى أوّل خطوةٍ بنفسه، وأوّلُها صار «اكتشف» لا
          الرئيسية — فدفعٌ إلى `/` من هنا كان يضع الرئيسيةَ في السجلّ قبل أن تبدأ الجولة. */}
      {TOUR_IDS.map((id) => (
        <SettingsRow
          key={id}
          icon="sparkles"
          title={TOUR_META[id].title(t)}
          subtitle={TOUR_META[id].sub(t)}
          onClick={() => {
            window.dispatchEvent(
              new CustomEvent(TOUR_START_EVENT, { detail: { id } }),
            );
          }}
        />
      ))}
      <SettingsRow
        icon="eye"
        title={t.hintsResetRow}
        subtitle={t.hintsResetRowSub}
        onClick={() => {
          try {
            const doomed: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key?.startsWith("loopz-hint:")) doomed.push(key);
            }
            doomed.forEach((k) => localStorage.removeItem(k));
          } catch {
            /* تخزين معطّل — لا شيء يُمحى ولا شيء يُدّعى */
          }
          /* والحسابُ يُفرَّغ أيضاً (طلب أحمد ١٩ أغسطس: الحفظ للحساب) —
             وإلا أعادت مزامنةُ الدخول ما مُحي هنا في الفتحة التالية */
          void updateUiState({ resetHints: true }).catch(() => {});
          toast(t.hintsResetDone);
        }}
      />
    </>
  );
}
