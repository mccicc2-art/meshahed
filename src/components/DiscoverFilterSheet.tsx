"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getDict, num, type Locale } from "@/lib/i18n";
import {
  BROWSE_COUNTRIES,
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
} from "@/lib/browse";
import { AWARDS, awardName } from "@/lib/awards";
import { regionName } from "@/lib/region";
import { tap } from "@/lib/haptics";
import { Icon } from "./Icon";
import { Sheet, SheetHeader, SheetTabs } from "./ui/Sheet";
import { buttonClass } from "./ui/Button";
import { sheetScroll } from "./ui/controls";
/* القسم الثاني في هذه الورقة — نفسُ المكوّن في المكتبة والمجتمع (D-179) */
import { TabsPrefs } from "./TabsPrefs";
import type { TabPref } from "@/lib/tabPrefs";
import { RailsPrefs } from "./RailsPrefs";
import { type RailTab } from "@/lib/railPrefs";
import { setMyRows } from "@/lib/actions";
import { serializeMyRows, MY_ROWS_MAX, type MyRow } from "@/lib/myRows";

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
      await setMyRows(serializeMyRows(clean)).catch(() => {});
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

          {/* ===== الوسم — المحور الجديد (طلب أحمد ١١ أغسطس) =====
              يجلس ثانياً بجانب النوع لا في الذيل: هما سؤالان متجاوران —
              «من أيّ نوع؟» و«عن ماذا؟» — ومن يفتح الورقة يقرؤهما معاً */}
          <SelectField
            id="browse-tag"
            label={t.browseTagGroup}
            active={!!draft.tag}
            value={draft.tag ?? ""}
            onChange={(v) => set({ tag: v || null })}
          >
            <option value="">{t.browseAnyTag}</option>
            {BROWSE_TAGS.map((x) => (
              <option key={x.slug} value={x.slug}>
                {browseTagName(x, lang)}
              </option>
            ))}
          </SelectField>

          {wide && (
            <SelectField
              id="browse-lang"
              label={t.browseLangGroup}
              active={!!draft.lang}
              value={draft.lang ?? ""}
              onChange={(v) => set({ lang: v || null })}
            >
              <option value="">{t.browseAnyLang}</option>
              {BROWSE_LANGS.map((l) => (
                <option key={l.code} value={l.code}>
                  {browseLangName(l, lang)}
                </option>
              ))}
            </SelectField>
          )}

          {/* الجنسية محورٌ دائم (طلب أحمد 9 Aug) — كان يظهر مع العربية وحدها */}
          {wide && (
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

          {/* الجائزة (طلب أحمد 9 Aug): اختيارُها يحوّل الصفحة إلى صفّ
              الفائزين بالأحدث — قوائمها الكاملة في تبويب القوائم */}
          {wide && (
            <SelectField
              id="browse-award"
              label={t.browseAwardGroup}
              active={!!draft.award}
              value={draft.award ?? ""}
              onChange={(v) => set({ award: v || null })}
            >
              <option value="">{t.browseAnyAward}</option>
              {AWARDS.filter((a) => a.kind === (type === "tv" ? "tv" : "movie")).map((a) => (
                <option key={a.slug} value={a.slug}>
                  {awardName(a, lang)}
                </option>
              ))}
            </SelectField>
          )}

          {/* **المحاورُ الثلاثة تظهر حيث تعني شيئاً وتغيب حيث لا تعني**
              (مواصفةُ أحمد: «Filters should be dynamic depending on the
              selected tab»). **ومحورٌ يظهر في تبويبٍ لا يقبله كذبٌ في
              الواجهة** — نفسُ قاعدة D-075 التي تُخفي زرَّ الفلاتر عن تبويب
              القوائم. */}

          {/* الحالة — المسلسلات وحدها. و«الأفلام» لا حالةَ لها عند TMDB
              (`with_status` معاملُ `/discover/tv` وحده، ويردّ خطأً في
              الأفلام) — فالغيابُ هنا قيدُ مصدرٍ لا اختيارُ تصميم. */}
          {type === "tv" && !isAnime && (
            <SelectField
              id="browse-status"
              label={t.browseStatusGroup}
              active={!!draft.status}
              value={draft.status ?? ""}
              onChange={(v) => set({ status: v || null })}
            >
              <option value="">{t.browseAnyStatus}</option>
              {BROWSE_STATUSES.map((x) => (
                <option key={x.slug} value={x.slug}>
                  {browseStatusName(x, lang)}
                </option>
              ))}
            </SelectField>
          )}

          {/* الموسمُ والاستوديو — الأنمي وحده. وهما مفرداتُ صناعته: الموسمُ
              ربعُ سنةٍ (لا شهر)، والاستوديو اسمٌ يعرفه متابعُه ويختار به. */}
          {isAnime && (
            <SelectField
              id="browse-season"
              label={t.browseSeasonGroup}
              active={!!draft.season}
              value={draft.season ?? ""}
              onChange={(v) => set({ season: v || null })}
            >
              <option value="">{t.browseAnySeason}</option>
              {BROWSE_SEASONS.map((x) => (
                <option key={x.slug} value={x.slug}>
                  {browseSeasonName(x, lang)}
                </option>
              ))}
            </SelectField>
          )}

          {isAnime && (
            <SelectField
              id="browse-studio"
              label={t.browseStudioGroup}
              active={!!draft.studio}
              value={draft.studio ?? ""}
              onChange={(v) => set({ studio: v || null })}
            >
              <option value="">{t.browseAnyStudio}</option>
              {BROWSE_STUDIOS.map((x) => (
                <option key={x.slug} value={x.slug}>
                  {browseStudioName(x, lang)}
                </option>
              ))}
            </SelectField>
          )}
        </div>
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
        <section className="px-5 pb-5">
          <h3 className="text-xs font-bold text-muted mb-1">{t.myRowsTitle}</h3>
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
                    {BROWSE_GENRES.map((g) => (
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
