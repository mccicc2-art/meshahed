"use client";

import { useState } from "react";
import { getDict, num, type Locale } from "@/lib/i18n";
import {
  BROWSE_COUNTRIES,
  BROWSE_ERAS,
  BROWSE_LANGS,
  BROWSE_RATES,
  browseCountryName,
  browseEraName,
  browseLangName,
  type BrowseRate,
  type BrowseType,
} from "@/lib/browse";
import { regionName } from "@/lib/region";
import { tap } from "@/lib/haptics";
import { Icon } from "./Icon";
import { Sheet, SheetHeader } from "./ui/Sheet";
import { buttonClass } from "./ui/Button";
import { chipClass, segmentedItem, segmentedTrackFull } from "./ui/controls";

export interface FilterDraft {
  type: BrowseType;
  lang: string | null;
  /** بلد الإنتاج — تابعٌ للعربية، ويسقط معها */
  country: string | null;
  /** معرّف منصّة الاشتراك عند TMDB */
  provider: number | null;
  era: string | null;
  rate: BrowseRate | null;
}

/**
 * ورقة فلاتر «اكتشف».
 *
 * لماذا ورقةٌ لا صفوفُ رقائقٍ في الصفحة: الفلاتر أربعة محاور وستّة عشر
 * خياراً؛ لو فُرشت كلّها لأكلت الشاشة الأولى كاملةً وصار المحتوى — وهو
 * سبب الزيارة — تحت الطيّة. الشائع في التصفّح اختيارُ تصنيفٍ ثم تمرير،
 * فالتصنيف وحده يبقى ظاهراً والبقية خلف زرٍّ يحمل عدّاده.
 *
 * والتطبيق دفعةً واحدة لا عند كل لمسة: كل تغييرٍ يعيد رسم الصفحة على
 * الخادم ويطلب TMDB، ومن يريد «تركي + ٢٠٢٠ + ٨ فأعلى» كان سيدفع ثلاث
 * جولاتٍ يرى في اثنتين منها نتائج لا يريدها. المسوّدة محليّة، و«عرض
 * النتائج» وحده يمسّ الرابط.
 *
 * ثلاثُ عائلاتٍ لا واحدة كان يمكن أن تُستعمل هنا — استُعملت الموجودتان
 * فقط: المقسّم لجهة المحتوى (خيارٌ واحدٌ من ثلاثة معروفة)، والرقائق لبقية
 * المحاور (قوائم مفتوحة تُمرَّر). لا شكل ثالث.
 */
