"use client";

import { useState } from "react";
import { Sheet, SheetGrabHandle, SheetHeader, useSheetDragToDismiss } from "./ui/Sheet";
import { buttonClass } from "./ui/Button";
import { chipClass, sheetScroll } from "./ui/controls";
import { tap } from "@/lib/haptics";
import { getDict, type Locale } from "@/core/i18n";
import { BROWSE_GENRES, BROWSE_LANGS, browseGenreName, browseLangName } from "@/core/browse";
import type { TrailerTab } from "@/core/trailerTabs";
import {
  EMPTY_TRAILER_FILTER,
  TRAILER_RELEASES,
  trailerFilterActive,
  trailerGenresFor,
  type TrailerFilter,
  type TrailerRelease,
} from "@/core/trailerFilter";

/**
 * 🆕 **ورقةُ فلتر الترايلرات** (D-1311) — الورقةُ الواحدة (`Sheet`) وعائلةُ الرقائق، لا شكلَ ثالث.
 *
 * 🔑 **مسودّةٌ ثمّ «عرض»، لا تطبيقٌ عند كلِّ لمسة**: العلفُ مثبَّتٌ على ما فُتح به (D-1296)، وكلُّ
 * فلترٍ علفٌ جديدٌ يُسبر من الخادم — فثلاثُ رقائقَ تُلمس ثلاثةُ علوفٍ تُبنى وتُرمى، والمقطعُ الدائرُ
 * يُسحب من تحت العين ثلاثاً. وهو ترتيبُ ورقة «اكتشف» نفسُه («مسح الكل» · «عرض النتائج»).
 *
 * ⚠️ **والرقائقُ هنا لا منسدلات «اكتشف»**: هناك عشرةُ محاورَ في عمودين، وهنا ثلاثةٌ قصيرةٌ يُجمع
 * في اثنين منها أكثرُ من اختيار — ومنسدلةٌ لا تجمع.
 *
 * ⚖️ 🆕 **ومن القاع، لا من الأعلى** (D-1314، طلبُ أحمد بلقطتين: «فلتر التريلرات خليه من تحت زي
 * اكتشف»). **صفحةُ الترايلرات صفحةُ ويبٍ تعيش داخل التطبيق الأصليّ**، وورقةُ «اكتشف» التي
 * تجاورها هناك أصليّةٌ تصعد من القاع بمقبض — **فورقتان لسؤالٍ واحدٍ («بماذا أصفّي؟») في شاشتين
 * متجاورتين بموضعين عادتان تُتعلَّمان لشيءٍ واحد**، وهي حجّةُ D-177 نفسُها وقد انقلبت على موضعه.
 * **والحدُّ يُقال**: هذه الورقةُ وحدها؛ أوراقُ الويب الأخرى تبقى من الأعلى. **ولا شكلَ جديداً**:
 * `anchor="bottom"` والمقبضُ والسحبُ للإغلاق هي أدواتُ D-558 بقارئٍ رابع.
 */
