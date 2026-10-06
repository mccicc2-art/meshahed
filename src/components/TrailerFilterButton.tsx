"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FilterIconButton } from "./ui/FilterIconButton";
import { getDict, type Locale } from "@/core/i18n";
import type { TrailerTab } from "@/core/trailerTabs";
import {
  parseTrailerFilter,
  trailerFilterActive,
  trailerFilterKey,
  trailerFilterParams,
  type TrailerFilter,
} from "@/core/trailerFilter";

/* الورقةُ تُحمَّل عند أوّل فتحٍ لا مع الصفحة (نمطُ ورقة «اكتشف») — والصفحةُ صفحةُ فيديو، فكلُّ ما لا يُرى
   أوّلاً لا ينزل أوّلاً */
const TrailerFilterSheet = dynamic(() => import("./TrailerFilterSheet").then((m) => m.TrailerFilterSheet), {
  ssr: false,
});

/**
 * 🆕 **زرُّ فلتر صفحة الترايلرات** (D-1311) — `FilterIconButton` نفسُه الذي في اكتشف والمكتبة والمجتمع.
 *
 * 🔑 **ومكانُه نهايةُ سطر العنوان لا نهايةُ صفِّ التبويبات** (طلبُ أحمد: «على نفس خط تريلر فور يو»):
 * في السطوح الثلاثة يجلس آخرَ صفِّ التبويبات (D-1237) — وهناك الصفُّ ثابت. **وهنا الصفُّ رقائقُ تُمرَّر
 * أفقيّاً**، وزرٌّ في آخره يخرج من الشاشة مع أوّل سحبة. فأخذ الخانةَ الفارغة التي كانت توازن سهمَ الرجوع.
 *
 * 🔑 **والفلترُ يسكن الرابط** (`g` · `rel` · `lang`) كما يسكنه التبويب (D-734): **فيبقى عند تبديل
 * التبويب** — `TrailerTabs` ينسخ الوسائطَ ويبدّل `tab` وحدَه — **ويُنسى عند الخروج** (حكمُه: «ينسى عند
 * الخروج»): الرجوعُ يستبدل الصفحةَ بمسار «اكتشف»، والدخولُ التالي رابطٌ بلا وسائط. ولا يُحفظ في حساب.
 * ⚠️ **و`replace` لا `push`**: فلترٌ في السجلّ يجعل الرجوعَ تراجعاً عن رقاقة (قاعدةُ D-521).
 */
export function TrailerFilterButton({ locale, tab }: { locale: Locale; tab: TrailerTab }) {
  const t = getDict(locale);
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);

  const value = parseTrailerFilter({ g: sp.get("g"), rel: sp.get("rel"), lang: sp.get("lang") });

  function apply(next: TrailerFilter) {
    setOpen(false);
    if (trailerFilterKey(next) === trailerFilterKey(value)) return;
    const q = new URLSearchParams(sp.toString());
    /* **و`at=` يسقط مع فلترٍ جديد**: العملُ المفتوحُ عليه قد لا يطابقه — وتثبيتُه فوق فلترٍ لا يضمّه
       يعرض ما طُلب استبعادُه */
    for (const k of ["at", "g", "rel", "lang"]) q.delete(k);
    for (const [k, v] of Object.entries(trailerFilterParams(next))) q.set(k, v);
    const s = q.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    /* علفٌ جديدٌ يبدأ من رأسه — وموضعُ تمريرٍ في العلف القديم لا معنى له في الجديد */
    window.scrollTo({ top: 0 });
  }

  return (
    <>
      <FilterIconButton
        onClick={() => setOpen(true)}
        label={t.browseFilters}
        active={trailerFilterActive(value)}
        expanded={open}
        /* `mb-1` في الزرِّ لصفِّ تبويباتٍ يحمل خطّاً سفليّاً — وسطرُ العنوان بلا خطّ، فيتوسّط مع السهم */
        className="!mb-0"
      />
      {open && (
        <TrailerFilterSheet
          locale={locale}
          tab={tab}
          value={value}
          onClose={() => setOpen(false)}
          onApply={apply}
        />
      )}
    </>
  );
}
