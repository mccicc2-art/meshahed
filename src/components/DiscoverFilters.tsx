"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getDict, num, type Locale } from "@/lib/i18n";
import {
  BROWSE_COUNTRIES,
  BROWSE_ERAS,
  BROWSE_GENRES,
  BROWSE_LANGS,
  BROWSE_TAGS,
  browseCountryName,
  browseEraName,
  browseGenreName,
  browseHref,
  browseLangName,
  browseTagName,
  genreFitsType,
  type BrowseRate,
  type BrowseType,
  type DiscoverTab,
  BROWSE_STATUSES,
  BROWSE_SEASONS,
  BROWSE_STUDIOS,
  browseStatusName,
  browseSeasonName,
  browseStudioName,
} from "@/lib/browse";
import { AWARDS, awardName } from "@/lib/awards";
import { tap } from "@/lib/haptics";
import { Icon } from "./Icon";
import { FilterIconButton } from "./ui/FilterIconButton";
import { ListsFilters, type ListsFiltersProps } from "./ListsFilters";
import { DiscoverFilterSheet, type FilterDraft } from "./DiscoverFilterSheet";
import { PageTabs } from "./ui/PageTabs";
import { applyTabPrefs, type TabPref } from "@/lib/tabPrefs";
import type { MyRow } from "@/lib/myRows";

/**
 * رأس «اكتشف».
 *
 * الحالة في الرابط لا في الذاكرة: `/news?type=movie&g=drama&lang=tr` قابل
 * للمشاركة وللرجوع، والصفحة تُرسم على الخادم بالفلتر مطبَّقاً فلا وميضَ
 * قائمةٍ قديمة قبل الجديدة. وقيمُ الافتراض تُحذف من الرابط فيبقى نظيفاً.
 *
 * `replace` لا `push`: التبويبات تُلمس عشرات المرّات في جلسةٍ واحدة، ولو
 * سجّلنا كلّ لمسة لصار زرّ الرجوع يمشي بالمستخدم خطوةً خطوة عبر فلاترٍ
 * جرّبها ونسيها بدل أن يخرجه من التصفّح.
 *
 * ثلاث طبقاتٍ لا صفٌّ واحد يجمعها كلّها — والترتيب مقصود:
 *  1. **التبويبان «أفلام ومسلسلات / القوائم»** بخطٍّ سفليّ (طلب المالك):
 *     أعلى الرأس صار مفترقَ صنفَي الصفحة لا محورَ فلترة — والقوائم صنفٌ
 *     كامل له بحثه، لا فلتر يُقصّ به المعروض. نافذة الترتيب التي كانت
 *     هنا انتقلت إلى داخل الورقة مع أخواتها.
 *  2. **رقائق ما اختير**: الفلتر المخفيّ خلف ورقةٍ يُنسى — فما اختير يبقى
 *     مكتوباً تحت التبويبات ويُلغى بلمسةٍ على ×، بلا فتح الورقة ثانيةً.
 *     وأولُ الرقائق «تعديل الفلتر» — البابُ الوحيد الباقي هنا.
 *
 * **وزرّ الفلتر عاد إلى هذا الرأس (D-177) — نقضٌ صريح لـD-174.** نُقل قبل
 * ساعاتٍ إلى صفحة البحث بطلب أحمد، **ثم رجع عن طلبه بنصّه**: «أرجع عن كلامي
 * أن يكون الفلتر داخل البحث». والسبب الذي جعل الرجوع صحيحاً: الفلتر صار
 * **رمزاً بلا كلمة** (`FilterIconButton`)، فالحجّة التي بُني عليها النقل —
 * أنه يزاحم صفّ التبويبات — سقطت. **والفلتر حيث تُعرض نتيجتُه أقرب.**
 *
 * وسقط من هنا قبلَه شيئان: صفُّ الترتيب (لكل صفٍّ ترتيبه بحكم معناه بعد أن
 * صار الفلتر يُبقي الصفوف ولا يستبدلها بشبكة)، ومدخلُ البحث (صار له تبويبه
 * في الشريط السفلي، ومدخلان لفعلٍ واحد في شاشةٍ واحدة زيادة). قرارُ المالك.
 */
