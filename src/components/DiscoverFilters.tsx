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
  type BrowseWin,
} from "@/lib/browse";
import { tap } from "@/lib/haptics";
import { Icon } from "./Icon";
import { DiscoverFilterSheet, type FilterDraft } from "./DiscoverFilterSheet";
import { segmentedItem } from "./ui/controls";

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
 *  1. **التصنيف** تبويباتٌ بخطٍّ سفليّ: المحور الذي يُلمس في كل زيارة
 *     تقريباً، فيبقى ظاهراً بلا ضغطة. وأخذ شكل المقسّم الذي كان يحمل
 *     «الكل/أفلام/مسلسلات» — قرارُ المالك، وهو أخفّ من القرص الممتلئ.
 *  2. **زرّ الفلاتر** بعدّاده: جهةُ المحتوى واللغة والحقبة والتقييم كلّها
 *     خلفه. أربعة محاورَ مفروشةً كانت تأكل الشاشة الأولى قبل أن يظهر عمل.
 *  3. **رقائق ما اختير**: الفلتر المخفيّ خلف ورقةٍ يُنسى — فما اختير يبقى
 *     مكتوباً تحت التبويبات ويُلغى بلمسةٍ على ×، بلا فتح الورقة ثانيةً.
 *
 * وسقط من هنا شيئان: صفُّ الترتيب (لكل صفٍّ ترتيبه بحكم معناه بعد أن صار
 * الفلتر يُبقي الصفوف ولا يستبدلها بشبكة)، ومدخلُ البحث (صار له تبويبه في
 * الشريط السفلي، ومدخلان لفعلٍ واحد في شاشةٍ واحدة زيادة). قرارُ المالك.
 */
