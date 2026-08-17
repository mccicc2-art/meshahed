"use client";

import { useState, useTransition } from "react";
import { Icon } from "./Icon";
import { saveList } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
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
  locale,
}: {
  listId: string;
  saved?: boolean;
  locale: Locale;
}) {
  const t = getDict(locale);
  const [on, setOn] = useState(saved);
  const [pending, start] = useTransition();

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
         علامة الحفظ في بطاقة لوبز حرفاً (`AddWorksToList` بـ`iconOnly`) */
      className={`shrink-0 grid place-items-center w-8 h-8 -me-1 -mt-0.5 rounded-full active:scale-90 disabled:opacity-50 transition ${
        on ? "text-accent" : "text-muted hover:text-accent"
      }`}
    >
      <Icon
        name={on ? "heart-filled" : "heart"}
        size={16}
        strokeWidth={2}
        className={on ? "fill-current" : ""}
      />
    </button>
  );
}
