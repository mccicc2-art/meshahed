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
 *  2. **زرّ الفلاتر** بعدّاده: النافذة وجهةُ المحتوى واللغة والحقبة
 *     والتقييم كلّها خلفه. خمسة محاورَ مفروشةً تأكل الشاشة الأولى قبل أن
 *     يظهر عمل.
 *  3. **رقائق ما اختير**: الفلتر المخفيّ خلف ورقةٍ يُنسى — فما اختير يبقى
 *     مكتوباً تحت التبويبات ويُلغى بلمسةٍ على ×، بلا فتح الورقة ثانيةً.
 *
 * وسقط من هنا شيئان: صفُّ الترتيب (لكل صفٍّ ترتيبه بحكم معناه بعد أن صار
 * الفلتر يُبقي الصفوف ولا يستبدلها بشبكة)، ومدخلُ البحث (صار له تبويبه في
 * الشريط السفلي، ومدخلان لفعلٍ واحد في شاشةٍ واحدة زيادة). قرارُ المالك.
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
  count,
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
  /** عدد فلاتر الورقة المفعّلة — للعدّاد على الزرّ */
  count: number;
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

    const p = new URLSearchParams();
    // الجهة يحملها التبويب لا معامل type — تبويب المسلسلات يبقى في رابطه
    if (tab === "shows") p.set("tab", "shows");
    if (nextGenre) p.set("g", nextGenre);
    const nextLang = next.lang === undefined ? lang : next.lang;
    // الجنسية محورٌ مستقلّ (طلب أحمد): لا تسقط بتبدّل اللغة
    const nextCountry = next.co === undefined ? country : next.co;
    const nextEra = next.era === undefined ? era : next.era;
    const nextRate = next.rate === undefined ? rate : next.rate;
    if (nextLang) p.set("lang", nextLang);
    if (nextCountry) p.set("co", nextCountry);
    const nextProvider = next.p === undefined ? provider : next.p;
    if (nextProvider) p.set("p", String(nextProvider));
    if (nextEra) p.set("era", nextEra);
    if (nextRate) p.set("rate", String(nextRate));
    const nextAward = next.award === undefined ? award : next.award;
    if (nextAward) p.set("award", nextAward);

    const qs = p.toString();
    tap(8);
    start(() => router.replace(qs ? `/news?${qs}` : "/news", { scroll: false }));
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
    const p = new URLSearchParams();
    if (next !== "movies") p.set("tab", next);
    /* تبويب القوائم لا يقبل فلاتر الأعمال — ورقة فلاتره أخرى تماماً،
       وفلترُ أعمالٍ في رابط قوائم حالةٌ ميتة تعود يوم يعود التبويب */
    if (next !== "lists") {
      /* تصنيفٌ لا مقابل له في الجهة الجديدة («رعب» في المسلسلات) يسقط
         بصمت — نفس حارس `go` بالضبط، وإلا أدّى الحملُ إلى صفحةٍ فارغة */
      const g = BROWSE_GENRES.find((x) => x.slug === genre);
      const nextType = next === "shows" ? "tv" : "movie";
      if (g && genreFitsType(g, nextType)) p.set("g", g.slug);
      if (lang) p.set("lang", lang);
      if (country) p.set("co", country);
      if (provider) p.set("p", String(provider));
      if (era) p.set("era", era);
      if (rate) p.set("rate", String(rate));
      if (award) p.set("award", award);
    }
    const qs = p.toString();
    start(() => router.push(qs ? `/news?${qs}` : "/news", { scroll: false }));
  }

  /* ثلاثة تبويبات (طلب أحمد 9 Aug): أفلام · مسلسلات · القوائم —
     الجهة صعدت من ورقة الفلاتر إلى الرأس فخفّت كل صفحةٍ للنصف */
  const tabs: { value: DiscoverTab; label: string }[] = [
    { value: "movies", label: t.discoverTabMovies },
    { value: "shows", label: t.discoverTabShows },
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
        {/* الزرّ إلى جانب التبويبات: المخرج الوحيد إلى الفلاتر —
            زرّ الأعمال لتبويبها، وزرّ القوائم (بورقته) في نفس الخانة */}
        {tab === "lists" && listsFilters ? (
          <ListsFilters {...listsFilters} variant="button" />
        ) : tab !== "lists" ? (
          <button
            type="button"
            onClick={() => {
              tap(8);
              setSheet(true);
            }}
            aria-haspopup="dialog"
            aria-expanded={sheet}
            /* أنحف مما كان (طلب أحمد: «الفلتر خل عرضه أصغر شوي») */
            className={`shrink-0 self-center mb-1 flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-semibold transition ${
              count > 0
                ? "border-accent text-accent bg-accent/10"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            <Icon name="sliders" size={14} strokeWidth={1.9} />
            <span>{t.browseFilters}</span>
            {count > 0 && (
              <span
                className="grid place-items-center min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-[color:var(--on-accent)] text-[11px] font-bold tabular-nums"
                dir="ltr"
              >
                {num(count, locale)}
              </span>
            )}
          </button>
        ) : null}
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