export function DiscoverFilters({
  locale,
  type,
  win,
  genre,
  lang,
  country,
  provider,
  providers,
  region,
  era,
  rate,
  count,
}: {
  locale: Locale;
  type: BrowseType;
  /** نافذة الترتيب — المحور الأعلى الظاهر (حلّ محلّ صفّ الأنواع) */
  win: BrowseWin;
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
  /** عدد فلاتر الورقة المفعّلة — للعدّاد على الزرّ */
  count: number;
}) {
  const t = getDict(locale);
  const loc = locale === "en" ? "en" : "ar";
  const router = useRouter();
  const [pending, start] = useTransition();
  const [sheet, setSheet] = useState(false);

  function go(next: {
    type?: BrowseType;
    win?: BrowseWin;
    g?: string | null;
    lang?: string | null;
    co?: string | null;
    p?: number | null;
    era?: string | null;
    rate?: BrowseRate | null;
  }) {
    const nextType = next.type ?? type;
    let nextGenre = next.g === undefined ? genre : next.g;

    // تغيير الجهة قد يُسقط التصنيف المختار: «رعب» لا وجود له في المسلسلات،
    // فبدل نتيجةٍ فارغة يعود الاختيار إلى «كل الأنواع»
    const found = BROWSE_GENRES.find((g) => g.slug === nextGenre);
    if (!found || !genreFitsType(found, nextType)) nextGenre = null;

    const nextWin = next.win ?? win;

    const p = new URLSearchParams();
    if (nextType !== "all") p.set("type", nextType);
    if (nextWin !== "week") p.set("win", nextWin);
    if (nextGenre) p.set("g", nextGenre);
    const nextLang = next.lang === undefined ? lang : next.lang;
    // البلد تابعٌ للعربية: مغادرتها تُسقطه، وإلا بقي مطبَّقاً بلا رقاقة تدلّ عليه
    const nextCountry = nextLang === "ar" ? (next.co === undefined ? country : next.co) : null;
    const nextEra = next.era === undefined ? era : next.era;
    const nextRate = next.rate === undefined ? rate : next.rate;
    if (nextLang) p.set("lang", nextLang);
    if (nextCountry) p.set("co", nextCountry);
    const nextProvider = next.p === undefined ? provider : next.p;
    if (nextProvider) p.set("p", String(nextProvider));
    if (nextEra) p.set("era", nextEra);
    if (nextRate) p.set("rate", String(nextRate));

    const qs = p.toString();
    tap(8);
    start(() => router.replace(qs ? `/news?${qs}` : "/news", { scroll: false }));
  }

  const windows: { value: BrowseWin; label: string }[] = [
    { value: "week", label: t.winWeek },
    { value: "year", label: t.winYear },
    { value: "all", label: t.winAll },
  ];

  /* ما اختير، مكتوباً: كل رقاقةٍ تحمل اسم الخيار لا اسم المحور — «تركي»
     أوضح من «اللغة: تركي» في مساحةٍ ضيّقة، والمحور يُفهم من القيمة */
  const chips: { key: string; label: string; clear: () => void }[] = [];
  if (type !== "all") {
    chips.push({
      key: "type",
      label: type === "movie" ? t.browseMovies : t.browseSeries,
      clear: () => go({ type: "all" }),
    });
  }
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
  if (rate) {
    chips.push({
      key: "rate",
      label: `★ ${t.browseRateFrom(num(rate, locale))}`,
      clear: () => go({ rate: null }),
    });
  }

  const draft: FilterDraft = { type, genre, lang, country, provider, era, rate };

  return (
    <div className={`space-y-3 transition-opacity ${pending ? "opacity-60" : "opacity-100"}`}>
      {/* ===== التصنيف + زرّ الفلاتر =====
          الخطّ الفاصل على الصفّ كلّه لا على شريط التبويبات وحده: لو حمله
          الشريط لانقطع عند آخر تبويبٍ وترك الزرّ معلّقاً فوق فراغ. والهوامش
          السالبة تمدّ الخطّ إلى حافّتَي الشاشة فيُقرأ حدّاً لرأس الصفحة. */}
      <div className="-mx-4 px-4 flex items-stretch gap-2 border-b border-[color:var(--divider)]">
        {/* ===== نافذة الترتيب =====
            حلّت محلّ صفّ الأنواع (طلب المالك): ثلاثة أقسامٍ متساوية العرض
            (segmentedTrackFull + flex-1، D-016) — أسبوعي/سنوي/كل الأوقات.
            ضغطُها يُعيد ضبط كل الرفوف: «أفضل هذا الأسبوع» تصير «هذه السنة»
            أو «كل الأوقات». والأنواع انتقلت إلى داخل ورقة الفلاتر. */}
        <div
          role="group"
          aria-label={t.winGroup}
          /* بلا خطٍّ سفليّ: الصفّ نفسه يحمله (segmentedTrackBare منطقُه)،
             فيمتدّ تحت النافذة وزرّ الفلاتر معاً؛ وخطُّ القسم النشِط
             (after:-bottom-px) يلتقي خطَّ الصفّ فلا يطفو */
          className="min-w-0 flex-1 flex items-stretch"
        >
          {windows.map((w) => {
            const on = win === w.value;
            return (
              <button
                key={w.value}
                type="button"
                aria-pressed={on}
                onClick={() => go({ win: w.value })}
                className={segmentedItem(on, "flex-1 basis-0 min-w-0 justify-center flex")}
              >
                {w.label}
              </button>
            );
          })}
        </div>

        {/* الزرّ إلى جانب النافذة: المخرج الوحيد إلى بقيّة الفلاتر (والأنواع) */}
        <button
          type="button"
          onClick={() => {
            tap(8);
            setSheet(true);
          }}
          aria-haspopup="dialog"
          aria-expanded={sheet}
          className={`shrink-0 self-center mb-1 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition ${
            count > 0
              ? "border-accent text-accent bg-accent/10"
              : "border-border text-muted hover:text-foreground"
          }`}
        >
          <Icon name="sliders" size={16} strokeWidth={1.9} />
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
      </div>

      {/* ===== ما اختير ===== */}
      {chips.length > 0 && (
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
              go({ type: "all", g: null, lang: null, co: null, p: null, era: null, rate: null })
            }
              className="rounded-full border border-border text-muted hover:text-foreground hover:border-accent/50 px-3 py-1.5 text-[13px] font-semibold transition"
            >
              {t.browseClearAll}
            </button>
          )}
        </div>
      )}

      {sheet && (
        <DiscoverFilterSheet
          locale={locale}
          initial={draft}
          providers={providers}
          region={region}
          onClose={() => setSheet(false)}
          onApply={(next) => {
            setSheet(false);
            go({
              type: next.type,
              g: next.genre,
              lang: next.lang,
              co: next.country,
              p: next.provider,
              era: next.era,
              rate: next.rate,
            });
          }}
        />
      )}
    </div>
  );
}
