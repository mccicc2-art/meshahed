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
import { segmentedItem, segmentedTrackFull } from "./ui/controls";

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
 * لماذا ورقةٌ لا صفوفُ رقائقٍ في الصفحة: الفلاتر ستة محاور؛ لو فُرشت
 * كلّها لأكلت الشاشة الأولى كاملةً وصار المحتوى — وهو سبب الزيارة — تحت
 * الطيّة. والتطبيق دفعةً واحدة لا عند كل لمسة: كل تغييرٍ يعيد رسم الصفحة
 * على الخادم ويطلب TMDB، ومن يريد «تركي + ٢٠٢٠ + ٨ فأعلى» كان سيدفع
 * ثلاث جولاتٍ يرى في اثنتين منها نتائج لا يريدها. المسوّدة محليّة،
 * و«عرض النتائج» وحده يمسّ الرابط.
 *
 * **الشكل شبكةُ منسدلاتٍ بعمودين — قرار المالك (لقطة TMDB مرجعاً):**
 * كل محاور القوائم صارت `<select>` أصلية متراصّةً بعمودين، فقصُرت الورقة
 * من شاشات تمريرٍ عدّة إلى شاشةٍ واحدة. والأصلية لا المصنوعة للأسباب
 * القائمة (D-016/D-018/D-033: مُنتقي النظام على الجوال، قارئ الشاشة،
 * وخط ١٦ حتى لا يكبّر سفاري). **واستُبقي المقسّمان** — نافذة الترتيب
 * وجهة المحتوى — لأن ثلاثة خياراتٍ ظاهرةً تُلمس لمسةً واحدة، ومنسدلةٌ
 * لثلاثة خيارات ضغطةٌ إضافية بلا مقابل (نفس منطق لقطة TMDB التي أبقت
 * Simple/Advanced مقسّماً).
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

        {/* ===== شبكة المنسدلات — عمودان (طلب المالك، لقطة TMDB) =====
            الرقائق سقطت كلّها: قوائمُ تُختار منها قيمةٌ واحدة، والمنسدلة
            الأصلية تختصر كل قائمةٍ إلى سطرٍ مهما طالت. البلد يظهر خليةً
            تحت العربية وحدها، والمنصّات تغيب خليتها إن تعذّر جلبها. */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-4">
          <SelectField
            id="browse-genre"
            label={t.browseGenreGroup}
            active={!!draft.genre}
            value={draft.genre ?? ""}
            onChange={(v) => set({ genre: v || null })}
          >
            <option value="">{t.browseAllGenres}</option>
            {genres.map((g) => (
              <option key={g.slug} value={g.slug}>
                {browseGenreName(g, lang)}
              </option>
            ))}
          </SelectField>

          <SelectField
            id="browse-lang"
            label={t.browseLangGroup}
            active={!!draft.lang}
            value={draft.lang ?? ""}
            /* مغادرة العربية تُسقط البلد معها — انظر showCountry */
            onChange={(v) => set({ lang: v || null, country: null })}
          >
            <option value="">{t.browseAnyLang}</option>
            {BROWSE_LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {browseLangName(l, lang)}
              </option>
            ))}
          </SelectField>

          {showCountry && (
            <SelectField
              id="browse-country"
              label={t.browseCountryGroup}
              active={!!draft.country}
              value={draft.country ?? ""}
              onChange={(v) => set({ country: v || null })}
            >
              <option value="">{t.browseAnyCountry}</option>
              {BROWSE_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {browseCountryName(c, lang)}
                </option>
              ))}
            </SelectField>
          )}

          {providers.length > 0 && (
            <SelectField
              id="browse-provider"
              label={t.browseProviderGroup(regionName(region, lang))}
              active={!!draft.provider}
              value={draft.provider ? String(draft.provider) : ""}
              onChange={(v) => set({ provider: v ? Number(v) : null })}
            >
              <option value="">{t.browseAnyProvider}</option>
              {providers.map((pr) => (
                <option key={pr.id} value={pr.id}>
                  {pr.name}
                </option>
              ))}
            </SelectField>
          )}

          <SelectField
            id="browse-era"
            label={t.browseEraGroup}
            active={!!draft.era}
            value={draft.era ?? ""}
            onChange={(v) => set({ era: v || null })}
          >
            <option value="">{t.browseAnyEra}</option>
            {BROWSE_ERAS.map((e) => (
              <option key={e.slug} value={e.slug}>
                {browseEraName(e, lang)}
              </option>
            ))}
          </SelectField>

          <SelectField
            id="browse-rate"
            label={t.browseRateGroup}
            active={!!draft.rate}
            value={draft.rate ? String(draft.rate) : ""}
            onChange={(v) => {
              const n = Number(v);
              set({
                rate: (BROWSE_RATES as readonly number[]).includes(n)
                  ? (n as BrowseRate)
                  : null,
              });
            }}
          >
            <option value="">{t.browseAnyRate}</option>
            {BROWSE_RATES.map((r) => (
              /* بلا نجمة داخل الخيار: `<option>` نصٌّ خام لا يحمل أيقونة،
                 والمحرف ★ خطُّ نظامٍ يتقلّب شكله (D-002) — العنوان يكفي */
              <option key={r} value={r}>
                {t.browseRateFrom(num(r, locale))}
              </option>
            ))}
          </SelectField>
        </div>
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

/**
 * خليّة منسدلةٍ واحدة: عنوانٌ فوق `<select>` أصلية بسهمٍ مرسوم.
 *
 * مساعدٌ محليّ لا مكوّنُ نظامٍ جديد: يجمع الهندسة التي كانت مكرّرةً
 * لمنسدلتَي النوع والمنصّات ويعمّمها على الشبكة كلّها. الخط ١٦ (D-033)،
 * واللون يشتدّ حين تحمل المنسدلة اختياراً — نفس لغة الرقائق السابقة.
 */
function SelectField({
  id,
  label,
  active,
  value,
  onChange,
  children,
}: {
  id: string;
  label: string;
  /** هل تحمل قيمةً غير الافتراضي؟ — يشدّ الحدّ واللون */
  active: boolean;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-xs font-bold text-muted mb-2 truncate">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full appearance-none rounded-control border bg-surface-2 ps-3.5 pe-9 py-3 text-base font-semibold outline-none transition focus:border-accent truncate ${
            active ? "border-accent text-accent" : "border-border text-foreground"
          }`}
        >
          {children}
        </select>
        <span
          className="pointer-events-none absolute inset-y-0 end-3 grid place-items-center text-muted"
          aria-hidden
        >
          <Icon name="chevron-down" size={16} strokeWidth={2.2} />
        </span>
      </div>
    </div>
  );
}
