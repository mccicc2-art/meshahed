"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getDict, num, type Locale } from "@/core/i18n";
import {
  BROWSE_COUNTRIES,
  BROWSE_COUNTRY_TOP,
  searchCountries,
  BROWSE_STATUSES,
  BROWSE_SEASONS,
  BROWSE_STUDIOS,
  browseStatusName,
  browseSeasonName,
  browseStudioName,
  BROWSE_ERAS,
  BROWSE_GENRES,
  BROWSE_LANGS,
  BROWSE_RATES,
  BROWSE_TAGS,
  browseCountryName,
  browseEraName,
  browseGenreName,
  browseLangName,
  browseTagName,
  genreFitsType,
  type BrowseRate,
  type BrowseType,
} from "@/core/browse";
import { AWARDS, awardName } from "@/core/awards";
import { regionName } from "@/core/region";
import { tap } from "@/lib/haptics";
import { Icon } from "./Icon";
import { Sheet, SheetHeader, SheetTabs } from "./ui/Sheet";
import { buttonClass } from "./ui/Button";
import { chipClass, sheetScroll } from "./ui/controls";
/* القسم الثاني في هذه الورقة — نفسُ المكوّن في المكتبة والمجتمع (D-179) */
import { TabsPrefs } from "./TabsPrefs";
import type { TabPref } from "@/core/tabPrefs";
import { RailsPrefs } from "./RailsPrefs";
import { type RailTab } from "@/core/railPrefs";
import { setMyRows } from "@/lib/actions";
import { serializeMyRows, MY_ROWS_MAX, type MyRow, type MyRowsTab } from "@/core/myRows";