export function DiscoverFilters({
  locale,
  tab = "movies",
  type,
  genre,
  lang,
  country,
  provider,
  providers,
  region,
  era,
  rate,
  tag,
  award,
  status,
  season,
  studio,
  listsFilters,
  tabPrefs,
  myRows = [],
}: {
  locale: Locale;
  /** ترتيبُ تبويبات اكتشف وإظهارها — من الكوكي على الخادم (D-014) */
  tabPrefs: TabPref[];
  /** 🆕 صفوفُك الخاصة (D-337) — تمرّ إلى الورقة؛ اختياريّةٌ كي تُنشر الدفعات بترتيب D-028 */
  myRows?: MyRow[];
  /** فلاتر تبويب القوائم — يرسم زرّها في خانة زرّ الأعمال نفسها
      (طلب أحمد: «مكان الفلتر مثل الأفلام والمسلسلات») */
  listsFilters?: ListsFiltersProps;
  /** التبويب المفتوح — أعمالٌ أو قوائم؛ الفلاتر كلّها لتبويب الأعمال وحده.
      اختياريٌّ بافتراض الأعمال: يُبقي المكوّن مُصرَّفاً بين لقطة المكوّنات
      ولقطة الصفحة أثناء الرفع المرتّب (صفر ERROR وسيط) */
  tab?: DiscoverTab;
  type: BrowseType;
  /** slug التصنيف المختار — صار داخل الورقة */
  genre: string | null;
  /** رمز اللغة المختارة */
  lang: string | null;
  /** رمز بلد الإنتاج المختار — مع العربية وحدها */
  country: string | null;
  /** معرّف المنصّة المختارة */
  provider: number | null;
  /** منصّات المنطقة — تُجلب على الخادم وتُمرَّر للورقة */
  providers: { id: number; name: string }[];
  /** بلد المشاهدة المختار */
  region: string;
  /** slug الحقبة المختارة */
  era: string | null;
  rate: BrowseRate | null;
  /** slug وسم الموضوع المختار — زومبي، سرقات… */
  tag: string | null;
  /** slug الجائزة المختارة — يحوّل الصفوف إلى فائزيها */
  award: string | null;
  /* الثلاثةُ الجديدة (D-196) — **اختياريّةٌ لسببٍ تشغيليّ لا تصميميّ:**
     النشرُ مجلّداً مجلّداً، فرفعةُ `components` تُبنى قبل أن تصل رفعةُ
     `app` التي تُمرّرها. وغيابُها = «لا شيء مختار». */
  status?: string | null;
  season?: string | null;
  studio?: string | null;
}) {
  const t = getDict(locale);
  const loc = locale === "en" ? "en" : "ar";
  const router = useRouter();
  const [pending, start] = useTransition();
  const [sheet, setSheet] = useState(false);

  function go(next: {
    g?: string | null;
    lang?: string | null;
    co?: string | null;
    p?: number | null;
    era?: string | null;
    rate?: BrowseRate | null;
    tag?: string | null;
    award?: string | null;
    st?: string | null;
    se?: string | null;
    std?: string | null;
  }) {
    let nextGenre = next.g === undefined ? genre : next.g;

    // تصنيفٌ لا مقابل له في جهة التبويب («رعب» في المسلسلات) يسقط بصمت
    const found = BROWSE_GENRES.find((g) => g.slug === nextGenre);
    if (!found || !genreFitsType(found, type)) nextGenre = null;

    // الجنسية محورٌ مستقلّ (طلب أحمد): لا تسقط بتبدّل اللغة
    // والرابطُ يبنيه `browseHref` وحده (D-174) — الجهة يحملها التبويب
    const href = browseHref({
      tab,
      g: nextGenre,
      lang: next.lang === undefined ? lang : next.lang,
      co: next.co === undefined ? country : next.co,
      p: next.p === undefined ? provider : next.p,
      era: next.era === undefined ? era : next.era,
      rate: next.rate === undefined ? rate : next.rate,
      tag: next.tag === undefined ? tag : next.tag,
      award: next.award === undefined ? award : next.award,
      st: next.st === undefined ? status : next.st,
      se: next.se === undefined ? season : next.se,
      std: next.std === undefined ? studio : next.std,
    });

    tap(8);
    start(() => router.replace(href, { scroll: false }));
  }

  /* `push` لا `replace` (ذاكرة التنقل — تدقيق 8 Aug م١): التبويب تبديلُ
     نوعِ صفحةٍ لا لمسةُ فلتر، وزرّ الرجوع يجب أن يرجع للتبويب السابق لا
     خارج اكتشف. الفلاتر الدقيقة في `go` باقية `replace` — قصد D-023
     (عشرات اللمسات لا تتكدّس في التاريخ) محفوظ. */
  /**
   * تبديل التبويب **يحمل الفلتر معه** (طلب أحمد 9 Aug: «إذا حدّدته وأنا
   * في الأفلام ورحت مسلسلات يمشي معي نفس الفلتر، مو لازم أفعّله ثاني مرة»).
   *
   * كان الرابط يُبنى من الصفر فتسقط كل المعاملات — والمستخدم الذي اختار
   * «دراما · التسعينات · نتفليكس» يفقد اختياره الثلاثيّ بضغطةٍ على
   * «مسلسلات»، وهو أكثر ما يفعله: يقارن جهتين بنفس الفلتر.
   *
   * ما يُحمل: النوع الدرامي واللغة والبلد والمنصّة والحقبة والتقييم
   * والجائزة. وما **لا** يُحمل: نوافذ الصفوف (`wm/ws/wa`) — نافذة صفّ
   * الأفلام لا معنى لها في تبويب المسلسلات، ولها رقائقها هناك.
   *
   * **والنوع الدرامي يُترجَم لا يُنسخ**: معرّفات أنواع TMDB تختلف بين
   * الأفلام والمسلسلات (Action 28 مقابل Action & Adventure 10759)،
   * لكنّنا نحمل **الاسم اللطيف** (`?g=drama`) لا الرقم — و`parseBrowse`
   * يحوّله لجهته. فالحمل سليمٌ عبر الجهتين بلا خريطةٍ ثانية.
   */
  function goTab(next: DiscoverTab) {
    if (next === tab) return;
    tap(8);
    /* تبويب القوائم لا يقبل فلاتر الأعمال — ورقة فلاتره أخرى تماماً،
       وفلترُ أعمالٍ في رابط قوائم حالةٌ ميتة تعود يوم يعود التبويب.
       وتصنيفٌ لا مقابل له في الجهة الجديدة («رعب» في المسلسلات) يسقط
       بصمت — نفس حارس `go` بالضبط، وإلا أدّى الحملُ إلى صفحةٍ فارغة */
    const g = BROWSE_GENRES.find((x) => x.slug === genre);
    /* جهةُ التبويب القادم — والأنمي «الكلّ» لأن صفوفه أفلامٌ ومسلسلات معاً */
    const nextType: BrowseType =
      next === "shows" ? "tv" : next === "anime" ? "all" : "movie";
    /* **والأنمي صار يحمل السبعة كلَّها — نقضُ D-180** (مواصفةُ أحمد
       ١٢ أغسطس: التبويبات الثلاثة تحمل اللغة والجنسية والجائزة).
       **وحجّةُ D-180 كانت «الأنمي يابانيٌّ بحدّه» — وهي ناقصة:** الرسومُ
       الصينية (donghua) والكورية صنفٌ له جمهوره، **ومحورُ اللغة هو البابُ
       الوحيد إليه** بعد أن صار الحارسُ يكتم ما لم يُطلب (D-194).

       **وما يسقط عند التبديل هو ما لا يقبله التبويبُ القادم وحده:**
       الحالةُ محورُ المسلسلات، والموسمُ والاستوديو محورا الأنمي.
       **ومحورٌ يبقى في الرابط بلا واجهةٍ تُظهره حالةٌ ميتة** تُصفّي
       الصفحة ولا يعرف صاحبُها لماذا — وهي أسوأ من فقدان الاختيار. */
    const carry =
      next === "lists"
        ? {}
        : {
            g: g && genreFitsType(g, nextType) ? g.slug : null,
            lang,
            co: country,
            p: provider,
            era,
            rate,
            tag,
            award,
            st: next === "shows" ? status : null,
            se: next === "anime" ? season : null,
            std: next === "anime" ? studio : null,
          };
    start(() => router.push(browseHref({ tab: next, ...carry }), { scroll: false }));
  }

  /* ثلاثة تبويبات (طلب أحمد 9 Aug): أفلام · مسلسلات · القوائم —
     الجهة صعدت من ورقة الفلاتر إلى الرأس فخفّت كل صفحةٍ للنصف */
  const tabs: { key: DiscoverTab; label: string }[] = [
    { key: "shows", label: t.discoverTabShows },
    { key: "movies", label: t.discoverTabMovies },
    /* الأنمي تبويبٌ رابع لا صفّان يتيمان (D-169، طلب أحمد): كان صفّاه
       يعيشان داخل تبويب المسلسلات، **وأفلامه بلا صفٍّ أصلاً**. */
    { key: "anime", label: t.discoverTabAnime },
    { key: "lists", label: t.discoverTabLists },
  ];

  /* الترتيب والإخفاء من الكوكي — والتبويب المفتوح لا يُخفى من نفسه */
  const shownTabs = applyTabPrefs(tabs, tabPrefs, tab);
  const tabLabels = Object.fromEntries(tabs.map((x) => [x.key, x.label]));

  /* ما اختير، مكتوباً: كل رقاقةٍ تحمل اسم الخيار لا اسم المحور — «تركي»
     أوضح من «اللغة: تركي» في مساحةٍ ضيّقة، والمحور يُفهم من القيمة */
  const chips: { key: string; label: string; clear: () => void }[] = [];
  /* رقاقة الجهة سقطت: الجهة صارت التبويب المضيء نفسه — رقاقةٌ تكرّره
     كانت ستقول الشيء مرتين */
  const genreObj = BROWSE_GENRES.find((g) => g.slug === genre);
  if (genreObj) {
    chips.push({
      key: "genre",
      label: browseGenreName(genreObj, loc),
      clear: () => go({ g: null }),
    });
  }
  const langObj = BROWSE_LANGS.find((l) => l.code === lang);
  if (langObj) {
    chips.push({
      key: "lang",
      label: browseLangName(langObj, loc),
      clear: () => go({ lang: null }),
    });
  }
  const countryObj = BROWSE_COUNTRIES.find((c) => c.code === country);
  if (countryObj) {
    chips.push({
      key: "country",
      label: browseCountryName(countryObj, loc),
      clear: () => go({ co: null }),
    });
  }
  const providerObj = providers.find((x) => x.id === provider);
  if (providerObj) {
    chips.push({
      key: "provider",
      label: providerObj.name,
      clear: () => go({ p: null }),
    });
  }
  const eraObj = BROWSE_ERAS.find((e) => e.slug === era);
  if (eraObj) {
    chips.push({
      key: "era",
      label: browseEraName(eraObj, loc),
      clear: () => go({ era: null }),
    });
  }
  const tagObj = BROWSE_TAGS.find((x) => x.slug === tag);
  if (tagObj) {
    chips.push({
      key: "tag",
      label: browseTagName(tagObj, loc),
      clear: () => go({ tag: null }),
    });
  }
  const awardObj = AWARDS.find((a) => a.slug === award);
  if (awardObj) {
    chips.push({
      key: "award",
      label: awardName(awardObj, loc),
      clear: () => go({ award: null }),
    });
  }
  /* رقائقُ الثلاثة الجديدة (D-196): **ما يُختار يُرى ويُزال** — زرٌّ
     يخفي فلتراً بلا أثرٍ ظاهر يكذب (شكل D-030). */
  const statusObj = BROWSE_STATUSES.find((x) => x.slug === status);
  if (statusObj) {
    chips.push({
      key: "status",
      label: browseStatusName(statusObj, loc),
      clear: () => go({ st: null }),
    });
  }
  const seasonObj = BROWSE_SEASONS.find((x) => x.slug === season);
  if (seasonObj) {
    chips.push({
      key: "season",
      label: browseSeasonName(seasonObj, loc),
      clear: () => go({ se: null }),
    });
  }
  const studioObj = BROWSE_STUDIOS.find((x) => x.slug === studio);
  if (studioObj) {
    chips.push({
      key: "studio",
      label: browseStudioName(studioObj, loc),
      clear: () => go({ std: null }),
    });
  }
  if (rate) {
    chips.push({
      key: "rate",
      label: `★ ${t.browseRateFrom(num(rate, locale))}`,
      clear: () => go({ rate: null }),
    });
  }

  const draft: FilterDraft = {
    genre,
    lang,
    country,
    provider,
    era,
    rate,
    tag,
    award,
    status: status ?? null,
    season: season ?? null,
    studio: studio ?? null,
  };

  /* أيّ محاورَ تفتحها الورقة (D-180): كلُّها في الأعمال، وأربعةٌ في
     الأنمي، ولا شيءَ في القوائم — ولها ورقتها هي أصلاً */
  const axes: "full" | "anime" | "none" =
    tab === "movies" || tab === "shows" ? "full" : tab === "anime" ? "anime" : "none";

  return (
    /* **شذرةٌ لا حاوية** (بلاغ أحمد ٩ Aug: «عمود التبويبات ظاهر مثل
       قبل»): كانت هنا `<div className="transition-opacity …">` تلفّ
       الرأس اللاصق، وهي بارتفاعه — و`sticky` يتحرّك داخل حدود أبيه، فلم
       تكن له مسافةٌ يقطعها فمرّ مع الصفحة. الشفافية تُمرَّر الآن إلى
       الجذر اللاصق نفسه، وأبوه صار عمود الصفحة الطويل.

       رأسٌ لاصق (طلب أحمد 9 Aug): التبويبات وزرّ الفلاتر ورقائق ما
       اخترتَه تبقى تحت الترويسة مهما نزلتَ في الصفوف.
       الرأس اللاصق من `PageTabs` المشترك (D-134): نفس موضع تبويبات
       المجتمع والمكتبة بالبكسل، وخطٌّ فاصلٌ واحد. زرّ الفلاتر يُمرَّر
       `action` فيجلس في صفّ التبويبات، ورقائق ما اخترتَه `extra`. */
    <>
      <PageTabs
        className={`transition-opacity ${pending ? "opacity-60" : "opacity-100"}`}
        active={tab}
        ariaLabel={t.discoverTabsGroup}
        items={shownTabs.map((x) => ({ key: x.key, label: x.label, onClick: () => goTab(x.key) }))}
        action={
          <>
        {/* **رمزٌ بلا كلمة (D-177)** — نفس الزرّ في المكتبة والمجتمع، نفس
            المقاس ونفس الموضع. وخانةُ القوائم تبقى لورقتها هي.
            **وفي الأنمي يفتح فلتراً حقيقياً الآن** (طلب أحمد ١١ أغسطس):
            كان يفتح تفضيلات التبويبات وحدها لأن صفوفه لم تكن تقرأ
            الفلتر — وقد صارت تقرؤه. */}
        {tab === "lists" && listsFilters ? (
          /* **وقسمُ التبويبات يُمرَّر إلى ورقة القوائم لا إلى ورقتنا:**
             زرُّ هذا التبويب يفتح تلك لا هذه، فلو بقي القسمُ هنا وحده
             لكان تبويبٌ من أربعة بلا طريقٍ إلى ترتيب تبويباته — والمنطق
             نفسُه (`TabsPrefs`) في الورقتين، فلا نسخةَ ثانية (D-145) */
          <ListsFilters
            {...listsFilters}
            variant="button"
            tabsPrefs={{
              locale,
              prefs: tabPrefs,
              labels: tabLabels,
              title: t.tabsPrefsGroup,
            }}
          />
        ) : (
          <FilterIconButton
            onClick={() => setSheet(true)}
            label={t.discoverToolsTitle}
            active={chips.length > 0}
            expanded={sheet}
          />
        )}
          </>
        }
        extra={
          tab !== "lists" && chips.length > 0 ? (
            <div
              role="group"
              aria-label={t.browseActiveFilters}
              className="-mx-4 px-4 flex flex-wrap items-center gap-2"
            >
              {chips.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={c.clear}
                  aria-label={t.browseRemoveFilter(c.label)}
                  /* الرقاقة هنا زرُّ إلغاءٍ لا زرُّ اختيار، ولذلك لم تأخذ
                     `chipClass`: الممتلئة بلون الهوية تعني «مختار، المسني
                     لتُلغيه» — وهذه معناها الإلغاء وحده. حدٌّ خفيف و× ظاهرة */
                  className="flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 text-accent px-3 py-1.5 text-[13px] font-semibold hover:bg-accent/20 active:scale-[0.97] transition"
                >
                  <span>{c.label}</span>
                  <Icon name="close" size={13} strokeWidth={2.4} />
                </button>
              ))}
              {/* رقاقةُ «تعديل الفلتر» حُذفت مع عودة الزرّ (D-177): بابان
                  إلى ورقةٍ واحدة في شاشةٍ واحدة زيادةٌ لا خيار. */}
              {chips.length > 1 && (
                /* نفس هندسة الرقاقة لا نصٌّ عارٍ: الصفّ قد يلتفّ فيقع «مسح
                   الكل» وحده في سطر — ونصٌّ وحده في سطرٍ يُقرأ عنواناً لا
                   زرّاً. الحدُّ والحشو يبقيانه فعلاً، ولونه الرمادي يبقيه
                   دون الرقائق في الصوت */
                <button
                  type="button"
                  onClick={() =>
                    go({
                      g: null,
                      lang: null,
                      co: null,
                      p: null,
                      era: null,
                      rate: null,
                      tag: null,
                      award: null,
                      st: null,
                      se: null,
                      std: null,
                    })
                  }
                  className="rounded-full border border-border text-muted hover:text-foreground hover:border-accent/50 px-3 py-1.5 text-[13px] font-semibold transition"
                >
                  {t.browseClearAll}
                </button>
              )}
            </div>
          ) : undefined
        }
      />

      {/* الورقة خارج الرأس اللاصق: نافذةٌ تطفو فوق الصفحة كلّها،
          ووضعُها داخل حاويةٍ لاصقة يحبسها في سياق تكديسها */}
      {sheet && (
        <DiscoverFilterSheet
          locale={locale}
          type={type}
          initial={draft}
          providers={providers}
          region={region}
          axes={axes}
          tabPrefs={tabPrefs}
          myRows={myRows}
          tabLabels={tabLabels}
          onClose={() => setSheet(false)}
          onApply={(next) => {
            setSheet(false);
            go({
              g: next.genre,
              lang: next.lang,
              co: next.country,
              p: next.provider,
              era: next.era,
              rate: next.rate,
              tag: next.tag,
              award: next.award,
              st: next.status,
              se: next.season,
              std: next.studio,
            });
          }}
        />
      )}
    </>
  );
}