export function DiscoverFilterSheet({
  locale,
  initial,
  providers,
  region,
  onApply,
  onClose,
}: {
  locale: Locale;
  initial: FilterDraft;
  /** منصّات المنطقة كما جاءت من TMDB — فارغةً حين يتعذّر جلبها */
  providers: { id: number; name: string }[];
  /** بلد المشاهدة — يُكتب في عنوان المجموعة فلا تُقرأ القائمة عالمية */
  region: string;
  onApply: (next: FilterDraft) => void;
  onClose: () => void;
}) {
  const t = getDict(locale);
  const lang = locale === "en" ? "en" : "ar";
  const [draft, setDraft] = useState<FilterDraft>(initial);

  const TYPES: { value: BrowseType; label: string }[] = [
    { value: "all", label: t.browseAll },
    { value: "movie", label: t.browseMovies },
    { value: "tv", label: t.browseSeries },
  ];

  function set(patch: Partial<FilterDraft>) {
    tap(6);
    setDraft((d) => ({ ...d, ...patch }));
  }

  const cleared: FilterDraft = {
    type: "all",
    lang: null,
    country: null,
    provider: null,
    era: null,
    rate: null,
  };
  const dirty =
    draft.type !== "all" ||
    draft.lang !== null ||
    draft.country !== null ||
    draft.provider !== null ||
    draft.era !== null ||
    draft.rate !== null;

  /* البلد يظهر تحت اللغة العربية وحدها، ويُمسح متى غادرتها: خيارٌ مطبَّقٌ
     لا يراه المستخدم يجعل النتائج تكذب على الواجهة */
  const showCountry = draft.lang === "ar";

  return (
    /* سفليّةٌ لا علويّة: هذه ورقةُ لمسٍ لا كتابة — لا لوحة مفاتيح تدفعها،
       والخيارات تُلمس بالإبهام فتُقرَّب منه. (العلويّة للبحث وحده.) */
    <Sheet
      open
      variant="bottom"
      onClose={onClose}
      closeLabel={t.closeLabel}
      labelledBy="discover-filters-title"
    >
      <SheetHeader
        id="discover-filters-title"
        title={t.browseFiltersTitle}
        closeLabel={t.closeLabel}
        onClose={onClose}
      >
        <p className="text-xs text-muted mt-0.5">{t.browseFiltersHint}</p>
      </SheetHeader>

      <div className="overflow-y-auto overscroll-contain px-5 py-4 space-y-5">
        {/* ===== جهة المحتوى ===== */}
        <section>
          <h4 className="text-xs font-bold text-muted mb-2">{t.browseTypeGroup}</h4>
          <div role="group" aria-label={t.browseTypeGroup} className={segmentedTrackFull}>
            {TYPES.map((o) => (
              <button
                key={o.value}
                type="button"
                aria-pressed={draft.type === o.value}
                onClick={() => set({ type: o.value })}
                className={segmentedItem(draft.type === o.value, "flex-1")}
              >
                {o.label}
              </button>
            ))}
          </div>
        </section>

        {/* ===== لغة العمل ===== */}
        <FilterGroup title={t.browseLangGroup}>
          <Chip on={!draft.lang} onClick={() => set({ lang: null, country: null })}>
            {t.browseAnyLang}
          </Chip>
          {BROWSE_LANGS.map((l) => (
            <Chip
              key={l.code}
              on={draft.lang === l.code}
              onClick={() =>
                set(
                  draft.lang === l.code
                    ? { lang: null, country: null }
                    : { lang: l.code, country: null },
                )
              }
            >
              {browseLangName(l, lang)}
            </Chip>
          ))}
        </FilterGroup>

        {/* ===== بلد الإنتاج — مع العربية وحدها =====
            اللغة تفصل التركيّ عن الكوريّ ولا تفصل السعوديّ عن المصريّ:
            ثلاثتها `ar`. فهذا المحور تفريعٌ للعربية لا محورٌ موازٍ، ولذلك
            يظهر تحتها ويختفي بغيرها بدل أن يجلس دائماً فارغ المعنى */}
        {showCountry && (
          <FilterGroup title={t.browseCountryGroup}>
            <Chip on={!draft.country} onClick={() => set({ country: null })}>
              {t.browseAnyCountry}
            </Chip>
            {BROWSE_COUNTRIES.map((c) => (
              <Chip
                key={c.code}
                on={draft.country === c.code}
                onClick={() => set({ country: draft.country === c.code ? null : c.code })}
              >
                {browseCountryName(c, lang)}
              </Chip>
            ))}
          </FilterGroup>
        )}

        {/* ===== متاح على =====
            أكثر سؤالٍ عمليّ عند من يدفع اشتراكاً: «وش أشوف على شاهد؟».
            البيانات موجودة عندنا أصلاً (تظهر في صفحة كل عمل) وكانت غائبة
            عن التصفّح. والقائمة تُجلب من TMDB لا تُكتب هنا — معرّفات
            المنصّات تتغيّر وتُدمَج، وقائمةٌ يدوية تصمت يوم تتغيّر.
            وتختفي المجموعة كلها إن تعذّر الجلب: خانةٌ فارغة أسوأ من لا خانة */}
        {providers.length > 0 && (
          <FilterGroup title={t.browseProviderGroup(regionName(region, lang))}>
            <Chip on={!draft.provider} onClick={() => set({ provider: null })}>
              {t.browseAnyProvider}
            </Chip>
            {providers.map((pr) => (
              <Chip
                key={pr.id}
                on={draft.provider === pr.id}
                onClick={() => set({ provider: draft.provider === pr.id ? null : pr.id })}
              >
                {pr.name}
              </Chip>
            ))}
          </FilterGroup>
        )}

        {/* ===== سنة الإصدار ===== */}
        <FilterGroup title={t.browseEraGroup}>
          <Chip on={!draft.era} onClick={() => set({ era: null })}>
            {t.browseAnyEra}
          </Chip>
          {BROWSE_ERAS.map((e) => (
            <Chip
              key={e.slug}
              on={draft.era === e.slug}
              onClick={() => set({ era: draft.era === e.slug ? null : e.slug })}
            >
              {browseEraName(e, lang)}
            </Chip>
          ))}
        </FilterGroup>

        {/* ===== أدنى تقييم ===== */}
        <FilterGroup title={t.browseRateGroup}>
          <Chip on={!draft.rate} onClick={() => set({ rate: null })}>
            {t.browseAnyRate}
          </Chip>
          {BROWSE_RATES.map((r) => (
            <Chip
              key={r}
              on={draft.rate === r}
              onClick={() => set({ rate: draft.rate === r ? null : r })}
            >
              {/* النجمة قبل الرقم في الجهتين: الرقم `dir="ltr"` وحده فلا
                  ينقلب «٨ فأعلى» إلى «فأعلى ٨» في الواجهة العربية */}
              <span className="inline-flex items-center gap-1">
                <Icon name="star" size={13} strokeWidth={2} />
                {t.browseRateFrom(num(r, locale))}
              </span>
            </Chip>
          ))}
        </FilterGroup>
      </div>

      {/* ===== الأفعال =====
          ملتصقةٌ بأسفل الورقة لا في نهاية التمرير: الورقة قد تُمرَّر على
          شاشةٍ قصيرة، وزرُّ التطبيق لا يجوز أن يُبحث عنه */}
      <div className="shrink-0 flex items-center gap-3 px-5 py-3 border-t border-[color:var(--divider)] bg-[color:var(--elevated)]">
        <button
          type="button"
          disabled={!dirty}
          onClick={() => {
            tap(6);
            setDraft(cleared);
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
          {t.browseApply}
        </button>
      </div>
    </Sheet>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="text-xs font-bold text-muted mb-2">{title}</h4>
      {/* تلتفّ ولا تُمرَّر: داخل الورقة العرضُ مضمونٌ والالتفاف يُظهر كل
          الخيارات دفعةً واحدة — الصفّ الممرَّر يُخفي نصفها خلف حافّة */}
      <div role="group" aria-label={title} className="flex flex-wrap gap-2">
        {children}
      </div>
    </section>
  );
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={chipClass(on)}>
      {children}
    </button>
  );
}