export interface FilterDraft {
  /** slug النوع الدرامي — انتقل من صفّ التبويبات إلى قائمةٍ هنا (طلب المالك).
      جهةُ المحتوى غادرت المسوّدة كلياً: صارت تبويبات الرأس (أفلام/مسلسلات) */
  genre: string | null;
  lang: string | null;
  /** بلد الإنتاج — تابعٌ للعربية، ويسقط معها */
  country: string | null;
  /** معرّف منصّة الاشتراك عند TMDB */
  provider: number | null;
  era: string | null;
  rate: BrowseRate | null;
  /** slug وسم الموضوع — «عن ماذا؟» بجانب «من أيّ نوع؟» (طلب أحمد ١١ أغسطس) */
  tag: string | null;
  /** slug جائزة — الصفوف تصير فائزيها (طلب أحمد 9 Aug) */
  award: string | null;
  /** slug حالةِ المسلسل — تبويبُ المسلسلات وحده (D-196) */
  status: string | null;
  /** slug موسمِ الأنمي — تبويبُ الأنمي وحده (D-196) */
  season: string | null;
  /** slug استوديو الأنمي — تبويبُ الأنمي وحده (D-196) */
  studio: string | null;
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
 *
 * 🆕 **D-1550 نقض المنسدلات**: الشبكةُ بعمودين باقية، **لكنّ الخليّةَ صارت بطاقةً تفتح رقائقَ خياراتها تحت صفّها**
 * (`AxisGrid`) — المنسدلةُ تُخفي ما يمكن اختيارُه حتى تُفتح. `SelectField` باقٍ لصفوفك في تبويب «عرض».
 */
export function DiscoverFilterSheet({
  locale,
  type,
  initial,
  providers,
  region,
  axes,
  tabPrefs,
  hiddenRails = [],
  myRows: initialMyRows = [],
  rowsTab = null,
  tabLabels,
  onApply,
  onClose,
}: {
  locale: Locale;
  /** جهة التبويب المفتوح (أفلام/مسلسلات) — تقصّ قائمة الأنواع وحدها؛
      ليست خياراً هنا: الجهة صعدت إلى تبويبات الرأس (طلب أحمد 9 Aug) */
  type: BrowseType;
  initial: FilterDraft;
  /** منصّات المنطقة كما جاءت من TMDB — فارغةً حين يتعذّر جلبها */
  providers: { id: number; name: string }[];
  /** بلد المشاهدة — يُكتب في عنوان المجموعة فلا تُقرأ القائمة عالمية */
  region: string;
  /**
   * أيّ محاورَ تفتحها الورقة (D-180، طلب أحمد ١١ أغسطس):
   *
   * - `full` — الأعمال: المحاور السبعة كلّها.
   * - `anime` — أربعةٌ: النوع والحقبة والتقييم والمنصّة، ومعها الوسم.
   *   **وثلاثةٌ تغيب لأنها تكذب لا لأنها تزحم:** اللغةُ والجنسية
   *   جوابهما محسومٌ في تبويبٍ كلُّه يابانيّ، وقوائمُ الجوائز عندنا
   *   للأفلام والمسلسلات لا للأنمي — فخانةٌ تعود فارغةً دائماً خيارٌ كاذب.
   * - `none` — القوائم: تفضيلاتُ التبويبات وحدها؛ فلاترُ القوائم في
   *   ورقتها هي.
   *
   * **والباب لا يُغلق في وجه أيّ تبويب:** قسمُ التبويبات يظهر في الأحوال
   * الثلاثة، وهو سببُ ظهور الرمز في التبويبات الأربعة.
   */
  axes: "full" | "anime" | "none";
  /** تفضيلات تبويبات اكتشف — القسم الثاني في هذه الورقة */
  tabPrefs: TabPref[];
  /** 🆕 **صفوفُ اكتشف المطفأة** (D-826) — تأتي من الخادم فلا تومض */
  hiddenRails?: string[];
  /** 🆕 صفوفُك الخاصة (D-337) — القيمةُ الحاليّة من الكوكيز */
  myRows?: MyRow[];
  /** 🆕 D-1304 — التبويبُ الذي تُعرض صفوفُه وتُحفظ له؛ `null` («القوائم») يُخفي القسم */
  rowsTab?: MyRowsTab | null;
  tabLabels: Record<string, string>;
  onApply: (next: FilterDraft) => void;
  onClose: () => void;
}) {
  const t = getDict(locale);
  const lang = locale === "en" ? "en" : "ar";
  const [draft, setDraft] = useState<FilterDraft>(initial);
  const showFilters = axes !== "none";
  /* 🆕 **تبويبُ الصفوف يُشتقّ ولا يُمرَّر** (D-826): **الورقةُ تعرف
     `axes` و`type` أصلاً** — **ومعاملٌ ثالثٌ يقول ما يقولانه معاً
     يفترق عنهما يوماً** (D-462). **و«القوائم» (`none`) بلا صفوف.** */
  const railTab: RailTab | null =
    axes === "none" ? null : axes === "anime" ? "anime" : type === "tv" ? "shows" : "movies";
  /**
   * 🆕 **الورقةُ تبويبان كورقة المجتمع** (D-325، طلبُ أحمد: «الفلتر اعمله
   * ٢ تبويب مثل ما عملنا في الكومينتي»).
   *
   * **وهي بالضبط حجّةُ D-292/D-306 في سطحٍ ثانٍ**: سؤالان مختلفان في
   * ورقةٍ واحدة تبويبان لا فاصلٌ رمادي — **«بماذا أصفّي؟» و«كيف تُرتَّب
   * تبويباتي؟» لا يُقرآن معاً**، وكان القارئ يمرّر تسعَ منسدلاتٍ ليبلغ
   * ترتيبَ التبويبات.
   *
   * **والافتراضُ «أدوات»** — من فتح رمزَ الفلتر جاء يصفّي (D-152: الافتراضُ
   * هو السلوكُ القائم). **وحيث لا فلاتر أصلاً** (تبويب القوائم،
   * `axes === "none"`) **لا تبويبَ يُرسم**: شريطُ تبويبٍ أحدُ طرفيه فارغٌ
   * أداةٌ تكذب (D-075).
   */
  const [tab, setTab] = useState<"do" | "see">("do");
  /* 🆕 حالةُ صفوفك تفاؤليّةٌ محليّاً ثم كوكيز + تحديثُ الخادم (D-337) */
  const router = useRouter();
  const [myRows, setMyRowsState] = useState<MyRow[]>(initialMyRows);
  const [, startRows] = useTransition();
  function saveMyRow(i: number, genre: string | null, tagSlug: string | null) {
    tap(8);
    const next = [...myRows];
    if (!genre) next.splice(i, 1);
    else next[i] = { genre, tag: tagSlug };
    const clean = next.filter(Boolean).slice(0, MY_ROWS_MAX);
    setMyRowsState(clean);
    startRows(async () => {
      await setMyRows(serializeMyRows(clean), rowsTab ?? undefined).catch(() => {});
      router.refresh();
    });
  }
  /**
   * **اللغةُ والجنسيةُ والجائزةُ صارت في التبويبات الثلاثة — نقضٌ صريح
   * لـD-180** (مواصفةُ أحمد ١٢ أغسطس: التبويبات الثلاثة تحمل
   * `Original Language` و`Country of Origin` و`Award`).
   *
   * **وD-180 رفضها في الأنمي بحجّةٍ كانت معقولةً وصارت خطأً:** «الأنمي
   * يابانيٌّ بطبعه فمحورُ اللغة فيه بلا معنى». **والواقع أن الرسومَ
   * الآسيوية ليست يابانيةً كلَّها** — الصينيّة (donghua) والكوريّة صنفٌ
   * قائمٌ له جمهوره، **ومحورُ اللغة هو البابُ الوحيد إليه** بعد أن صار
   * الحارسُ يكتم ما لم يُطلب (D-194). فالمحورُ الذي كان زينةً صار طريقاً.
   *
   * **والجائزةُ أضعفُها ويُقال:** جوائزُ `awards.ts` أوسكارٌ وإيميٌّ وسعفة
   * — يفوز بها الأنمي نادراً، فالصفُّ قد يعود قصيراً. **لكنه قرارُ أحمد
   * الصريح، وقصرُ صفٍّ أهونُ من محورٍ يغيب بلا سبب مرئيّ.**
   */
  const wide = showFilters;
  const isAnime = axes === "anime";

  function set(patch: Partial<FilterDraft>) {
    tap(6);
    setDraft((d) => ({ ...d, ...patch }));
  }

  // الأنواع المتاحة لجهة التبويب — «رعب/رومانسي» للأفلام، «واقع» للمسلسلات
  const genres = BROWSE_GENRES.filter((g) => genreFitsType(g, type));

  const cleared: FilterDraft = {
    genre: null,
    lang: null,
    country: null,
    provider: null,
    era: null,
    rate: null,
    tag: null,
    award: null,
    status: null,
    season: null,
    studio: null,
  };
  const dirty =
    draft.genre !== null ||
    draft.lang !== null ||
    draft.country !== null ||
    draft.provider !== null ||
    draft.era !== null ||
    draft.rate !== null ||
    draft.tag !== null ||
    draft.award !== null ||
    draft.status !== null ||
    draft.season !== null ||
    draft.studio !== null;

  /* 🆕 D-1550 — المحاورُ بترتيب الشبكة القديمة وشروطِها حرفاً، وصفاً لا رسماً — `AxisGrid` يرسمها */
  const axisList: AxisSpec[] = [
    { id: "genre", label: t.browseGenreGroup, anyLabel: t.browseAllGenres, value: draft.genre, options: genres.map((g) => ({ value: g.slug, label: browseGenreName(g, lang) })), onPick: (v) => set({ genre: v }) },
    { id: "tag", label: t.browseTagGroup, anyLabel: t.browseAnyTag, value: draft.tag, options: BROWSE_TAGS.map((x) => ({ value: x.slug, label: browseTagName(x, lang) })), onPick: (v) => set({ tag: v }) },
    ...(wide
      ? [
          { id: "lang", label: t.browseLangGroup, anyLabel: t.browseAnyLang, value: draft.lang, options: BROWSE_LANGS.map((l) => ({ value: l.code, label: browseLangName(l, lang) })), onPick: (v: string | null) => set({ lang: v }) },
          { id: "country", label: t.browseCountryGroup, anyLabel: t.browseAnyCountry, value: draft.country, options: BROWSE_COUNTRIES.map((c) => ({ value: c.code, label: browseCountryName(c, lang) })), onPick: (v: string | null) => set({ country: v }), country: true },
        ]
      : []),
    ...(providers.length > 0
      ? [{ id: "provider", label: t.browseProviderGroup(regionName(region, lang)), anyLabel: t.browseAnyProvider, value: draft.provider ? String(draft.provider) : null, options: providers.map((pr) => ({ value: String(pr.id), label: pr.name })), onPick: (v: string | null) => set({ provider: v ? Number(v) : null }) }]
      : []),
    { id: "era", label: t.browseEraGroup, anyLabel: t.browseAnyEra, value: draft.era, options: BROWSE_ERAS.map((e) => ({ value: e.slug, label: browseEraName(e, lang) })), onPick: (v) => set({ era: v }) },
    {
      id: "rate",
      label: t.browseRateGroup,
      anyLabel: t.browseAnyRate,
      value: draft.rate ? String(draft.rate) : null,
      options: BROWSE_RATES.map((r) => ({ value: String(r), label: t.browseRateFrom(num(r, locale)) })),
      onPick: (v) => {
        const n = Number(v);
        set({ rate: v && (BROWSE_RATES as readonly number[]).includes(n) ? (n as BrowseRate) : null });
      },
    },
    ...(wide
      ? [{ id: "award", label: t.browseAwardGroup, anyLabel: t.browseAnyAward, value: draft.award, options: AWARDS.filter((a) => a.kind === (type === "tv" ? "tv" : "movie")).map((a) => ({ value: a.slug, label: awardName(a, lang) })), onPick: (v: string | null) => set({ award: v }) }]
      : []),
    ...(type === "tv" && !isAnime
      ? [{ id: "status", label: t.browseStatusGroup, anyLabel: t.browseAnyStatus, value: draft.status, options: BROWSE_STATUSES.map((x) => ({ value: x.slug, label: browseStatusName(x, lang) })), onPick: (v: string | null) => set({ status: v }) }]
      : []),
    ...(isAnime
      ? [
          { id: "season", label: t.browseSeasonGroup, anyLabel: t.browseAnySeason, value: draft.season, options: BROWSE_SEASONS.map((x) => ({ value: x.slug, label: browseSeasonName(x, lang) })), onPick: (v: string | null) => set({ season: v }) },
          { id: "studio", label: t.browseStudioGroup, anyLabel: t.browseAnyStudio, value: draft.studio, options: BROWSE_STUDIOS.map((x) => ({ value: x.slug, label: browseStudioName(x, lang) })), onPick: (v: string | null) => set({ studio: v }) },
        ]
      : []),
  ];

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
        title={t.discoverToolsTitle}
        closeLabel={t.closeLabel}
        onClose={onClose}
      >
        {showFilters && tab === "do" && (
          <p className="text-xs text-muted mt-0.5">{t.browseFiltersHint}</p>
        )}
      </SheetHeader>

      {/* **شريطُ التبويبين — وصفةُ `CommunityTools` حرفاً** (D-292):
          `segmentedTrackFull` + `segmentedItem`، **ولا عائلةَ تحكّمٍ ثالثة.**
          ⚠️ **والمفتاحان مُعادان من ورقة المجتمع عمداً**: الكلمتان هما
          الكلمتان («أدوات» و«عرض»)، **ومفتاحان مختلفا الاسم متطابقا
          المعنى ضجيجٌ لا يمسكه `tsc`** (D-254/D-300). */}
      {showFilters && (
        <SheetTabs
          prefix="disc-tools"
          label={t.discoverToolsTitle}
          tab={tab}
          onTab={setTab}
          doLabel={t.communityToolsTabDo}
          seeLabel={t.communityToolsTabSee}
        />
      )}

      <div className={`${sheetScroll} py-4 space-y-5`}>
        {showFilters && tab === "do" && (
        <div
          className="px-5 space-y-4"
          role="tabpanel"
          id="disc-tools-panel-do"
          aria-labelledby="disc-tools-tab-do"
        >
          <p className="text-12 font-bold text-muted">{t.browseFiltersGroup}</p>
        {/* نافذة الترتيب غادرت الورقة (D-099) والجهة لحقت بها (تبويبات
            الرأس — طلب أحمد 9 Aug): أداتان على نفس السؤال لبس */}
        {/* ===== 🆕 D-1550 — بطاقتان في الصفّ، والخياراتُ تنفتح تحت صفّها =====
            (أحمد ٢٦ أكتوبر على لقطة التطبيق: «مهي سهلة للمستخدم الجديد وسريعة للوصول للي يبيه» — «بطاقتين في الصف ..
            i1»، والويبُ معه: «أ»). **كانت المنسدلاتُ الأصليّةُ تُخفي خياراتها حتى تُفتح** (D-016/D-018/D-033 اختارتها
            لمُنتقي النظام وقارئ الشاشة) — **ونقضُ ذلك صريحٌ بطلبه**: القارئُ يرى الآن ما يمكن اختيارُه ضغطةً واحدة،
            والفلاترُ الأخرى أمامه وهو يختار. والوصولُ باقٍ: البطاقةُ زرٌّ بـ`aria-expanded`، والخياراتُ أزرارٌ بـ`aria-pressed`.
            **والمحاورُ وشروطُها والمسودّةُ كما هي** — الذي تبدّل طريقةُ الاختيار وحدَها. */}
        <AxisGrid axes={axisList} lang={lang} t={t} />
      </div>
        )}

        {/* **القسمُ الثاني صار تبويباً** (D-325) — `TabsPrefs` المشترك بلا
            أصنافٍ جانبية: صفوفُه تمتدّ إلى حافّتَي الورقة كصفوف أوراق
            «المزيد». **وحيث لا فلاتر يُعرض وحدَه بلا شريط تبويب.** */}
        {(!showFilters || tab === "see") && (
        <div role="tabpanel" id="disc-tools-panel-see" aria-labelledby="disc-tools-tab-see">
        {/* 🆕 **صفوفُك الخاصة — فوق التبويبات** (D-337، طلبُ أحمد بنصّه:
            «ميزة جديدة تحطها فوق التاب: يحدّد genre إجباريّاً ومعه ثيم
            اختياريّاً فيطلع عنوان مثل Drama zombies»).
            **القاموسان قاموسا الفلتر نفسُهما** (D-145) والحفظُ عند اللمس
            كتفضيلات التبويبات — لا زرَّ تطبيق. */}
        {/* 🆕 D-1304 — **صفوفُ التبويب المفتوح وحدَه** (أحمد: «ابغى حتى الرو منفصله عن بعض») — كقسم «صفوف هذا
            التبويب» تحته. والأنواعُ المعروضةُ ما يملك هذا التبويبُ منه شيئاً: نوعٌ بلا أعمالٍ هنا صفٌّ لا يظهر. */}
        {rowsTab && (
        <section className="px-5 pb-5">
          <h3 className="text-xs font-bold text-muted mb-1">{`${t.myRowsTitle} · ${tabLabels[rowsTab] ?? ""}`}</h3>
          <p className="text-12 text-muted mb-3">{t.myRowsHint}</p>
          <div className="space-y-3">
            {Array.from({ length: MY_ROWS_MAX }, (_, i) => {
              const row = myRows[i] ?? null;
              return (
                <div key={i} className="grid grid-cols-2 gap-3">
                  <SelectField
                    id={`myrow-genre-${i}`}
                    label={t.myRowsRow(num(i + 1, locale))}
                    active={!!row}
                    value={row?.genre ?? ""}
                    onChange={(v) => saveMyRow(i, v || null, row?.tag ?? null)}
                  >
                    <option value="">{t.myRowsGenreOff}</option>
                    {BROWSE_GENRES.filter((g) => (rowsTab === "movies" ? g.movie.length > 0 : g.tv.length > 0) || g.slug === row?.genre).map((g) => (
                      <option key={g.slug} value={g.slug}>
                        {browseGenreName(g, lang)}
                      </option>
                    ))}
                  </SelectField>
                  <SelectField
                    id={`myrow-tag-${i}`}
                    label={t.browseTagGroup}
                    active={!!row?.tag}
                    value={row?.tag ?? ""}
                    onChange={(v) => row && saveMyRow(i, row.genre, v || null)}
                  >
                    <option value="">{t.myRowsTagAny}</option>
                    {BROWSE_TAGS.map((x) => (
                      <option key={x.slug} value={x.slug}>
                        {browseTagName(x, lang)}
                      </option>
                    ))}
                  </SelectField>
                </div>
              );
            })}
          </div>
        </section>
        )}
        <TabsPrefs
          locale={locale}
          surface="discover"
          prefs={tabPrefs}
          labels={tabLabels}
          title={t.tabsPrefsGroup}
        />

        {/* 🆕 **وصفوفُ التبويب تحت تبويباته** (D-826، حكمُ أحمد: «يخفي
            أيَّ عنوانٍ من هذي العناوين، وتكون في فيو»): **«عرض» سؤالٌ
            واحدٌ — ما الذي يبقى بعد أن تُغلق الورقة؟ — والتبويباتُ
            والصفوفُ جوابان له.**
            ⚠️ **وتغيب في تبويب «القوائم»**: **لا صفوفَ أعمالٍ فيه**،
            **وقائمةٌ فارغةٌ تحت عنوانٍ تُقرأ عطلاً** (D-219/D-280). */}
        {railTab && (
          <RailsPrefs
            locale={locale}
            tab={railTab}
            hidden={hiddenRails}
            title={locale === "en" ? "This tab's rows" : "صفوف هذا التبويب"}
          />
        )}
        </div>
        )}
      </div>
      {/* ===== الأفعال =====
          ملتصقةٌ بأسفل الورقة لا في نهاية التمرير: الورقة قد تُمرَّر على
          شاشةٍ قصيرة، وزرُّ التطبيق لا يجوز أن يُبحث عنه */}
      {/* **وتغيب مع الفلاتر:** «مسح الكل» و«عرض النتائج» فعلا فلترة،
          وتفضيلاتُ التبويبات تُحفظ عند اللمس بلا زرّ تطبيق — فشريطٌ
          يقول «عرض النتائج» في ورقةٍ بلا فلاتر يَعِد بفعلٍ لا يقع */}
      {/* 🆕 **وتغيب في تبويب «عرض» أيضاً** (D-325): شريطٌ يقول «عرض
          النتائج» فوق ترتيبِ تبويباتٍ يَعِد بفعلٍ لا يقع — **وهو نفسُ
          الحكم الذي أغابه في ورقةٍ بلا فلاتر أصلاً.** */}
      {showFilters && tab === "do" && (
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
          )}
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

interface AxisSpec {
  id: string;
  label: string;
  anyLabel: string;
  /** القيمةُ المختارة نصّاً (`null` = الكلّ) */
  value: string | null;
  options: { value: string; label: string }[];
  onPick: (v: string | null) => void;
  /** لوحةُ البلد: بحثٌ و«الأكثر استخداماً» بدل الرقائق كلِّها */
  country?: boolean;
}

/**
 * 🆕 D-1550 — **شبكةُ البطاقات ولوحتُها** — بطاقتان في الصفّ، والضغطةُ تفتح لوحةَ خياراتٍ بعرض الشبكة تحت صفّها
 * (`col-span-2`) وسهمٌ صغيرٌ يشير إلى بطاقتها. ضغطةٌ على خيارٍ تختار وتطوي؛ لوحةٌ واحدةٌ في كلِّ وقت. **الرقائقُ
 * `chipClass` نفسُها** (القاعدة ٣) — لا عائلةَ ثالثة.
 */
function AxisGrid({ axes, lang, t }: { axes: AxisSpec[]; lang: "ar" | "en"; t: ReturnType<typeof getDict> }) {
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const rows: AxisSpec[][] = [];
  for (let i = 0; i < axes.length; i += 2) rows.push(axes.slice(i, i + 2));
  return (
    <div className="grid grid-cols-2 gap-3">
      {rows.map((row) => {
        const col = row.findIndex((a) => a.id === open);
        const ax = col >= 0 ? row[col] : null;
        return (
          <Fragment key={row.map((a) => a.id).join("-")}>
            {row.map((a) => {
              const isOpen = open === a.id;
              const chosen = a.value !== null ? (a.options.find((o) => o.value === a.value)?.label ?? a.value) : null;
              return (
                <button
                  key={a.id}
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`axis-panel-${a.id}`}
                  onClick={() => {
                    tap(6);
                    setQ("");
                    setOpen(isOpen ? null : a.id);
                  }}
                  className={`min-w-0 flex items-center gap-2 rounded-control border bg-surface-2 ps-3.5 pe-3 py-2.5 text-start transition ${
                    chosen || isOpen ? "border-accent" : "border-border hover:border-accent/50"
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-muted truncate">{a.label}</span>
                    <span className={`block text-15 font-semibold truncate ${chosen ? "text-accent" : "text-foreground"}`}>
                      {chosen ?? a.anyLabel}
                    </span>
                  </span>
                  <Icon
                    name="chevron-down"
                    size={16}
                    strokeWidth={2.2}
                    className={`transition-transform ${isOpen ? "rotate-180 text-accent" : "text-muted"}`}
                  />
                </button>
              );
            })}
            {ax && (
              <div
                id={`axis-panel-${ax.id}`}
                className="col-span-2 relative rounded-control border border-border bg-surface-2 p-3 space-y-2.5"
              >
                {/* السهمُ يشير إلى بطاقته: مربّعٌ مُدارٌ بحدّين يلتحم بحدّ اللوحة */}
                <span
                  aria-hidden
                  className={`pointer-events-none absolute -top-[7px] size-3 rotate-45 border-t border-l border-border bg-surface-2 ${
                    col === 0 ? "start-[calc(25%-6px)]" : "start-[calc(75%-6px)]"
                  }`}
                />
                {ax.country ? (
                  <CountryPanel q={q} onQ={setQ} axis={ax} lang={lang} t={t} onDone={() => setOpen(null)} />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {[{ value: "", label: ax.anyLabel }, ...ax.options].map((o) => {
                      const sel = o.value === "" ? ax.value === null : ax.value === o.value;
                      return (
                        <button
                          key={o.value || "any"}
                          type="button"
                          aria-pressed={sel}
                          onClick={() => {
                            ax.onPick(o.value || null);
                            setOpen(null);
                          }}
                          className={chipClass(sel)}
                        >
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

/**
 * 🆕 D-1550 — **لوحةُ البلد: بحثٌ ثمّ «الأكثر استخداماً»** (أحمد «أ»). الحقلُ بخطّ ١٦ (D-033: سفاري لا يكبّر)،
 * **والمختارُ يبقى ظاهراً** وإن لم يكن من الاثني عشر.
 */
function CountryPanel({
  q,
  onQ,
  axis,
  lang,
  t,
  onDone,
}: {
  q: string;
  onQ: (v: string) => void;
  axis: AxisSpec;
  lang: "ar" | "en";
  t: ReturnType<typeof getDict>;
  onDone: () => void;
}) {
  const typing = q.trim().length > 0;
  const cur = axis.value;
  const list = typing
    ? searchCountries(q)
    : [
        ...(cur && !BROWSE_COUNTRY_TOP.includes(cur) ? BROWSE_COUNTRIES.filter((c) => c.code === cur) : []),
        ...BROWSE_COUNTRY_TOP.map((code) => BROWSE_COUNTRIES.find((c) => c.code === code)).filter(
          (c): c is (typeof BROWSE_COUNTRIES)[number] => !!c,
        ),
      ];
  const pick = (v: string | null) => {
    axis.onPick(v);
    onDone();
  };
  return (
    <>
      <label className="flex items-center gap-2 rounded-full border border-border bg-background ps-3.5 pe-2 min-h-11 focus-within:border-accent">
        <Icon name="search" size={16} className="text-muted" />
        <input
          type="search"
          value={q}
          onChange={(e) => onQ(e.target.value)}
          placeholder={t.browseCountrySearch}
          aria-label={t.browseCountrySearch}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none placeholder:text-muted"
        />
      </label>
      {!typing && <p className="text-xs text-muted">{t.browseMostUsed}</p>}
      <div className="flex flex-wrap gap-2">
        {!typing && (
          <button type="button" aria-pressed={cur === null} onClick={() => pick(null)} className={chipClass(cur === null)}>
            {axis.anyLabel}
          </button>
        )}
        {list.map((c) => (
          <button key={c.code} type="button" aria-pressed={cur === c.code} onClick={() => pick(c.code)} className={chipClass(cur === c.code)}>
            {browseCountryName(c, lang)}
          </button>
        ))}
        {typing && list.length === 0 && <p className="text-sm text-muted py-1">{t.browseNoMatch}</p>}
      </div>
    </>
  );
}
