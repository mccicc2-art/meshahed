"use client";

import { useState, useTransition } from "react";
import { Icon } from "./Icon";
import { saveList } from "@/lib/actions";
import { getDict, num, type Locale } from "@/core/i18n";
import { toast, flashError } from "@/lib/toast";
import { tap } from "@/lib/haptics";

/**
 * **علامةُ حفظٍ في زاوية بطاقة قائمة العضو** (بلاغُ أحمد: «زر الحفظ
 * ونجمة التقييم وينهم؟»).
 *
 * ================= التشخيص: بطاقتان بإيقاعين =================
 *
 * **بطاقةُ لوبز المنسّقة تحمل علامةَ حفظٍ في زاويتها منذ D-204، وبطاقةُ
 * العضو لا** — **والبطاقتان تجلسان في صفحةٍ واحدة** بنفس الهندسة ونفس
 * سطر الأرقام (D-329/D-335). **وسطحان يعرضان الشيءَ نفسَه بأداتين
 * مختلفتين هو ما تمنعه القاعدة ٦**، والقارئُ يقرأ الفرقَ ميزةً غائبة لا
 * قراراً.
 *
 * ================= ولماذا قلبٌ لا مِرجَعيّة =================
 *
 * **لأن الفعلَ ليس الفعلَ نفسَه.** المنسّقةُ **تُنسخ** إلى قوائمك
 * (`createListFromUniverse` — محرّك D-052)، **وقائمةُ العضو تُحفَظ مرجعاً
 * حيّاً** في `list_saves` (D-068). **والقلبُ هو رمزُ هذا الفعل منذ D-324**
 * («القلبُ هو الحفظ — لا فعلَ ثانٍ»)، وهو ما تراه في صفحة القائمة نفسِها.
 * **فمِرجَعيّةٌ هنا كانت ستصير رمزاً ثانياً لفعلٍ له رمز** (D-294).
 *
 * ⚠️ **والبطاقةُ رابطٌ كلُّها** — فالضغطةُ تُوقَف عند الزرّ (`preventDefault`
 * + `stopPropagation`)، **وإلّا حفظتْ وفتحتِ الصفحةَ في نفس اللمسة.**
 *
 * ⚠️ **والحالةُ تفاؤليّة وتُراجَع إن فشلت الكتابة** — وصفةُ `LikeButton`
 * و`AddWorksToList` نفسُها، **ولا تأكيدَ للإزالة**: تُعاد بضغطةٍ واحدة
 * (D-047: التأكيدُ يُحفظ لما لا يُتراجع عنه).
 */
export function ListSaveHeart({
  listId,
  saved = false,
  count,
  locale,
}: {
  listId: string;
  saved?: boolean;
  /**
   * 🆕 **عددُ من حفظها — يجاور رمزَه** (D-357، طلبُ أحمد: «رقم القلب
   * يكون جنب القلب»). **والرقمُ يخصّ ما تحته ويجاور صاحبَه**
   * (D-223/D-237) — **وكان في سطرٍ ثالثٍ أسفل البطاقة**، فيقرأ القارئُ
   * رمزاً في الزاوية ورقماً في القاع ولا يجمع بينهما.
   *
   * ⚠️ **والصفرُ يُخفى** (D-219)، **ويظهر أوّلَ حفظٍ لأن الحالة تفاؤليّة.**
   */
  count?: number | null;
  locale: Locale;
}) {
  const t = getDict(locale);
  const [on, setOn] = useState(saved);
  const [pending, start] = useTransition();

  /* 🆕 **والرقمُ فرقٌ لا قيمةٌ مطلقة** (D-241): عددُ الخادم يحوي حفظي إن
     كنتُ حافظاً، **فالمعروضُ عددُه مضافاً إليه ما بدّلتُه أنا وحدي** —
     فلا يُحسب حفظي مرّتين ولا يبقى الرقمُ ساكناً تحت إصبعي. */
  const shown = (count ?? 0) + (on === saved ? 0 : on ? 1 : -1);

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={on}
      aria-label={on ? t.listUnsaveLabel : t.listSaveBtn}
      title={on ? t.listUnsaveLabel : t.listSaveBtn}
      onClick={(e) => {
        /* البطاقةُ رابط — واللمسةُ الواحدة لا تعني فعلين */
        e.preventDefault();
        e.stopPropagation();
        if (pending) return;
        const next = !on;
        tap(next ? [12, 30] : 8);
        setOn(next);
        start(async () => {
          try {
            await saveList(listId, next);
            toast(next ? t.listSavedToast : t.listUnsavedToast);
          } catch (err) {
            setOn(!next);
            flashError((err as Error).message);
          }
        });
      }}
      /* الهدفُ ٣٢px مرسومٌ داخل هامشٍ سالب فلا يعلو السطر — نفسُ هندسة
         علامة الحفظ في بطاقة لوبز حرفاً (`AddWorksToList` بـ`iconOnly`).
         🆕 **والرقمُ داخل الزرّ لا بجانبه**: هدفُ اللمس يشملهما معاً
         فيكبر ولا يصغر (D-033/D-168)، **والرمزُ ورقمُه شيءٌ واحدٌ
         يُقرأ ويُضغط.** و`ltr` لأن الرقمَ يتبع رمزَه في اللغتين. */
      className={`shrink-0 flex items-center gap-1 h-8 -mt-0.5 rounded-full px-1 text-12 font-bold tabular-nums active:scale-90 disabled:opacity-50 transition ${
        on ? "text-accent" : "text-muted hover:text-accent"
      }`}
      dir="ltr"
    >
      <Icon
        name={on ? "heart-filled" : "heart"}
        size={16}
        strokeWidth={2}
        className={on ? "fill-current" : ""}
      />
      {shown > 0 && <span>{num(shown, locale)}</span>}
    </button>
  );
}
