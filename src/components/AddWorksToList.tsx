"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getDict, type Locale } from "@/lib/i18n";
import { toast, flashError } from "@/lib/toast";
import { tap } from "@/lib/haptics";
import { createListFromPerson, createListFromCollection, createListFromUniverse,
  removeListsNamed,
} from "@/lib/actions";
import { Icon } from "./Icon";

/**
 * زرٌّ واحد لثلاثة مصادر: أعمال فنان، أو أجزاء سلسلة، أو عالمٌ كامل (D-074).
 *
 * لا يحمل الأعمال معه: الفعل على الخادم يجلبها بنفسه (`getPersonCredits` /
 * `getCollection` / `moviesByIds`)، فلا نمرّر مصفوفةً كبيرة إلى المتصفّح ولا
 * نطلبها مرّتين — وطلب TMDB مخبّأ ساعةً أصلاً. والرسالة تحمل زرّ «افتح» لأن
 * من أنشأ قائمةً يريد رؤيتها، لا البحث عنها في `/lists`.
 */
export function AddWorksToList({
  source,
  id,
  locale,
  label,
  className = "",
  iconOnly = false,
  names,
  saved = false,
}: {
  source: "person" | "collection" | "universe";
  /** معرّف TMDB رقميّ للفنان/السلسلة، وslug نصيّ للعالم */
  id: number | string;
  locale: Locale;
  label?: string;
  className?: string;
  /**
   * **علامةُ حفظٍ بلا كلمة** (D-204، طلب أحمد: «Save to my list احذفها
   * واكتفِ بعلامة البوك مارك»).
   *
   * **ولماذا صحيحٌ هنا وخطأٌ في مواضع أخرى:** بطاقةُ القائمة تحمل اسمَها
   * وعددَها وملصقاتِها — **والزرُّ الممتلئ بعرضها كان يقرأ الفعلَ الأوّل
   * فيها**، وهو ليس كذلك: الفعلُ الأوّل فتحُها. ورمزُ الحفظ **عُرفٌ راسخ**
   * يُقرأ بلا كلمة (D-150: حيث يوجد عُرف، اتّباعُه ميزةٌ لا كسل).
   * ⚠️ **ويبقى له `aria-label`**: رمزٌ بلا اسمٍ لقارئ الشاشة زرٌّ مجهول.
   */
  iconOnly?: boolean;
  /**
   * **أسماءُ هذه المجموعة بلغتيها** — حضورُ أحدِها في قوائمي يعني «محفوظة»،
   * والضغطُ يزيلها (D-206). غيابُ الخاصّية = الزرُّ يُضيف فقط كما كان.
   *
   * **ولماذا اسمان:** الاسمُ يُكتب بلغة الواجهة وقتَ الحفظ (D-130)، فمن حفظ
   * بالعربية ثم قرأ بالإنجليزية يجب أن يرى علامتَه.
   */
  names?: string[];
  /** هل هي في قوائمي أصلاً؟ — تُقرأ في الصفحة مرّةً لا لكل بطاقة */
  saved?: boolean;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [on, setOn] = useState(saved);
  const text =
    label ??
    (source === "person"
      ? t.worksToListBtn
      : source === "universe"
        ? t.universeToListBtn
        : t.partsToListBtn);

  function run() {
    if (pending) return;

    /* **محفوظة؟ فالضغطةُ تُزيل** — تفاؤلياً كبقية الأفعال، وتُراجَع إن
       فشلت الكتابة. **وبلا تأكيد:** الحذفُ يُعاد بضغطةٍ واحدة (نفسُ
       المجموعة تُبنى من جديد)، **والتأكيدُ يُحفظ لما لا يُتراجع عنه**
       (D-047). */
    if (on && names?.length) {
      tap(8);
      setOn(false);
      start(async () => {
        try {
          await removeListsNamed(names);
          toast(t.listUnsavedToast);
        } catch (e) {
          setOn(true);
          flashError((e as Error).message);
        }
      });
      return;
    }

    tap([12, 30]);
    setOn(true);
    start(async () => {
      try {
        const res =
          source === "person"
            ? await createListFromPerson(Number(id))
            : source === "universe"
              ? await createListFromUniverse(String(id))
              : await createListFromCollection(Number(id));
        if (!res) return;
        const open = { label: t.openListAction, run: () => router.push(`/lists/${res.listId}`) };
        if (res.created) toast(t.listMadeToast(res.name), { action: open });
        else if (res.added > 0) toast(t.listGrewToast(res.added), { action: open });
        else toast(t.listHadAllToast, { tone: "info", action: open });
      } catch (e) {
        setOn(saved);
        flashError((e as Error).message);
      }
    });
  }

  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={run}
        disabled={pending}
        aria-pressed={on}
        aria-label={on ? t.listUnsaveLabel : text}
        title={on ? t.listUnsaveLabel : text}
        className={`shrink-0 grid place-items-center w-8 h-8 -me-1 -mt-0.5 rounded-full active:scale-90 disabled:opacity-50 transition ${
          on ? "text-accent" : "text-muted hover:text-accent"
        } ${className}`}
      >
        {/* **معبّأةٌ بالكامل بلون الثيم حين تكون محفوظة** (طلب أحمد):
            الحدُّ وحده لا يُرى على ملصقٍ في صفٍّ يُمرَّر، **والملءُ يُقرأ
            من طرف العين** — وهو عُرفُ علامة الحفظ في كل تطبيق. */}
        <Icon
          name="bookmark"
          size={17}
          strokeWidth={2}
          /* **الملءُ بالصنف لا بخاصّيةٍ جديدة على `Icon`**: مجموعةُ الأيقونات
             مرسومةٌ بالحدود (`stroke`) وحدها، **وإضافةُ خاصّية `filled` إليها
             كانت ستفتح بابَ نسختين لكل أيقونة**. و`fill-current` يملأ المسار
             بلون النصّ نفسِه — فالأصفرُ يأتي من `text-accent` أعلاه. */
          className={on ? "fill-current" : ""}
        />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      className={`inline-flex items-center gap-1.5 shrink-0 rounded-full border border-border bg-surface px-3.5 h-9 text-[13px] font-semibold text-foreground/85 hover:text-accent hover:border-accent/50 active:scale-95 disabled:opacity-50 transition ${className}`}
    >
      <Icon name="plus" size={16} strokeWidth={2.2} />
      {text}
    </button>
  );
}
