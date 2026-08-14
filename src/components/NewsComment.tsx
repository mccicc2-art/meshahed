"use client";

import { useState } from "react";
import { addNewsReply } from "@/lib/actions";
import { toast, flashError } from "@/lib/toast";
import { tap } from "@/lib/haptics";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon } from "./Icon";
import { Composer } from "./Composer";

/**
 * **ذيلُ نشرةِ Loopz — و«تعليق» يفتح صندوقاً في مكانه** (D-236، طلبُ أحمد:
 * «إذا ضغطت أيقونة التعليق أقدر مثل باقي النشرات أكتب، مو لازم يفتح
 * الصفحة»).
 *
 * **وهو توأمُ `RowComment` في كل شيء إلا الوجهة**: ذاك يردّ على **رأيِ
 * إنسان** (`review_replies`)، وهذا على **نشرةٍ منّا** (`news_post_replies`)
 * — **والجدولان اثنان لأن نشرتَنا لا صاحبَ لها في `auth.users`**، لا لأن
 * الفعلين اثنان. الحجّةُ كاملةً في `supabase/news_post_replies.sql`.
 *
 * ⚠️ **ولماذا لم يُوحَّدا في مكوّنٍ واحد بعَلَم:** جسمُهما واحدٌ اليوم،
 * **لكنّ ما تحتهما يفترق كلَّه** — مفتاحٌ نصّيٌّ مقابل ثلاثةِ أعمدة،
 * وفعلٌ مقابل فعل، وعدّادٌ يظهر هنا ولا يظهر هناك. **وعَلَمٌ يقلب كلَّ
 * ذلك ليس علَماً، هو مكوّنان في ملفّ.** وإن التقيا غداً يُدمجان بحجّةٍ
 * تُكتب — **والمشتركُ الحقيقيُّ بينهما (`Composer`) مُستخرَجٌ أصلاً.**
 *
 * ⚠️ **والردُّ لا يظهر في الخطّ بعد إرساله** — لكنّ **عدّادَ 💬 يزيد
 * فوراً** (تفاؤلياً)، **فالإيصالُ رقمٌ لا توستٌ وحده**: ما يراه المرسِل
 * أنّ كلامَه صار له أثرٌ ظاهر.
 */
export function NewsComment({
  postKey,
  replies,
  label,
  locale,
  before,
  after,
}: {
  postKey: string;
  /** عددُ الردود — **والصفرُ لا يُرسم** (D-222) */
  replies: number;
  label: string;
  locale: Locale;
  before?: React.ReactNode;
  after?: React.ReactNode;
}) {
  const t = getDict(locale);
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(replies);

  function send(body: string) {
    void (async () => {
      try {
        await addNewsReply({ postKey, body });
        setOpen(false);
        setCount((c) => c + 1);
        toast(t.replySentToast);
      } catch (e) {
        flashError((e as Error).message);
      }
    })();
  }

  return (
    <>
      <div className="pt-2 -mx-0.5 flex items-center justify-between">
        {before}
        <button
          type="button"
          onClick={() => {
            tap(6);
            setOpen((v) => !v);
          }}
          aria-expanded={open}
          aria-label={label}
          title={label}
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] tabular-nums transition ${
            open ? "text-accent" : "text-muted hover:text-accent"
          }`}
        >
          <Icon name="comment" size={15} />
          {count > 0 && count}
        </button>
        {after}
      </div>
      {open && <Composer locale={locale} onCancel={() => setOpen(false)} onSend={send} />}
    </>
  );
}
