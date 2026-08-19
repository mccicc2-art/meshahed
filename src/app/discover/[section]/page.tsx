import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/data";
import { getLibState } from "@/lib/libState";
import { getT, getWatchRegion } from "@/lib/locale";
import {
  eraRange,
  parseBrowse,
  parseRailWin,
  seasonRange,
  browseHref,
  browseGenreName,
  browseTagName,
  BROWSE_TAGS,
} from "@/lib/browse";
import { keywordId, companyId, titleOf, yearOf, ANIME_KEYWORD, type DiscoverFilter } from "@/lib/tmdb";
import { localizeRows } from "@/lib/localize";
import {
  buildSection,
  isSectionKey,
  isSectionMedia,
  SECTION_TITLE_KEY,
  type SectionMedia,
} from "@/lib/sections";
import { PosterGrid } from "@/components/PosterGrid";
import { PosterCard } from "@/components/PosterCard";
import { BackButton } from "@/components/BackButton";
import type { Dict } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/**
 * **الصفحةُ الكاملة لقسمٍ من «اكتشف»** (D-198، مواصفةُ أحمد: «Every section
 * title should be clickable → open the full list page containing all items
 * in that category»).
 *
 * **ولا استعلامَ فيها إطلاقاً — ولا سطرَ واحداً منه.** كلُّ ما تفعله هذه
 * الصفحة أنها تقرأ الفلتر من الرابط ثم تنادي `buildSection` بحدٍّ أكبر.
 * **والسببُ مكتوبٌ في رأس `sections.ts`:** «أفضل ٥٠» عاش في ثلاثة مواضع
 * فتبدّل مصدرُه أربع مرّات — **وصفحةٌ كاملةٌ لكل قسمٍ تعني مصدراً ثانياً
 * لكل قسم** لو بَنَت لنفسها.
 *
 * **والفلترُ يصل معها** (`?m=` وبقيةُ محاور الرابط كما هي): من ضغط عنواناً
 * وهو يصفّي يتوقّع التصفيةَ في الصفحة — **وصفحةٌ تُلغي فلترَه بلا أن تقول
 * تُقرأ عطلاً**.
 *
 * ⚠️ **وحدُّها يُقال:** ستّون عملاً لا «كلُّ ما في TMDB». الترقيمُ يحتاج
 * حالةً في الرابط ومسارَ جلبٍ ثانياً، **وستّون هي أربعُ شاشاتٍ تمريراً** —
 * فهي «القائمة الكاملة» بمعنى «كلُّ ما يستحقّ العرض في هذا القسم»، وحين
 * يُطلب أكثر يُبنى الترقيم بندًا مستقلاً لا اليوم.
 */
/**
 * ⚖️ **🆕 والحدُّ صار قابلاً للتمديد** (D-378، طلبُ أحمد: «ضروري فيه زرّ
 * المزيد… اضغط المزيد إلى أن ترضى، ما يوقفني»).
 *
 * **وما كان مكتوباً هنا يبقى صحيحاً في نصفه**: «الترقيمُ يحتاج حالةً في
 * الرابط ومسارَ جلبٍ ثانياً» — **والحالةُ في الرابط هي كلُّ ما احتاجه
 * فعلاً** (`?p=`)، **ولا مسارَ جلبٍ ثانياً**: نفسُ `buildSection` بحدٍّ
 * أكبر، **فالصفحةُ الثانية هي الأولى وقد طالت** — لا قائمةٌ ثانيةٌ
 * تُلصَق بها فتكرّر أو تُسقط.
 * **والزرُّ رابطٌ لا حالةُ عميل**: الصفحةُ خادمٌ بحتٌ بلا جافاسكربت،
 * **ومن شارك الرابط شارك ما وصل إليه** (D-063/D-095).
 * **والسقفُ يُقال**: خمسُ ضغطاتٍ (٣٠٠ عملاً) — **وما فوقها يقف الزرُّ
 * ولا يَعِد بما لا يأتي** (D-181).
 */
const LIMIT = 60;
const MAX_PAGES = 5;

