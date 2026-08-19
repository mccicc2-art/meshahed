"use client";

import { useState } from "react";
import { getDict, type Locale } from "@/lib/i18n";
import { dirOf, alignOf } from "@/lib/dir";

/**
 * **نصٌّ سطرٌ واحدٌ ثم يُوسَّع** (D-304 → **D-310**، طلبُ أحمد: «الوصف
 * سطر واحد ونهايته زرّ المزيد، واللي يبغى يقراه كامل يوسّعه، وإذا توسّع
 * فيه زرّ تقليل»).
 *
 * ================= 🔴 D-310 — لماذا أُعيد بناؤه =================
 *
 * **الإصدارُ الأوّل وضع الزرَّ داخل الفقرة المقصوصة نفسِها** — وبلاغُ
 * أحمد: «النبذة ما تقصر ولا تطول». **والعيبُ بنيويٌّ لا رقميّ**: زرٌّ
 * داخل صندوق `line-clamp` **إمّا يُقصّ مع ما يقصّه** (فلا بابَ للتوسيع)
 * **وإمّا يكسر قصَّه** — **وفي الحالين الوعدُ مكسور.**
 * **وهو دربُ D-301 نفسُه**: ما يُضغط لنفسه لا يسكن صندوقَ غيره —
 * **هناك رابطاً، وهنا صندوقَ قصّ.**
 *
 * **فالبناءُ الآن صفٌّ من اثنين**: فقرةٌ تُقصّ سطراً (`flex-1 min-w-0`)
 * **وزرٌّ خارجها** (`shrink-0`) في آخر السطر — **الزرُّ لا يدخل ما
 * يقصّ، والقصُّ لا يبلع الزرّ.** وفي التوسيع تعود فقرةً كاملةً والزرُّ
 * بعد آخر كلمة.
 *
 * **ولا `<details>`** (شكلُ النظام لا يرث الثيم — D-016)،
 * **والاتّجاهُ من النصّ** (D-282).
 */
export function ExpandableText({
  text,
  locale,
}: {
  text: string;
  locale: Locale;
}) {
  const t = getDict(locale);
  const [open, setOpen] = useState(false);
  const dir = dirOf(text);
  const btn = "shrink-0 text-12 font-bold text-accent hover:underline";

  if (!open) {
    return (
      <div dir={dir} className={`mt-2 flex items-baseline gap-2 ${alignOf(text)}`}>
        <p className="min-w-0 flex-1 text-12 leading-relaxed text-muted truncate">{text}</p>
        <button type="button" onClick={() => setOpen(true)} aria-expanded={false} className={btn}>
          {t.showMore}
        </button>
      </div>
    );
  }

  return (
    <p dir={dir} className={`mt-2 text-12 leading-relaxed text-muted ${alignOf(text)}`}>
      {text}{" "}
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-expanded
        className={`${btn} whitespace-nowrap align-baseline`}
      >
        {t.showLess}
      </button>
    </p>
  );
}
