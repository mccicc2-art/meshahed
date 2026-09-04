"use client";

import { useState } from "react";
import Image from "next/image";
import { Sheet, SheetHeader } from "@/components/ui/Sheet";
import { PosterCard } from "@/components/PosterCard";
import { posterGrid, chipRow, sheetScroll } from "@/components/ui/controls";
import { profileUrl } from "@/core/media";
import { openPlusGate } from "@/lib/plusGate";
import { getDict, type Locale } from "@/core/i18n";
import type { AutoGroup } from "@/core/autoGroups";

/**
 * ============ «تجتمع عندك» — المجموعاتُ التلقائيّة (D-820) ============
 *
 * **البندُ الرابعُ من خطّة الـ٢٤.**
 *
 * ⚖️ **وليست تبويبَ «الفنانون»** (القاعدة ٣): **ذاك من تتابعهم**،
 * **وهذه من يتكرّر في مكتبتك ولم تتابعه** — **سؤالان لا رسمان.**
 *
 * 🔑 **والبطاقةُ تفتح ورقةً لا صفحةَ شخص**: **`title_meta` تخزّن اسماً
 * ومسارَ وجهٍ لا معرّفَ شخص** (D-718: **الغرضُ وجهٌ يُرسم لا صفحةٌ
 * تُفتح**) — **ورابطٌ إلى `/person/<؟>` يحتاج نداءَ بحثٍ باسمٍ قد يصيب
 * وقد يخطئ**، **وبابٌ يفتح على شخصٍ آخر أسوأُ من بابٍ لا يُفتح**
 * (D-217). **والورقةُ تعرض ما نملكه يقيناً: أعمالُك أنت.**
 *
 * 🔒 **وبلس** (قاعدةُ D-783 §٣) — **والقفلُ عند الفتح لا عند العرض**:
 * **الصفُّ مرسومٌ بأسمائه وأعدادِه** فيُرى ما يُشترى (D-633)،
 * **والورقةُ هي المحتوى.**
 */
export function AutoGroups({
  locale,
  groups,
  plus,
}: {
  locale: Locale;
  groups: AutoGroup[];
  plus: boolean;
}) {
  const ar = locale !== "en";
  const t = getDict(locale);
  const [open, setOpen] = useState<AutoGroup | null>(null);

  /* **ولا عنوانَ لقسمٍ فارغ** (D-219/D-280) */
  if (!groups.length) return null;

  return (
    <section className="mt-6">
      <h2 className="text-20 font-bold mb-1">
        {/* **من القاموس لا نصّاً مضمَّناً** (D-874/D-703): لوحُ الإخفاء
            يقرأ الاسمَ نفسَه — **واسمان لصفٍّ واحدٍ يفترقان.** */}
        {t.autoGroupsTitle}
      </h2>
      {/* 🔑 **وسطرٌ يقول ما قِيس** (D-800): **«تجتمع عندك» بلا تعريفٍ
          تُقرأ ترشيحاً** — **وهي عدُّ مكتبتك لا رأيَ أحد.** */}
      <p className="text-12 text-muted mb-3 leading-relaxed">
        {ar
          ? "أسماءٌ تتكرّر في مكتبتك — محسوبةٌ من أعمالك، لا ترشيحاً."
          : "Names that recur across your library — counted from your titles, not recommended."}
      </p>

      <div className={`${chipRow} flex gap-3`}>
        {groups.map((g) => (
          <button
            key={`${g.kind}:${g.name}`}
            type="button"
            onClick={() => (plus ? setOpen(g) : openPlusGate())}
            className="shrink-0 w-[92px] text-center active:opacity-70 transition"
          >
            <span className="block relative w-[92px] h-[92px] rounded-full overflow-hidden bg-surface-2 border border-border">
              {g.photo ? (
                <Image
                  src={profileUrl(g.photo) ?? ""}
                  alt=""
                  fill
                  sizes="92px"
                  className="object-cover"
                />
              ) : (
                /* **وغيابُ الوجه حرفٌ أوّلُ لا مربّعٌ فارغ** — والحرفُ
                   يُقرأ هويّةً، والمربّعُ يُقرأ عطلاً. */
                <span className="absolute inset-0 grid place-items-center text-24 font-bold text-muted">
                  {g.name.slice(0, 1)}
                </span>
              )}
            </span>
            <span className="block text-12 font-bold mt-1.5 leading-tight line-clamp-2">
              {g.name}
            </span>
            <span className="block text-12 text-muted mt-0.5 leading-none">
              {/* **والصفةُ تُقال**: «أخرج لك ستّة» غيرُ «ظهر في ستّة» */}
              {ar
                ? `${g.kind === "director" ? "أخرج" : "ظهر في"} ${g.items.length}`
                : `${g.kind === "director" ? "directed" : "in"} ${g.items.length}`}
            </span>
          </button>
        ))}
      </div>

      <Sheet
        open={!!open}
        onClose={() => setOpen(null)}
        closeLabel={ar ? "إغلاق" : "Close"}
      >
        {open && (
          <>
            <SheetHeader
              title={open.name}
              onClose={() => setOpen(null)}
              closeLabel={ar ? "إغلاق" : "Close"}
            >
              {/* **العدُّ في الرأس لا في الجسد**: الجسدُ يمرّ، والرأسُ
                  يبقى — **ورقمٌ يختفي عند أوّل تمريرةٍ لا يُقرأ.** */}
              <p className="text-12 text-muted mt-0.5">
                {ar
                  ? `${open.items.length} من أعمالك`
                  : `${open.items.length} of your titles`}
              </p>
            </SheetHeader>
            {/* 🔑 **والورقةُ سقفُها `76svh` وابنُها لا ينكمش تحته بلا
                `min-h-0`** (درسُ `ReorderSheet` بنصّه): **اثنا عشر عملاً
                كانت تُقصّ بلا تمرير** — **فآخرُ صفٍّ لا يُرى ولا يُبلَغ.**
                **و`sheetScroll` هي الوصفةُ نفسُها لا نسخةٌ ثانية** (القاعدة ٣). */}
            <div className={`${sheetScroll} px-4 pt-1 pb-[calc(1.5rem+env(safe-area-inset-bottom))]`}>
              <div className={posterGrid}>
                {open.items.map((x) => (
                  <PosterCard
                    key={x.key}
                    href={`/${x.media_type === "tv" ? "show" : "movie"}/${x.tmdb_id}`}
                    title={x.title}
                    posterPath={x.poster}
                    titleBelow
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </Sheet>
    </section>
  );
}