export function TrailerFilterSheet({
  locale,
  tab,
  value,
  onClose,
  onApply,
}: {
  locale: Locale;
  tab: TrailerTab;
  value: TrailerFilter;
  onClose: () => void;
  onApply: (next: TrailerFilter) => void;
}) {
  const t = getDict(locale);
  const lang = locale === "en" ? "en" : "ar";
  const [draft, setDraft] = useState<TrailerFilter>(value);
  /* **السحبُ يُغلق ولا يطبّق** — المخرجُ نفسُه للحجاب و× و Escape: المسودّةُ تُرمى */
  const { handleProps, panelProps } = useSheetDragToDismiss(onClose);

  /* **والمختارُ يبقى ظاهراً ولو لم يكن من أنواع هذا التبويب**: «رعب» اختيرت في «أفلام» ثمّ فُتحت
     الورقةُ في «مسلسلات» — رقاقةٌ مفعَّلةٌ لا تُرى لا تُطفأ (سابقةُ «صفوفك» في ورقة اكتشف). */
  const fits = trailerGenresFor(tab);
  const genres = BROWSE_GENRES.filter((g) => fits.includes(g) || draft.genres.includes(g.slug));

  const toggle = (key: "genres" | "langs", id: string) => {
    tap(6);
    setDraft((d) => ({
      ...d,
      [key]: d[key].includes(id) ? d[key].filter((x) => x !== id) : [...d[key], id],
    }));
  };

  const releaseLabel: Record<TrailerRelease, string> = {
    all: t.browseAll,
    soon: t.trailerReleaseSoon,
    out: t.trailerReleaseOut,
  };

  const group = "text-12 font-bold text-muted";
  const chips = "mt-2 flex flex-wrap gap-2";

  return (
    <Sheet
      open
      variant="bottom"
      anchor="bottom"
      onClose={onClose}
      closeLabel={t.closeLabel}
      labelledBy="trailer-filter-title"
      /* D-1315 (طلبُ أحمد بلقطتين متجاورتين: «خل الالوان مثل فلتر اكتشف .. الخلفة سوداء و الكلمات اللي وراها
         رصاصي»، واختار «هذه الورقة فقط»): **الورقةُ بلون الصفحة لا بلون `elevated`** — فتطابق ورقةَ «اكتشف»
         الأصليّةَ التي تُفتح بجوارها في التطبيق، والرقائقُ (`surface`) تبرز فوقها رصاصيّةً. **رموزُ السمة لا
         ألوانٌ مكتوبة**: في `daylight` الورقةُ بيضاءُ والرقائقُ رماديّةٌ فاتحة. ⚠️ وبقيّةُ أوراق الويب على
         `elevated` كما هي — استثناءٌ محصورٌ بحكمه لا لونٌ ثانٍ للأوراق. */
      className={`${panelProps.className ?? ""} !bg-[color:var(--background)]`}
      panelStyle={panelProps.panelStyle}
    >
      <SheetGrabHandle {...handleProps} />

      <SheetHeader id="trailer-filter-title" title={t.trailerFilterTitle} closeLabel={t.closeLabel} onClose={onClose} />

      <div className={`${sheetScroll} px-5 py-4 space-y-5`}>
        <section role="group" aria-labelledby="trailer-filter-genre">
          <p id="trailer-filter-genre" className={group}>
            {t.browseGenreGroup}
          </p>
          <div className={chips}>
            {genres.map((g) => {
              const on = draft.genres.includes(g.slug);
              return (
                <button
                  key={g.slug}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle("genres", g.slug)}
                  className={chipClass(on)}
                >
                  {browseGenreName(g, lang)}
                </button>
              );
            })}
          </div>
        </section>

        {/* **واحدٌ من ثلاثة** — «قريباً» و«صدر» ينفي أحدُهما الآخر، فالمحورُ اختيارٌ لا جمع */}
        <section role="radiogroup" aria-labelledby="trailer-filter-release">
          <p id="trailer-filter-release" className={group}>
            {t.trailerReleaseGroup}
          </p>
          <div className={chips}>
            {TRAILER_RELEASES.map((r) => {
              const on = draft.release === r;
              return (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    tap(6);
                    setDraft((d) => ({ ...d, release: r }));
                  }}
                  className={chipClass(on)}
                >
                  {releaseLabel[r]}
                </button>
              );
            })}
          </div>
        </section>

        <section role="group" aria-labelledby="trailer-filter-lang">
          <p id="trailer-filter-lang" className={group}>
            {t.browseLangGroup}
          </p>
          <div className={chips}>
            {BROWSE_LANGS.map((l) => {
              const on = draft.langs.includes(l.code);
              return (
                <button
                  key={l.code}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle("langs", l.code)}
                  className={chipClass(on)}
                >
                  {browseLangName(l, lang)}
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* **شريطُ الأفعال شريطُ ورقة «اكتشف» الأصليّة** (D-1314) — «مسح الكل» بحدٍّ وأساسيٌّ واحدٌ
          يعرض؛ **والحشوةُ السفليّةُ تحسب المنطقةَ الآمنة** لأن الشريطَ صار آخرَ ما في الشاشة */}
      <div className="shrink-0 flex items-center gap-3 px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] border-t border-[color:var(--divider)] bg-[color:var(--background)]">
        <button
          type="button"
          disabled={!trailerFilterActive(draft)}
          onClick={() => {
            tap(6);
            setDraft(EMPTY_TRAILER_FILTER);
          }}
          /* D-1315 — **الزرّان بهيئة زرَّي ورقة «اكتشف»** (اختيارُه «B» من صورتين): أطرافٌ دائريّةٌ و«مسح الكل»
             حدٌّ بلا سطح. ⚠️ **استثناءٌ من `rounded-control` في هذه الورقة وحدَها** — قيل له قبل أن يختار إنّ
             بقيّةَ أزرار الويب على الزوايا الأخرى. */
          className={buttonClass({ variant: "surface", size: "md", className: "!rounded-full !bg-transparent" })}
        >
          {t.browseClearAll}
        </button>
        <button
          type="button"
          onClick={() => {
            tap(10);
            onApply(draft);
          }}
          className={buttonClass({ variant: "primary", size: "md", className: "flex-1 !rounded-full" })}
        >
          {t.trailerFilterApply}
        </button>
      </div>
    </Sheet>
  );
}
