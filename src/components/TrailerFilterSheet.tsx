"use client";

import { useState } from "react";
import { Sheet, SheetHeader } from "./ui/Sheet";
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
    <Sheet open variant="bottom" onClose={onClose} closeLabel={t.closeLabel} labelledBy="trailer-filter-title">
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

      {/* **شريطُ الأفعال شريطُ ورقة «اكتشف» حرفاً** — هادئٌ يمسح وأساسيٌّ واحدٌ يعرض */}
      <div className="shrink-0 flex items-center gap-3 px-5 py-3 border-t border-[color:var(--divider)] bg-[color:var(--elevated)]">
        <button
          type="button"
          disabled={!trailerFilterActive(draft)}
          onClick={() => {
            tap(6);
            setDraft(EMPTY_TRAILER_FILTER);
          }}
          className={buttonClass({ variant: "ghost", size: "md" })}
        >
          {t.browseClearAll}
        </button>
        <button
          type="button"
          onClick={() => {
            tap(10);
            onApply(draft);
          }}
          className={buttonClass({ variant: "primary", size: "md", className: "flex-1" })}
        >
          {t.trailerFilterApply}
        </button>
      </div>
    </Sheet>
  );
}
