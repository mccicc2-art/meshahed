"use client";

import { useState } from "react";
import { getDict, num, type Locale } from "@/lib/i18n";
import {
  BROWSE_COUNTRIES,
  BROWSE_ERAS,
  BROWSE_GENRES,
  BROWSE_LANGS,
  BROWSE_RATES,
  browseCountryName,
  browseEraName,
  browseGenreName,
  browseLangName,
  genreFitsType,
  type BrowseRate,
  type BrowseType,
  type BrowseWin,
} from "@/lib/browse";
import { regionName } from "@/lib/region";
import { tap } from "@/lib/haptics";
import { Icon } from "./Icon";
import { Sheet, SheetHeader } from "./ui/Sheet";
import { buttonClass } from "./ui/Button";
import { chipClass, segmentedItem, segmentedTrackFull } from "./ui/controls";

export interface FilterDraft {
  /** نافذة الترتيب — انتقلت من الرأس إلى هنا لمّا أخذ التبويبان مكانها */
  win: BrowseWin;
  type: BrowseType;
  /** slug النوع الدرامي — انتقل من صفّ التبويبات إلى قائمةٍ هنا (طلب المالك) */
  genre: string | null;
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

  const WINS: { value: BrowseWin; label: string }[] = [
    { value: "week", label: t.winWeek },
    { value: "year", label: t.winYear },
    { value: "all", label: t.winAll },
  ];

  function set(patch: Partial<FilterDraft>) {
    tap(6);
    setDraft((d) => ({ ...d, ...patch }));
  }

  // تغيير الجهة قد يُسقط النوع المختار: «رعب» لا مقابل له في المسلسلات،
  // فبدل قائمةٍ لا تجد شيئاً يعود النوع إلى «كل الأنواع» بصمت
  function setType(next: BrowseType) {
    tap(6);
    setDraft((d) => {
      const g = BROWSE_GENRES.find((x) => x.slug === d.genre);
      const keepGenre = g && genreFitsType(g, next) ? d.genre : null;
      return { ...d, type: next, genre: keepGenre };
    });
  }

  // الأنواع المتاحة للجهة الحالية — «رعب/رومانسي» للأفلام، «واقع» للمسلسلات
  const genres = BROWSE_GENRES.filter((g) => genreFitsType(g, draft.type));

  const cleared: FilterDraft = {
    win: "week",
    type: "all",
    genre: null,
    lang: null,
    country: null,
    provider: null,
    era: null,
    rate: null,
  };
  const dirty =
    draft.win !== "week" ||
    draft.type !== "all" ||
    draft.genre !== null ||
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
        {/* ===== نافذة الترتيب =====
            انتقلت من رأس الصفحة إلى هنا لمّا أخذ تبويبا «أفلام ومسلسلات /
            القوائم» مكانها (طلب المالك). أوّلَ الورقة لا وسطها: هي تُغيّر
            معنى «الأفضل» في الرفوف كلّها، وبقيّة المحاور تقصّ داخله. */}
        <section>
          <h4 className="text-xs font-bold text-muted mb-2">{t.winGroup}</h4>
          <div role="group" aria-label={t.winGroup} className={segmentedTrackFull}>
            {WINS.map((w) => (
              <button
                key={w.value}
                type="button"
                aria-pressed={draft.win === w.value}
                onClick={() => set({ win: w.value })}
                className={segmentedItem(draft.win === w.value, "flex-1")}
              >
                {w.label}
              </button>
            ))}
          </div>
        </section>

        {/* ===== جهة المحتوى ===== */}
        <section>
          <h4 className="text-xs font-bold text-muted mb-2">{t.browseTypeGroup}</h4>
          <div role="group" aria-label={t.browseTypeGroup} className={segmentedTrackFull}>
            {TYPES.map((o) => (
              <button
                key={o.value}
                type="button"
                aria-pressed={draft.type === o.value}
                onClick={() => setType(o.value)}
                className={segmentedItem(draft.type === o.value, "flex-1")}
              >
                {o.label}
              </button>
            ))}
          </div>
        </section>

