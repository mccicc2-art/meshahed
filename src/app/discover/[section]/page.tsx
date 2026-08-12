import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getUser } from "@/lib/data";
import { getT, getWatchRegion } from "@/lib/locale";
import { eraRange, parseBrowse, seasonRange, browseHref } from "@/lib/browse";
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
const LIMIT = 60;

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

  const win = sp.w === "month" || sp.w === "year" ? sp.w : "week";
  const y = new Date().getUTCFullYear();
  const todayStr = new Date().toISOString().slice(0, 10);
  const back30 = new Date();
  back30.setUTCDate(back30.getUTCDate() - 30);
  const winRange =
    win === "week"
      ? null
      : win === "month"
        ? { from: back30.toISOString().slice(0, 10), to: todayStr }
        : { from: `${y}-01-01`, to: todayStr };

  const rows = await buildSection(
    section,
    { media, base, genreIds, active: browse.active, win, winRange },
    LIMIT,
  );

  /* العنوانُ من نفس مفاتيح القاموس التي يستعملها الصفّ — **لا نصَّ ثانياً
     لقسمٍ واحد** (وإلا صار للقسم اسمان يفترقان عند أوّل تعديل). */
  const title = String(
    (t as unknown as Record<string, string>)[SECTION_TITLE_KEY[section][media]] ?? "",
  );
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
            />
          ))}
        </PosterGrid>
      )}
    </main>
  );
}