export default async function SectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();
  const { section } = await params;
  const sp = await searchParams;
  if (!isSectionKey(section)) notFound();

  /* الجهةُ من `?m=` لا من التبويب: الصفحةُ خارج «اكتشف» فلا تبويبَ لها،
     **والغائبُ يُقرأ أفلاماً** كافتراض التبويبات نفسه (D-179). */
  const media: SectionMedia = isSectionMedia(sp.m) ? sp.m : "movie";
  const browse = parseBrowse({ ...sp, type: media === "anime" ? "all" : media });
  const region = await getWatchRegion();

  const eraR = eraRange(browse.era);
  const anime = media === "anime";
  const tagId = browse.tag ? await keywordId(browse.tag.q) : null;
  const studioId = anime && browse.studio ? await companyId(browse.studio.name) : null;
  const seasonR =
    anime && browse.season
      ? seasonRange(browse.season, eraR.to ? Number(eraR.to.slice(0, 4)) : new Date().getUTCFullYear())
      : null;

  /* **بناءُ الفلتر هنا كما يُبنى في `‎/news` — بنفس الحقول بنفس الترتيب.**
     ولو اختلف حرفٌ لاختلفت الصفحةُ عن الصفّ الذي أتى منه القارئ. */
  const base: DiscoverFilter = {
    lang: browse.lang?.code ?? null,
    country: browse.country?.code ?? null,
    provider: browse.provider,
    watchRegion: region,
    from: seasonR?.from ?? eraR.from,
    to: seasonR?.to ?? eraR.to,
    minRate: browse.rate,
    keywords: anime
      ? [ANIME_KEYWORD, ...(tagId ? [tagId] : [])]
      : tagId
        ? [tagId]
        : undefined,
    status: browse.status?.code ?? null,
    companies: studioId ? [studioId] : undefined,
  };

  const genreIds = browse.genre
    ? media === "tv"
      ? browse.genre.tv
      : media === "movie"
        ? browse.genre.movie
        : undefined
    : undefined;

  /* **صفحةُ التمديد من الرابط** — والمجهولُ يسقط إلى الأولى (D-179).
     🔴 **واسمُها `pg` لا `p`** — **قِيس على الموقع الحيّ**: أوّلُ نسخةٍ
     سمّتها `p`، **و`p` في نحو روابطنا هي المنصّة** (`parseBrowse`)،
     **فصار «المزيد» يعني «مزوّد رقم ٢» وأعادت الصفحةُ صفراً.**
     **ومحورٌ جديدٌ يُسمّى بعد قراءة نحو الرابط لا قبله** (D-224: حقلٌ
     قائمٌ لا يُعاد استعماله لمعنًى ثانٍ وإن تشابه الاسم). */
  const page = Math.min(MAX_PAGES, Math.max(1, Number(sp.pg) || 1));
  const want = LIMIT * page;

  /* 🆕 **والنافذةُ تُقرأ بـ`parseRailWin` لا بشرطٍ مكتوبٍ هنا** (D-445):
     كان الشرطُ نسخةً ثالثةً من قائمة النوافذ (`browse.ts` و`sections.ts`
     والصفحة) — **وثلاثُ نسخٍ لقائمةٍ واحدة تفترق عند إضافة نافذة**، وقد
     افترقت فعلاً: «كل الأوقات» تصل من الرفّ فتهبط هنا على الأسبوع. */
  const win = parseRailWin(sp.w);
  const todayStr = new Date().toISOString().slice(0, 10);
  const back30 = new Date();
  back30.setUTCDate(back30.getUTCDate() - 30);
  /* **و«كل الأوقات» بلا مدى** — نفسُ حسابِ الرفّ حرفياً (D-198) */
  const winRange =
    win === "month" ? { from: back30.toISOString().slice(0, 10), to: todayStr } : null;

  /* 🆕 حالةُ المكتبة تنطلق **قبل** رحلة TMDB لا بعدها: الاثنتان مستقلّتان
     تماماً، وانتظارُهما بالتسلسل كان يضيف موجةَ قاعدةٍ كاملةً إلى أوّل
     بايتٍ في أبرد مسارٍ شائع (الصفحةُ force-dynamic). تُنتظر تحت عند
     الحاجة إليها. */
  const libPromise = getLibState();

  const rows = await buildSection(
    section,
    /* **بلا `sample`** — الصفحةُ جردٌ مرتَّب، والقرعةُ للصفّ وحده (D-202):
       قرعةٌ في صفحةٍ تُمرَّر تكرّر وتُسقط. و`locale` لمصدر الكلاسيكيّات. */
    { media, base, genreIds, active: browse.active, win, winRange, locale },
    want,
  );

  /* العنوانُ من نفس مفاتيح القاموس التي يستعملها الصفّ — **لا نصَّ ثانياً
     لقسمٍ واحد** (وإلا صار للقسم اسمان يفترقان عند أوّل تعديل). */
  /* 🆕 **وعنوانُ صفِّك من اختيارك** (D-378): النوعُ ومعه الوسمُ إن كان —
     **بنفس التركيب الذي يبني به الصفُّ عنوانَه** (لا اسمان لصفٍّ واحد). */
  const lang = locale === "en" ? ("en" as const) : ("ar" as const);
  const tagDef = browse.tag ? BROWSE_TAGS.find((x) => x.slug === browse.tag?.slug) : null;
  const title =
    section === "my-row" && browse.genre
      ? browseGenreName(browse.genre, lang) +
        (tagDef ? ` · ${browseTagName(tagDef, lang)}` : "")
      : (() => {
          const base = String(
            (t as unknown as Record<string, string>)[SECTION_TITLE_KEY[section][media]] ?? "",
          );
          /* 🆕 **ونافذةُ «أفضل ١٠» تدخل العنوان** (D-445): الرفُّ يقول
             «على الإطلاق» **فالصفحةُ التي يفتحها يجب أن تقول مثلَه** —
             **وجملةٌ واحدةٌ تركّبها `top10Win` للاثنين**، فلا اسمان
             لقسمٍ واحد (D-198). وسائرُ الأقسام بلا نافذةٍ فبلا لاحقة. */
          return section === "top-ten" ? (t as Dict).top10Win(base, win) : base;
        })();
  const dict = t as Dict;
  /* رابطُ الرجوع يحمل الفلتر نفسَه إلى تبويبه — لا إلى «اكتشف» عارياً */
  const backHref = browseHref({
    tab: media === "tv" ? "shows" : media === "anime" ? "anime" : "movies",
    g: browse.genre?.slug ?? null,
    lang: browse.lang?.code ?? null,
    co: browse.country?.code ?? null,
    p: browse.provider,
    era: browse.era?.slug ?? null,
    rate: browse.rate,
    tag: browse.tag?.slug ?? null,
    award: browse.award,
    st: browse.status?.slug ?? null,
    se: browse.season?.slug ?? null,
    std: browse.studio?.slug ?? null,
  });

  /* **الترجمةُ بنفس محرّك D-048 وبنفس الشكل الذي يستعمله `topChartRail`**
     — صفوفُ TMDB تُحوَّل إلى مفاتيحَ (`tmdb_id`) لأن `localizeRows` تقرأ
     الصفوف المخزَّنة لا نتائج البحث. **ولا محرّكَ ترجمةٍ ثانياً هنا.** */
  const localized = await localizeRows(
    rows.map((r) => ({
      tmdb_id: r.id,
      media_type: (r.media_type === "tv" ? "tv" : "movie") as "tv" | "movie",
      title: titleOf(r) || null,
      poster_path: r.poster_path,
    })),
    locale,
    rows.length,
  );
  /**
   * **ما يتابعه القارئ — قراءةٌ واحدة للشبكة كلّها** (D-207).
   *
   * صفحةُ القسم تعرض ستّين بطاقةً وأكثر، **وكلُّ بطاقةٍ تحمل زرَّ «+»**
   * فتحتاج أن تعرف هل العملُ مُضافٌ أصلاً. ولو سألت كلُّ واحدةٍ عن نفسها
   * لصارت الصفحةُ ستّين استعلاماً — فالقراءةُ هنا مرّةً، والمجموعةُ تُقرأ
   * بالمفتاح `media_type-id`.
   *
   * **وسقوطُها لا يُسقط الزرّ**: مجموعةٌ فارغة تعني «لم يُضَف بعد»،
   * وأوّلُ لمسٍ يُصلح الحقيقة (`upsert` لا `insert`) — نفس عقد D-205.
   */
  /* 🆕 **والمصدرُ صار `getLibState`** (D-322): الشبكةُ تعرض ما تعرضه
     الرفوف، **فخيطُها يجب أن يقول ما يقوله خيطُها** — ومجموعةُ المتابعات
     وحدَها تعرف السماويَّ ولا تعرف الأخضرَ ولا الأصفرَ ولا الأحمر. */
  const lib = await libPromise;

  const cards = rows.map((r, i) => {
    const l = localized[i];
    const tv = r.media_type === "tv";
    return {
      key: `${r.media_type}-${r.id}`,
      href: `/${tv ? "show" : "movie"}/${r.id}`,
      title: l?.title ?? titleOf(r),
      poster: l?.poster_path ?? r.poster_path,
      year: yearOf(r),
      tv,
      id: r.id,
    };
  });

  return (
    <main className="px-4 sm:px-6 py-5 max-w-6xl mx-auto pb-24">
      <div className="flex items-center gap-3 mb-5">
        {/* زرُّ الرجوع المشترك — ورابطُ التبويب تحته لمن وصل من رابطٍ محفوظ
            ولا تاريخَ عنده يرجع إليه */}
        <BackButton locale={locale} />
        <div className="min-w-0">
          <h1 className="font-bold text-[20px] leading-tight truncate">{title}</h1>
          <Link href={backHref} className="text-[12px] text-muted hover:text-accent transition">
            {dict.navNews}
          </Link>
        </div>
        <span className="ms-auto shrink-0 text-[12px] text-muted tabular-nums">{rows.length}</span>
      </div>

      {rows.length === 0 ? (
        <p className="text-center text-muted py-20">
          {browse.active ? dict.browseEmpty : dict.newsEmpty}
        </p>
      ) : (
        <PosterGrid>
          {cards.map((r) => (
            <PosterCard
              key={r.key}
              href={r.href}
              title={r.title}
              posterPath={r.poster}
              year={r.year}
              fallbackIcon={r.tv ? "tv" : "film"}
              /* ⚖️ **زرُّ «+» غادر هنا أيضاً** (D-322): **الشبكةُ والرفُّ
                 بابان لقائمةٍ واحدة، وأداةٌ في أحدهما دون الآخر تُعلّم
                 القارئَ أن الطريقين مختلفان** — وهي بعينها حجّةُ D-207
                 مقلوبةً. **والفعلُ باقٍ في قائمة الضغط المطوَّل.**
                 والضغطُ المطوَّل قاعدةٌ لا سطحٌ واحد (D-229، طلبُ أحمد:
                 «قاعدة طبّقها على أيّ بوستر في LOOPZ»). */
              hold={{
                tmdbId: r.id,
                mediaType: r.tv ? "tv" : "movie",
                ...lib.of(r.id, r.tv ? "tv" : "movie"),
                locale,
              }}
            />
          ))}
        </PosterGrid>
      )}

      {/* 🆕 **«المزيد» — رابطٌ لا زرّ** (D-378): يظهر ما دام المصدرُ يملأ
          ما طُلب منه، **ويغيب حين ينقص فيقول الغيابُ «هذا كلُّ ما هناك»**
          — **وزرٌّ يَعِد بصفحةٍ فارغةٍ أسوأُ من غيابه** (D-181/D-217).
          **والمفتاحُ `showMore` القائم** — لا مفتاحَ جديداً لفعلٍ قديم. */}
      {/* 🔴 **والشرطُ نموُّ الصفحة لا امتلاؤها** — **قِيس على الموقع**:
          طلبنا ستّين فعادت **٥٧** (الحارسُ يُسقط الأنميَ والمكتومَ من كلِّ
          بِركة)، **فشرطُ «امتلأت تماماً» يُخفي الزرَّ وفي المصدر مئات.**
          **والنموُّ هو الدليلُ الصادق**: صفحةٌ أضافت نصفَ حدٍّ فما فوق
          تعني أن خلفها المزيد، **وصفحةٌ لم تُضف تقول انتهى** — فلا يَعِد
          الزرُّ بما لا يأتي (D-181). */}
      {page < MAX_PAGES && rows.length - LIMIT * (page - 1) >= LIMIT / 2 && (
        <div className="mt-8 text-center">
          <Link
            href={`?${new URLSearchParams({ ...sp, pg: String(page + 1) } as Record<string, string>).toString()}`}
            scroll={false}
            prefetch={false}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-5 py-2.5 text-[14px] font-semibold text-foreground hover:border-[color:var(--divider)] active:scale-95 transition"
          >
            {dict.showMore}
          </Link>
        </div>
      )}
    </main>
  );
}