        {/* ===== التصنيف =====
            انتقل من صفّ تبويباتٍ في الرأس إلى قائمةٍ هنا (طلب المالك): مكانه
            صار لنافذة الترتيب أعلى الصفحة. وقائمةٌ لا رقائق — خمسة عشر نوعاً
            بالرقائق جدارٌ يملأ الورقة (نفس حجّة منصّات البث): ما فوق العشرة
            قائمة. أصليّةٌ `<select>` لا مصنوعة (D-018/D-033، خطّها ١٦). */}
        <section>
          <label htmlFor="browse-genre" className="block text-xs font-bold text-muted mb-2">
            {t.browseGenreGroup}
          </label>
          <div className="relative">
            <select
              id="browse-genre"
              value={draft.genre ?? ""}
              onChange={(e) => {
                tap(6);
                const v = e.target.value;
                setDraft((d) => ({ ...d, genre: v || null }));
              }}
              className={`w-full appearance-none rounded-control border bg-surface-2 ps-3.5 pe-10 py-3 text-base font-semibold outline-none transition focus:border-accent ${
                draft.genre ? "border-accent text-accent" : "border-border text-foreground"
              }`}
            >
              <option value="">{t.browseAllGenres}</option>
              {genres.map((g) => (
                <option key={g.slug} value={g.slug}>
                  {browseGenreName(g, lang)}
                </option>
              ))}
            </select>
            <span
              className="pointer-events-none absolute inset-y-0 end-3.5 grid place-items-center text-muted"
              aria-hidden
            >
              <Icon name="chevron-down" size={16} strokeWidth={2.2} />
            </span>
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
            وتختفي المجموعة كلها إن تعذّر الجلب: خانةٌ فارغة أسوأ من لا خانة.

            **قائمةٌ منسدلة لا رقائق — وهذا ليس خروجاً على العائلتين.**
            الرقيقة لقائمةٍ تُقرأ بلمحة؛ ومنصّات بلدٍ واحد تبلغ عشرات، وهي
            بالرقائق جدارٌ يملأ الورقة ويدفن ما تحته (نفس الحجّة التي
            أبقت قائمة اللغات سبعاً). فالحدّ: ما دون عشرة خياراتٍ رقائق،
            وما فوقها قائمة.

            وقائمةٌ أصليّة `<select>` لا منسدلةٌ مصنوعة: هذه ورقةٌ تحبس
            التمرير وتحبس التركيز، والمنسدلة المصنوعة داخلها هي بالضبط
            حيث تسكن العلل. والأصليّة تفتح مُنتقي النظام على الجوال، وتُقرأ
            بقارئ الشاشة، وتُبحث بالكتابة. وخطّها ١٦ بكسلاً (D-033) وإلا
            كبّر سفاري الصفحة عند فتحها. */}
        {providers.length > 0 && (
          <section>
            <label
              htmlFor="browse-provider"
              className="block text-xs font-bold text-muted mb-2"
            >
              {t.browseProviderGroup(regionName(region, lang))}
            </label>
            <div className="relative">
              <select
                id="browse-provider"
                value={draft.provider ?? ""}
                onChange={(e) => {
                  tap(6);
                  const v = e.target.value;
                  setDraft((d) => ({ ...d, provider: v ? Number(v) : null }));
                }}
                className={`w-full appearance-none rounded-control border bg-surface-2 ps-3.5 pe-10 py-3 text-base font-semibold outline-none transition focus:border-accent ${
                  draft.provider ? "border-accent text-accent" : "border-border text-foreground"
                }`}
              >
                <option value="">{t.browseAnyProvider}</option>
                {providers.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.name}
                  </option>
                ))}
              </select>
              <span
                className="pointer-events-none absolute inset-y-0 end-3.5 grid place-items-center text-muted"
                aria-hidden
              >
                <Icon name="chevron-down" size={16} strokeWidth={2.2} />
              </span>
            </div>
          </section>
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
