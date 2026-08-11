"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getDict, num, type Locale } from "@/lib/i18n";
import {
  BROWSE_COUNTRIES,
  BROWSE_ERAS,
  BROWSE_GENRES,
  BROWSE_LANGS,
  browseCountryName,
  browseEraName,
  browseGenreName,
  browseHref,
  browseLangName,
  genreFitsType,
  type BrowseRate,
  type BrowseType,
  type DiscoverTab,
} from "@/lib/browse";
import { AWARDS, awardName } from "@/lib/awards";
import { tap } from "@/lib/haptics";
import { Icon } from "./Icon";
import { ListsFilters, type ListsFiltersProps } from "./ListsFilters";
import { DiscoverFilterSheet, type FilterDraft } from "./DiscoverFilterSheet";
import { PageTabs } from "./ui/PageTabs";

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
 * **وزرّ «فلاتر» غادر هذا الرأس (D-174).** بابُ الفلتر صار في صفحة البحث
 * (`DiscoverFilterEntry`) والنتيجةُ تنزل هنا — طلبُ أحمد ١٢ أغسطس. فما بقي
 * هنا **عرضُ الحالة وتعديلُها**، لا فتحُها من الصفر.
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
  award,
  listsFilters,
}: {
  locale: Locale;
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
  /** slug الجائزة المختارة — يحوّل الصفوف إلى فائزيها */
  award: string | null;
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
    award?: string | null;
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
      award: next.award === undefined ? award : next.award,
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
    const carry =
      next === "lists"
        ? {}
        : {
            g: g && genreFitsType(g, next === "shows" ? "tv" : "movie") ? g.slug : null,
            lang,
            co: country,
            p: provider,
            era,
            rate,
            award,
          };
    start(() => router.push(browseHref({ tab: next, ...carry }), { scroll: false }));
  }

  /* ثلاثة تبويبات (طلب أحمد 9 Aug): أفلام · مسلسلات · القوائم —
     الجهة صعدت من ورقة الفلاتر إلى الرأس فخفّت كل صفحةٍ للنصف */
  const tabs: { value: DiscoverTab; label: string }[] = [
    { value: "movies", label: t.discoverTabMovies },
    { value: "shows", label: t.discoverTabShows },
    /* الأنمي تبويبٌ رابع لا صفّان يتيمان (D-169، طلب أحمد): كان صفّاه
       يعيشان داخل تبويب المسلسلات، **وأفلامه بلا صفٍّ أصلاً**. */
    { value: "anime", label: t.discoverTabAnime },
    { value: "lists", label: t.discoverTabLists },
  ];

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
  const awardObj = AWARDS.find((a) => a.slug === award);
  if (awardObj) {
    chips.push({
      key: "award",
      label: awardName(awardObj, loc),
      clear: () => go({ award: null }),
    });
  }
  if (rate) {
    chips.push({
      key: "rate",
      label: `★ ${t.browseRateFrom(num(rate, locale))}`,
      clear: () => go({ rate: null }),
    });
  }

  const draft: FilterDraft = { genre, lang, country, provider, era, rate, award };

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
        items={tabs.map((x) => ({ key: x.value, label: x.label, onClick: () => goTab(x.value) }))}
        action={
          <>
        {/* **زرّ «فلاتر» غادر هذا الرأس (D-174، طلب أحمد: «ضيف الفلتر في
            البحث و احذفه من الديسكفري»).** بابُ الفلتر صار في صفحة البحث،
            والنتيجةُ تنزل هنا. والسببُ الذي يجعله قراراً لا نقلاً: «اكتشف»
            صفحةُ تصفّحٍ بلا نيّة، و«ابحث» صفحةُ نيّةٍ صريحة — والفلترُ
            فعلُ نيّة. وخانةُ القوائم تبقى كما هي: ورقتُها أخرى تماماً
            وتُصفّي ما تعرضه صفحتُها نفسها.
            ولا زرَّ في تبويب الأنمي أصلاً (D-169): صفوفه ستّة معانٍ ثابتة. */}
        {tab === "lists" && listsFilters ? (
          <ListsFilters {...listsFilters} variant="button" />
        ) : null}
          </>
        }
        extra={
          tab !== "lists" && tab !== "anime" && chips.length > 0 ? (
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
              {/* **بابُ التعديل حيث تُعرض الحالة (D-174).** الزرّ رحل إلى
                  البحث، ولو رحل معه كلُّ مدخلٍ لصار الفلترُ المفعَّل
                  **مرئيّاً غيرَ قابلٍ للتعديل**: تُلغي رقاقةً برقاقة أو
                  تعبر إلى تبويب البحث لتبدأ من الصفر. فالرقاقةُ الأولى هنا
                  تفتح نفسَ الورقة بنفس الحالة.
                  ولا تظهر إلا حين يكون هناك ما يُعدَّل — بابٌ دائمٌ هنا
                  يُعيد الزرَّ الذي طُلب حذفه بثوبٍ آخر. */}
              <button
                type="button"
                onClick={() => {
                  tap(8);
                  setSheet(true);
                }}
                aria-haspopup="dialog"
                aria-expanded={sheet}
                className="flex items-center gap-1.5 rounded-full border border-border text-muted hover:text-foreground hover:border-accent/50 px-3 py-1.5 text-[13px] font-semibold transition"
              >
                <Icon name="sliders" size={13} strokeWidth={2} />
                <span>{t.browseEditFilters}</span>
              </button>
              {chips.length > 1 && (
                /* نفس هندسة الرقاقة لا نصٌّ عارٍ: الصفّ قد يلتفّ فيقع «مسح
                   الكل» وحده في سطر — ونصٌّ وحده في سطرٍ يُقرأ عنواناً لا
                   زرّاً. الحدُّ والحشو يبقيانه فعلاً، ولونه الرمادي يبقيه
                   دون الرقائق في الصوت */
                <button
                  type="button"
                  onClick={() =>
                  go({ g: null, lang: null, co: null, p: null, era: null, rate: null, award: null })
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
              award: next.award,
            });
          }}
        />
      )}
    </>
  );
}
