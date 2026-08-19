"use client";

import { useRouter } from "next/navigation";
import { getDict, type Locale } from "@/lib/i18n";
import { TOUR_START_EVENT } from "@/lib/tour";
import { updateUiState } from "@/lib/actions";
import { toast } from "@/lib/toast";
import { SettingsRow } from "./SettingsRow";

/**
 * صفّا المساعدة التفاعليان — «الجولة التعريفية» و«إعادة عرض التلميحات».
 *
 * جزيرةُ عميلٍ صغيرة داخل صفحة المساعدة الخادمية (D-152: الحالة تسكن
 * أصغرَ جزيرةٍ تكفيها). الجولةُ تُبثّ حدثاً يسمعه `TourMount` في
 * التخطيط ثم نعود للرئيسية حيث تبدأ خطوتُها الأولى؛ والتلميحاتُ تُمحى
 * مفاتيحُها (`loopz-hint:*`) فتظهر من جديد في صفحاتها — وهذان سطحان
 * مختلفان عمداً: الجولة تقدّم Loopz كلَّه والتلميح يشرح صفحتَه.
 */
export function HelpTourRows({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const router = useRouter();

  return (
    <>
      <SettingsRow
        icon="sparkles"
        title={t.tourRow}
        subtitle={t.tourRowSub}
        onClick={() => {
          window.dispatchEvent(new CustomEvent(TOUR_START_EVENT));
          router.push("/");
        }}
      />
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
