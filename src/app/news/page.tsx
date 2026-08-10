import { Suspense } from "react";
import { redirect } from "next/navigation";
import {
  getUser,
  getFollowedArtists,
  getPublicListsFeed,
  getFollowedPublicLists,
} from "@/lib/data";
import { PublicListsRail } from "@/components/PublicListsRail";
import { ListPeekTrigger } from "@/components/ListPeek";
import { ListsFilters } from "@/components/ListsFilters";
import { AddWorksToList } from "@/components/AddWorksToList";
import { PosterRail, RailItem } from "@/components/PosterRail";
import { FRANCHISES, franchiseName, universeName, type Universe } from "@/lib/universes";
import { awardBySlug, awardBody, awardWins } from "@/lib/awards";
import { Icon } from "@/components/Icon";
import Image from "next/image";
import {
  upcomingMovies,
  airingTv,
  topTenThisWeek,
  topTenAnimeThisWeek,
  topTenGenreThisWeek,
  upcomingByGenre,
  topByFilter,
  top50,
  top50Anime,
  topRatedRows,
  awardWinners,
  worksByPeople,
  upcomingByFilter,
  nowPlayingMovies,
  listWatchProviders,
  moviesByIds,
  resolveSetIds,
  titleOf,
  yearOf,
  posterUrl,
  type SearchResult,
  type DiscoverFilter,
} from "@/lib/tmdb";
import { ScrollMemory } from "@/components/ScrollMemory";
import { attachImdbRatings, onlyRated, withImdbRatings } from "@/lib/omdb";
import { getT, getWatchRegion } from "@/lib/locale";
import { regionName } from "@/lib/region";
import { type Locale } from "@/lib/i18n";
import {
  parseBrowse,
  parseDiscoverTab,
  parseRailWin,
  browseKey,
  browseCount,
  needsDiscover,
  eraRange,
  type BrowseQuery,
  type RailWin,
} from "@/lib/browse";
import { RankedRail } from "@/components/RankedRail";
import { OneTimeHint } from "@/components/OneTimeHint";
import { RailWindowChips } from "@/components/RailWindowChips";
import { CountdownRail, type CountdownItem } from "@/components/CountdownRail";
import { PickedForYou } from "@/components/PickedForYou";
import { RailSkeleton } from "@/components/Skeletons";
import { DiscoverFilters } from "@/components/DiscoverFilters";
import { getSuggestions } from "@/lib/suggest";

type T = Awaited<ReturnType<typeof getT>>["t"];

/** اسم الجائزة بلغة الواجهة — لعنوان صفّ الفائزين */
function universeAwardTitle(a: { ar: string; en: string }, locale: Locale) {
  return locale === "en" ? a.en : a.ar;
}

function dateOf(r: SearchResult) {
  return r.release_date ?? r.first_air_date ?? "";
}

/**
 * اكتشف.
 *
 * شكلٌ واحد لا شكلان: صفوفٌ منسّقة تُقرأ بالتمرير — في السينما، وأفضل
 * عشرة، والقادم بعدّ تنازلي. واختيار جهةٍ أو نوعٍ درامي لا يستبدل الصفوف
 * بشبكة نتائج كما كان، بل يُبقيها ويقصرها على ما اختاره: من يختار
 * «دراما» يريد أفضل الدراما وقادمها، لا جداراً من كل عملٍ درامي مرتّباً
 * بالشعبية. ولذلك سقط صفُّ الترتيب — لكل صفٍّ ترتيبه بحكم معناه.
 *
 * الفلاتر ترسم فوراً، والصفوف خلف Suspense تجلب بياناتها بنفسها — فلا
 * تنتظر الصفحة كلّها أبطأ طلب TMDB.
 */
export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    q?: string;
    src?: string;
    type?: string;
    win?: string;
    wm?: string;
    ws?: string;
    wa?: string;
    g?: string;
    sort?: string;
    lang?: string;
    co?: string;
    p?: string;
    era?: string;
    rate?: string;
    award?: string;
    fr?: string;
    lsrc?: string;
  }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();
  const sp = await searchParams;
  /* ثلاثة تبويبات (طلب أحمد 9 Aug): أفلام · مسلسلات · القوائم — الجهة
     صعدت من ورقة الفلاتر إلى الرأس، فتُفرض هنا على التصفح من التبويب
     (وروابط ?type القديمة يهديها parseDiscoverTab لتبويبها) */
  const tab = parseDiscoverTab(sp.tab, sp.type);
  const browse = parseBrowse({ ...sp, type: tab === "shows" ? "tv" : "movie" });
  /* نوافذ صفوف «أفضل ١٠» — لكل صفٍّ نافذته (D-099): أفلام/مسلسلات/أنمي */
  const rails = { m: parseRailWin(sp.wm), s: parseRailWin(sp.ws), a: parseRailWin(sp.wa) };
  /* قائمة المنصّات تُجلب على الخادم وتُمرَّر للورقة: طلبٌ واحد مخبَّأ ساعةً
     في طبقة fetch، ورأس الصفحة يبقى يرسم فوراً لأن الصفوف وحدها خلف
     Suspense. وفشلُ الجلب يُخفي المحور بدل أن يعرض خانةً فارغة.
     وتبويب «القوائم» لا يطلبها أصلاً — ورقة الفلاتر لا تُفتح فيه */
  const [providers, region] = await Promise.all([
    tab !== "lists"
      ? listWatchProviders(browse.type === "tv" ? "tv" : "movie")
      : Promise.resolve([] as { id: number; name: string }[]),
    getWatchRegion(),
  ]);

  return (
    <div className="space-y-8">
      {/* ذاكرة موضع التمرير — العائد من عملٍ يهبط حيث كان (تدقيق 8 Aug م٢) */}
      <ScrollMemory />
      {/* العنوان مخفيٌّ بصريًّا وباقٍ لقارئ الشاشة — أُزيلت الترويسة */}
      <h1 className="sr-only">{t.newsTitle}</h1>

      <DiscoverFilters
        locale={locale}
        tab={tab}
        type={browse.type}
        genre={browse.genre?.slug ?? null}
        lang={browse.lang?.code ?? null}
        country={browse.country?.code ?? null}
        provider={browse.provider}
        providers={providers}
        region={region}
        era={browse.era?.slug ?? null}
        rate={browse.rate}
        award={browse.award}
        count={browseCount(browse)}
        listsFilters={
          tab === "lists"
            ? listsFiltersProps(
                FRANCHISES.some((f) => f.slug === sp.fr) ? sp.fr! : null,
                ["curated", "friends", "community"].includes(sp.lsrc ?? "")
                  ? (sp.lsrc as "curated" | "friends" | "community")
                  : "all",
                locale === "en" ? "en" : "ar",
                t,
              )
            : undefined
        }
      />

      {/* تلميح لمرة واحدة (م٣): القوة المدفونة خلف زر Filters ورقائق
          النوافذ تُقال مرةً ثم تصمت للأبد */}
      {tab !== "lists" && (
        <OneTimeHint id="discover-power" text={t.hintDiscover} closeLabel={t.closeLabel} />
      )}

      {tab === "lists" ? (
        /* ===== تبويب «القوائم» — صفوفٌ كصفوف الأعمال (D-084) =====
            سقط البحث والرقائق (طلب المالك: «نفس التقسيم والتناسق»):
            التبويب صفوفٌ تُقرأ بالتمرير كتبويب الأعمال تماماً — عالمٌ
            فعالم، ثم من تتابعهم، ثم المجتمع. لا حالة في الرابط فلا مفتاح */
        <Suspense
          key={`${sp.fr ?? ""}|${sp.lsrc ?? ""}`}
          fallback={
            <div className="space-y-8" aria-hidden>
              <RailSkeleton count={6} />
              <RailSkeleton count={6} />
            </div>
          }
        >
          <ListsDiscovery
            locale={locale}
            t={t}
            fr={FRANCHISES.some((f) => f.slug === sp.fr) ? sp.fr! : null}
            lsrc={["curated", "friends", "community"].includes(sp.lsrc ?? "") ? (sp.lsrc as "curated" | "friends" | "community") : "all"}
          />
        </Suspense>
      ) : (
        /* المفتاح يتغيّر بتغيّر الفلتر: React يُظهر الهيكل فوراً بدل أن
            يُبقي صفوف الفلتر السابق معلّقة حتى تصل الجديدة.
            نوافذ الصفوف (wm/ws/wa) ليست في المفتاح عمداً (سؤال أحمد
            «ليش كامل الصفحة تتحدث؟»): رقاقةٌ واحدة يجب ألا تعيد تركيب
            الصفوف كلّها هيكلاً — التبديل transition في مكانه، والرقائق
            تعتم قليلاً ريثما يصل الصف الجديد */
        <Suspense
          key={browseKey(browse)}
          fallback={
            <div className="space-y-8" aria-hidden>
              <RailSkeleton count={6} />
              <RailSkeleton count={6} />
              <RailSkeleton count={6} />
            </div>
          }
        >
          <CuratedRails locale={locale} t={t} browse={browse} rails={rails} region={region} />
        </Suspense>
      )}
    </div>
  );
}

/**
 * ديسكفري القوائم (D-082 ثم D-084): صفوفٌ كصفوف الأعمال، بلا بحثٍ ولا
 * رقائق مصدر — «نفس التقسيم والتناسق» (طلب المالك).
 *
 * كل عالمٍ صفٌّ باسمه: بطاقته الأولى القائمة الكاملة مرتّبةً، وبعدها
 * الفرعيات (سبايدر-مان، آيرون مان…) — ثم صفّا من تتابعهم والمجتمع.
 */

/** خصائص فلاتر القوائم — يبنيها الخادم مرةً للزرّ (في سطر التبويبات) والرقائق */
function listsFiltersProps(
  fr: string | null,
  lsrc: "all" | "curated" | "friends" | "community",
  loc: "ar" | "en",
  t: T,
) {
  return {
    fr,
    lsrc,
    franchises: FRANCHISES.map((f) => ({ slug: f.slug, label: franchiseName(f, loc) })),
    labels: {
      button: t.browseFilters,
      title: t.browseFiltersTitle,
      world: t.listsFilterWorld,
      source: t.listsFilterSource,
      all: t.browseAll,
      curated: t.listsCurated,
      friends: t.listsFriendsRail,
      community: t.publicListsRail,
      apply: t.browseApply,
      close: t.closeLabel,
    },
  };
}

async function ListsDiscovery({
  locale,
  t,
  fr,
  lsrc,
}: {
  locale: Locale;
  t: T;
  /** فلتر العالم من الرابط (?fr=slug) — دفعة أحمد الثالثة */
  fr: string | null;
  /** فلتر المصدر (?lsrc=) */
  lsrc: "all" | "curated" | "friends" | "community";
}) {
  const [friends, communityRaw] = await Promise.all([
    getFollowedPublicLists(15),
    getPublicListsFeed(25).catch(() => []),
  ]);
  /* لا تكرار (طلب أحمد): قائمة صديقٍ لها صفّها — صفُّ المجتمع للبقية */
  const friendIds = new Set(friends.map((l) => l.id));
  const community = communityRaw.filter((l) => !friendIds.has(l.id)).slice(0, 15);

  const loc = locale === "en" ? ("en" as const) : ("ar" as const);
  const rows = fr ? FRANCHISES.filter((f) => f.slug === fr) : FRANCHISES;

  const peekLabels = {
    close: t.closeLabel,
    openList: t.listPeekOpen,
    failed: t.showLoadFailed,
    watchedMark: t.watchedBadge,
  };

  return (
    <div className="space-y-8">
      {/* الزرّ صعد إلى سطر التبويبات (داخل DiscoverFilters) — هنا
          رقائق المختار وحدها، كصفّ رقائق تبويب الأعمال (طلب أحمد) */}
      <ListsFilters variant="chips" {...listsFiltersProps(fr, lsrc, loc, t)} />

      {(lsrc === "all" || lsrc === "curated") &&
        rows.map((f) => (
          <PosterRail
            key={f.slug}
            title={franchiseName(f, loc)}
            icon="sparkle-star"
            /* اسم العالم بابه: ضغطة «مارفل» تعرض عالمه وحده (فلتر fr) */
            href={`/news?tab=lists&fr=${f.slug}`}
          >
            {f.sets.map((u) => (
              /* wide لا الافتراضي: بطاقة القائمة أعرض من بطاقة الملصق،
                 وخانةٌ ضيّقة كانت تجعل البطاقات تتراكب (لقطة المالك) */
              <RailItem key={u.slug} wide>
                {/* ضغطة جسد البطاقة تفتح المعاينة الكاملة؛ زرّ الحفظ يمرّ لصاحبه */}
                <ListPeekTrigger kind="set" refId={u.slug} title={universeName(u, loc)} labels={peekLabels}>
                  <CuratedCard u={u} locale={locale} t={t} className="w-full" />
                </ListPeekTrigger>
              </RailItem>
            ))}
          </PosterRail>
        ))}

      {(lsrc === "all" || lsrc === "friends") && !fr && friends.length > 0 && (
        <PublicListsRail lists={friends} locale={locale} title={t.listsFriendsRail} peekLabels={peekLabels} />
      )}

      {(lsrc === "all" || lsrc === "community") && !fr && community.length > 0 && (
        <PublicListsRail lists={community} locale={locale} peekLabels={peekLabels} />
      )}
    </div>
  );
}

/**
 * بطاقة قائمةٍ منسّقة — هندسة `CommunityListCard` نفسها مع فارقين:
 * لا رابط (القائمة تولد عند الضغط لا قبله — محرّك D-052/D-074)، والسطر
 * الثاني وعدُ الترتيب: «بترتيب الأحداث» للعوالم وحدها (storyOrder).
 * الملصقات الأربعة من `moviesByIds` — أربعة طلباتٍ مخبّأة ساعةً لكل
 * مجموعة، داخل Suspense فلا ترهن الرأس.
 */
async function CuratedCard({
  u,
  locale,
  t,
  className = "w-full",
}: {
  u: Universe;
  locale: Locale;
  t: T;
  className?: string;
}) {
  const loc = locale === "en" ? ("en" as const) : ("ar" as const);
  /* مجموعات TOP 250: العدد ثابتٌ معلوم والملصقات من صفحة top_rated
     الأولى وحدها — جلبُ ٢٥٠ عملاً لبطاقةٍ تعرض أربعة ملصقات إسراف.
     وسائر المجموعات كما كانت: تُحلّ معرّفاتها ثم أربعة ملصقات */
  const award = u.award ? awardBySlug(u.award) : null;
  /* بطاقة الجائزة: العدّ من القاموس بلا شبكة، والملصقات من أحدث أربعة
     فائزين وحدهم — تثبيت الخمسة والثلاثين يقع عند الفتح لا هنا */
  const awardFour = u.award ? await awardWinners(u.award, 4).catch(() => []) : null;
  const topRows = u.top ? await topRatedRows(u.top, 8).catch(() => []) : null;
  const ids = topRows || awardFour ? [] : await resolveSetIds(u).catch(() => [] as number[]);
  const four = awardFour ?? (topRows ? topRows.slice(0, 4) : await moviesByIds(ids.slice(0, 4)).catch(() => []));
  const count = award ? awardWins(award).length : topRows ? (u.topLimit ?? 250) : ids.length;
  const posters = four
    .map((m) => posterUrl(m.poster_path, "w185"))
    .filter(Boolean) as string[];

  return (
    <div className={`rounded-2xl border border-border bg-surface p-2.5 ${className}`}>
      <span className="flex items-center gap-1.5 text-[14px] font-bold truncate">
        <Icon name={award ? "star" : "sparkle-star"} size={14} className="text-accent shrink-0" />
        <span className="truncate">{universeName(u, loc)}</span>
      </span>
      <span className="block text-[12px] text-muted truncate mt-0.5">
        {t.listCount(count)}
        {award ? ` · ${awardBody(award, loc)}` : u.storyOrder ? ` · ${t.listsStoryOrder}` : ""}
      </span>
      <span className="mt-2 flex gap-1.5">
        {posters.length > 0 ? (
          posters.map((url, i) => (
            <span
              key={i}
              className="relative w-[calc(25%-4.5px)] aspect-[2/3] rounded-lg overflow-hidden bg-surface-2 border border-[color:var(--background)]"
            >
              <Image src={url} alt="" fill sizes="64px" className="object-cover" />
            </span>
          ))
        ) : (
          <span className="grid place-items-center w-14 aspect-[2/3] rounded-lg border border-dashed border-border text-muted">
            <Icon name="list" size={16} />
          </span>
        )}
      </span>
      <AddWorksToList
        source="universe"
        id={u.slug}
        locale={locale}
        label={t.curatedSaveBtn}
        className="mt-2.5 w-full justify-center"
      />
    </div>
  );
}

/**
 * صفوف اكتشف — مقصورةً على الفلتر إن وُجد.
 *
 * الطلبات تُبنى على قدر الفلتر: جهة «أفلام» لا تطلب المسلسلات أصلاً،
 * والتصنيف يحوّل كل صفٍّ إلى نظيره المُصفّى. وصفّ الأنمي وصفّ «مقترح لك»
 * يظهران في السكون وحده: الأول تصنيفٌ قائم بذاته لا يُقصّ بتصنيفٍ آخر،
 * والثاني بُني على ذوق المستخدم لا على اختياره اللحظي.
 *
 * ومصدرُ الصفوف يتبدّل بحسب عمق الفلتر — وهذا جوهر التصميم هنا:
 *  - **بلا لغةٍ ولا حقبةٍ ولا تقييم** يبقى المصدر `/trending` الأسبوعي: هو
 *    الأصدق تحريرياً، يعرف ما يشاهده الناس هذا الأسبوع لا ما جمع أعلى
 *    متوسّطٍ منذ ١٩٩٤.
 *  - **مع أيٍّ منها** ننتقل إلى `/discover`: القوائم الجاهزة لا تقبل هذه
 *    المعاملات أصلاً، وتصفيتُها عندنا تُخرج صفّاً من عملين لأن الرائج
 *    عشرون عملاً لا أكثر. نخسر جِدّة الترتيب ونكسب أن يصل من طلب «تركي
 *    ٢٠٢٠ فأعلى» إلى تركيٍّ ٢٠٢٠ فأعلى — وهو ما طلبه.
 */
async function CuratedRails({
  locale,
  t,
  browse,
  rails,
  region,
}: {
  locale: Locale;
  t: T;
  browse: BrowseQuery;
  /** نوافذ صفوف «أفضل ١٠» — أسبوع/شهر/سنة لكل صفٍّ (D-099) */
  rails: { m: RailWin; s: RailWin; a: RailWin };
  /** بلد المشاهدة — يُقاس عليه فلتر المنصّات */
  region: string;
}) {
  const { type, genre, lang, country, provider, era, rate, active } = browse;
  /* ===== فلتر الجائزة (طلب أحمد 9 Aug) =====
     اختيار جائزةٍ سؤالٌ مغلق لا تصفّح: «من فاز بالسعفة؟» — فالصفحة تصير
     صفّاً واحداً بالفائزين، الأحدث أولاً، بلا أرقام (الترتيب زمنيّ لا
     تفضيليّ). وبقية الصفوف تصمت: خلطُ الفائزين برائج الأسبوع يُفقد
     الجواب معناه. */
  if (browse.award) {
    const award = awardBySlug(browse.award);
    const rows = award ? await awardWinners(browse.award).catch(() => []) : [];
    return (
      <div className="space-y-8">
        {rows.length > 0 ? (
          <RankedRail
            title={award ? universeAwardTitle(award, locale) : ""}
            icon="star"
            items={rows}
            ranked={false}
            /* الوصف من البيانات لا من ثابتٍ مكتوب: القائمة تمتدّ فيتبعها */
            note={t.awardRailNote(
              String(rows.length),
              String(Math.min(...rows.map((r) => r.awarded))),
            )}
          />
        ) : (
          <p className="text-center text-muted py-20">{t.browseEmpty}</p>
        )}
      </div>
    );
  }

  const wantMovies = type !== "tv";
  const wantSeries = type !== "movie";
  const deep = needsDiscover(browse);

  /* «القادم» نمطٌ لا مدى: ما لم يصدر لا أصوات له، فصفّا «أفضل ١٠»
     يكذبان أو يفرغان — يسقطان، ويحمل صفُّ العدّ التنازلي وحده النتيجة
     مرتّبةً بتاريخ الصدور وبلا عتبة تقييم (upcomingByFilter يفعل ذلك
     أصلاً). ونافذة الترتيب تفقد معناها في المستقبل فتُتجاهل بصمت. */
  const upcoming = era?.upcoming === true;
  /* مدى الحقبة محسوباً: «القادم» = اليوم حتى بعد ستة أشهر، يتحرّك مع اليوم */
  const eraR = eraRange(era);

  /* الفلتر بلا تصنيف — لكل جهةٍ معرّفاتها فيُضاف عند الطلب */
  const base: DiscoverFilter = {
    lang: lang?.code ?? null,
    country: country?.code ?? null,
    provider,
    watchRegion: region,
    from: eraR.from,
    to: eraR.to,
    minRate: rate,
  };

  /* أعلى ١٠ حسب نافذة الصفّ (D-099): أسبوع = الرائج (أو discover
     المُصفّى)، شهر = آخر ثلاثين يوماً (لا الشهر التقويمي — أوّلُه
     بِركةٌ من أيامٍ معدودة)، سنة = هذه السنة التقويمية — كلاهما
     discover بالشعبية. و«كل الأوقات» القديمة يمثّلها ذيل Top 50. */
  const y = new Date().getUTCFullYear();
  const todayStr = new Date().toISOString().slice(0, 10);
  const back30 = new Date();
  back30.setUTCDate(back30.getUTCDate() - 30);
  const monthFrom = back30.toISOString().slice(0, 10);
  const topFor = (mt: "movie" | "tv", genreIds: number[] | undefined, w: RailWin) => {
    if (w === "year") {
      return topByFilter(
        mt,
        { ...base, from: `${y}-01-01`, to: `${y}-12-31`, genreIds },
        10,
        "popularity.desc",
      ).catch(() => [] as SearchResult[]);
    }
    if (w === "month") {
      return topByFilter(
        mt,
        { ...base, from: monthFrom, to: todayStr, genreIds },
        10,
        "popularity.desc",
      ).catch(() => [] as SearchResult[]);
    }
    // أسبوع
    return deep
      ? topByFilter(mt, { ...base, genreIds }).catch(() => [] as SearchResult[])
      : genreIds
        ? topTenGenreThisWeek(mt, genreIds).catch(() => [] as SearchResult[])
        : topTenThisWeek(mt).catch(() => [] as SearchResult[]);
  };

  const [topMovies, topSeries, topAnime, cinemas, soonMovies, soonSeries, top50Movies, top50Series, top50AnimeRows] =
    await Promise.all([
      /* الصفوف المرتّبة كلّها تُعاد بترتيب IMDb وتحمل تقييمه (قرار أحمد:
         «الترتيب بأعلى تقييم حسب IMDb والتقييم فقط من IMDb») — TMDB يبقى
         مصدر التجميع (من يدخل الصفّ)، وIMDb مصدر الترتيب والرقم */
      wantMovies && !upcoming
        ? topFor("movie", genre?.movie, rails.m).then(withImdbRatings).catch(() => [] as SearchResult[])
        : Promise.resolve([] as SearchResult[]),
      wantSeries && !upcoming
        ? topFor("tv", genre?.tv, rails.s).then(withImdbRatings).catch(() => [] as SearchResult[])
        : Promise.resolve([] as SearchResult[]),
      // الأنمي بنافذته المستقلة (D-099): أسبوع = الرائج، شهر/سنة = ما
      // بدأ بثّه في المدى بالشعبية — بوابة isWeek سقطت مع محور الورقة
      !active && wantSeries
        ? topTenAnimeThisWeek(
            10,
            rails.a === "week"
              ? undefined
              : { from: rails.a === "month" ? monthFrom : `${y}-01-01`, to: todayStr },
          ).then(withImdbRatings).catch(() => [] as SearchResult[])
        : Promise.resolve([] as SearchResult[]),
      /* «في السينما» بتقييم IMDb كسائر الصفوف (طلب أحمد 9 Aug مساءً:
         «أعمال السينما تكون مقيَّمة من IMDb»). كان الصفّ الوحيد الذي
         يعرض ملصقاتٍ بلا رقم — والفيلم الذي تفكّر في حجز تذكرةٍ له هو
         **أحوج** ما يكون إلى تقييم، لا أقلّها. الترتيب يبقى ترتيب دور
         العرض: «ما يُعرض الآن» سؤالُ توقيتٍ لا سؤال جودة. */
      wantMovies
        ? nowPlayingMovies()
            .then(async (c) =>
              c ? { region: c.region, results: await attachImdbRatings(c.results) } : null,
            )
            .catch(() => null)
        : Promise.resolve(null),
      // «القادم» يفتح صفّ العدّ التنازلي في كل النوافذ — هو النتيجة كلّها هناك
      wantMovies
        ? deep
          ? upcomingByFilter("movie", { ...base, genreIds: genre?.movie })
          : genre
            ? upcomingByGenre(genre.movie, "movie")
            : upcomingMovies().catch(() => [] as SearchResult[])
        : Promise.resolve([] as SearchResult[]),
      wantSeries
        ? deep
          ? upcomingByFilter("tv", { ...base, genreIds: genre?.tv })
          : genre
            ? upcomingByGenre(genre.tv, "tv")
            : airingTv().catch(() => [] as SearchResult[])
        : Promise.resolve([] as SearchResult[]),
      /* ذيول «أفضل ٥٠» — **عادت خمسين بعد أن كانت خمساً وعشرين** (طلب
         أحمد 9 Aug مساءً: «لاحظوا نقصاً في القائمة وانتقدوني»). تقصيرُها
         في D-114 كان توفيراً في حصة OMDb، وقد سقط سببه: المخزن بعمرٍ
         متدرّج (D-132) جعل الخمسين أرخص ممّا كانت الخمسٌ وعشرون.

         والبِركة **٨٠ لا ٤٠**: `onlyRated` تُسقط من لا تقييم IMDb له
         إسقاطاً كاملاً — لا إلى الذيل — فالفاقد يحتاج فائضاً يعوّضه،
         وإلا عاد «النقص» الذي انتُقدنا عليه من بابٍ آخر. */
      !active && wantMovies
        ? top50("movie", {}, 80)
            .then(withImdbRatings)
            .then((r) => onlyRated(r).slice(0, 50))
            .catch(() => [] as SearchResult[])
        : Promise.resolve([] as SearchResult[]),
      !active && wantSeries
        ? top50("tv", {}, 80)
            .then(withImdbRatings)
            .then((r) => onlyRated(r).slice(0, 50))
            .catch(() => [] as SearchResult[])
        : Promise.resolve([] as SearchResult[]),
      !active && wantSeries
        ? top50Anime(80)
            .then(withImdbRatings)
            .then((r) => onlyRated(r).slice(0, 50))
            .catch(() => [] as SearchResult[])
        : Promise.resolve([] as SearchResult[]),
    ]);

  const today = new Date().toISOString().slice(0, 10);

  /* «في السينما» لا يقبل من TMDB تصنيفاً ولا لغةً ولا تقييماً — يقبل
     المنطقة وحدها. فيُصفّى هنا على النتائج نفسها: أرخص من طلبٍ ثانٍ،
     والصفّ خمسة عشر عملاً لا أكثر. والحقبة تُطبَّق أيضاً وإن كانت تُفرغه
     غالباً — من اختار التسعينات لا ينتظر أن يجدها في دور العرض اليوم،
     وصفٌّ فارغ أصدق من صفٍّ يتجاهل ما اختاره. */
  const fitsCinema = (r: SearchResult) => {
    if (genre && !(r.genre_ids ?? []).some((id) => genre.movie.includes(id))) return false;
    if (lang && r.original_language !== lang.code) return false;
    if (country && !(r.origin_country ?? []).includes(country.code)) return false;
    if (rate && r.vote_average < rate) return false;
    if (era) {
      const d = dateOf(r);
      // المدى المحسوب لا الخام: «القادم» يُفرغ صفّ دور العرض بحقّ —
      // ما يُعرض اليوم ليس قادماً
      if (d && eraR.from && d < eraR.from) return false;
      if (d && eraR.to && d > eraR.to) return false;
    }
    return true;
  };

  /* «في السينما» يسقط كلّه عند اختيار منصّة: الصفّ عن دور العرض، والسؤال
     «ما المتاح على اشتراكي» نقيضه — وصفٌّ لا يمكن تصفيته بما اختير يكذب
     على الفلتر */
  const inCinemas = provider
    ? null
    : cinemas && active
      ? { region: cinemas.region, results: cinemas.results.filter(fitsCinema) }
      : cinemas;

  // القادم فقط في صفّ العدّ التنازلي — ما صدر أمس ليس «قادماً»
  const soon: CountdownItem[] = [...soonMovies, ...soonSeries]
    .filter((r) => r.media_type === "tv" || r.media_type === "movie")
    .filter((r) => dateOf(r) >= today)
    .sort((a, b) => dateOf(a).localeCompare(dateOf(b)))
    .slice(0, 20)
    .map((r) => ({
      key: `${r.media_type}-${r.id}`,
      href: `/${r.media_type === "tv" ? "show" : "movie"}/${r.id}`,
      title: titleOf(r),
      poster: posterUrl(r.poster_path, "w342"),
      date: dateOf(r),
      badge: r.media_type === "tv" ? t.typeSeries : t.typeMovie,
    }));

  const empty =
    topMovies.length === 0 &&
    topSeries.length === 0 &&
    topAnime.length === 0 &&
    soon.length === 0 &&
    top50Movies.length === 0 &&
    top50Series.length === 0 &&
    top50AnimeRows.length === 0 &&
    !inCinemas?.results.length;

  return (
    <div className="space-y-8">
      {/* ===== الصفّان الشخصيّان — Suspense مستقلّ (م٧/D-071) =====
          المقترحات وحدها ~٤٠ طلب TMDB في أول تحميل، وكانت داخل
          Promise.all الصفوف كلّها فيرهن أبطأُ طلبٍ رسمَ الصفحة بأكملها.
          فصلُهما يجعل «أفضل ١٠» ودور العرض تظهر فور جاهزيتها، ويلحق
          الشخصيّ حين يكتمل — والهيكل يحجز ارتفاعه (D-046) */}
      {!active && (
        <Suspense fallback={<RailSkeleton count={6} />}>
          {/* الجهة تُمرَّر: التبويب وعدٌ، والصفّ الذي لا يعرف تبويبه يخلفه */}
          <PersonalRails locale={locale} t={t} type={type} />
        </Suspense>
      )}

      {/* فواصل الأقسام المسمّاة (م١/D-103) أُزيلت — «ما عجبتني» (قرار
          أحمد 9 Aug): الصفوف تتوالى بلا عناوين قسمية كما كانت */}
      {inCinemas && inCinemas.results.length > 0 && (
        <RankedRail
          title={t.inCinemas}
          icon="film"
          items={inCinemas.results}
          /* اسم البلد من `region.ts` لا من خريطةٍ محلية: صفّ السينما
             صار يبدأ من بلد المستخدم، وخريطةٌ من أربعة بلدان كانت
             ستطبع «MA» لمن اختار المغرب */
          note={t.inCinemasRegion(regionName(inCinemas.region, locale === "en" ? "en" : "ar"))}
          ranked={false}
        />
      )}

      {/* رقائق النافذة (D-099): الصفّ لا يختفي في نافذةٍ فارغة —
          رسالةٌ مكانه وإلا ضاع طريق العودة لنافذةٍ فيها نتائج */}
      {(topMovies.length > 0 || rails.m !== "week") && (
        <RankedRail
          title={t.top10Movies}
          icon="film"
          items={topMovies}
          control={<RailWindowChips param="wm" value={rails.m} locale={locale} />}
          emptyText={t.railWinEmpty}
        />
      )}
      {(topSeries.length > 0 || rails.s !== "week") && (
        <RankedRail
          title={t.top10Series}
          icon="tv"
          items={topSeries}
          control={<RailWindowChips param="ws" value={rails.s} locale={locale} />}
          emptyText={t.railWinEmpty}
        />
      )}
      {(topAnime.length > 0 || rails.a !== "week") && (
        <RankedRail
          title={t.top10Anime}
          icon="sparkle-star"
          items={topAnime}
          control={<RailWindowChips param="wa" value={rails.a} locale={locale} />}
          emptyText={t.railWinEmpty}
        />
      )}
      {soon.length > 0 && (
        <CountdownRail title={t.comingSoon} icon="calendar" items={soon} locale={locale} />
      )}

      {/* ذيل «أعلى ٢٥ على الإطلاق» — مرجعٌ ثابت في الحالة غير المُصفّاة */}
      {top50Movies.length > 0 && (
        <RankedRail title={t.top50Movies} icon="film" items={top50Movies} />
      )}
      {top50Series.length > 0 && (
        <RankedRail title={t.top50Series} icon="tv" items={top50Series} />
      )}
      {top50AnimeRows.length > 0 && (
        <RankedRail title={t.top50Anime} icon="sparkle-star" items={top50AnimeRows} />
      )}

      {empty && (
        <p className="text-center text-muted py-20">
          {active ? t.browseEmpty : t.newsEmpty}
        </p>
      )}
    </div>
  );
}

/**
 * الصفّان الشخصيّان — «مقترح لك» و«من فنّانيك» (م٧/D-071).
 *
 * مكوّن خادمٍ مستقلٌّ خلف Suspense خاصّ: هذان أثقل ما في اكتشف (بِركة
 * الثلاثمئة D-064 + with_people) وأكثره خصوصيةً فأقلّه استفادةً من خبيئة
 * fetch المشتركة — ففُصلا عن المسار الحرج بدل أن يرهنا رسم الصفحة كلّها.
 */
async function PersonalRails({
  locale,
  t,
  type,
}: {
  locale: Locale;
  t: T;
  /** جهة التبويب — أفلام أو مسلسلات (D-141) */
  type: BrowseQuery["type"];
}) {
  const wantMovies = type !== "tv";
  const [pool, artistWorks] = await Promise.all([
    getSuggestions(300, locale).catch(() => []),
    /* «من فنّانيك» أفلامٌ فقط — TMDB لا يدعم `with_people` في
       `/discover/tv`. فصفٌّ من الأفلام تحت تبويب «مسلسلات» هو الخطأ
       نفسه مقلوباً، والصمتُ أصدق من صفٍّ في غير بابه */
    wantMovies
      ? getFollowedArtists(20)
          .then((a) => (a.length ? worksByPeople(a.map((x) => x.person_id), 20) : []))
          .catch(() => [] as SearchResult[])
      : Promise.resolve([] as SearchResult[]),
  ]);

  /* قرعةُ خادمٍ عند كل طلب (D-073): البِركة مخبّأة ساعةً فكانت العشرة
     الأولى تتجمّد معها — فتح «اكتشف» مرتين يعرض الوجوه نفسها. الخلطُ هنا
     يجعل كل فتحٍ عيّنةً مختلفة، وزرّ التحديث يبقى للسحب داخل الزيارة */
  /* التبويب فلترٌ لا زينة (بلاغ أحمد ١٠ أغسطس: «بيكد فور يو فالافلام
     قاعد يقترح مسلسلات»). البِركة ثلاثمئة مختلطة، والصفّ يعرض عشراً —
     فالتصفية هنا لا تُفقره، والعشرُ الباقيات تحت العنوان الذي وعد بها. */
  const suggested = pool.filter((s) =>
    wantMovies ? s.result.media_type === "movie" : s.result.media_type === "tv",
  );
  for (let i = suggested.length - 1; i > 0; i--) {
    // العشوائية مقصودة: قرعةٌ لكل طلبٍ في مكوّن خادمٍ لا-متزامن يُنفَّذ مرةً واحدة
    // eslint-disable-next-line react-hooks/purity -- ليست دالة عرضٍ تُعاد
    const j = Math.floor(Math.random() * (i + 1));
    [suggested[i], suggested[j]] = [suggested[j], suggested[i]];
  }

  if (suggested.length === 0 && artistWorks.length === 0) return null;

  return (
    <div className="space-y-8">
      {suggested.length > 0 && (
        /* السبب يُحسب هنا (يحتاج القاموس) والبطاقات تُسلسَل خفيفةً للعميل */
        <PickedForYou
          title={t.suggestedForYou}
          locale={locale}
          items={suggested.map((s) => ({
            tmdbId: s.result.id,
            mediaType: s.result.media_type === "movie" ? ("movie" as const) : ("tv" as const),
            title: titleOf(s.result),
            posterPath: s.result.poster_path,
            year: yearOf(s.result),
            note:
              s.source === "rated" && s.seedTitle
                ? t.recoBecauseRated(s.seedTitle)
                : s.source === "follows" && s.seedTitle
                  ? t.recoBecauseFollow(s.seedTitle)
                  : s.source === "recent" && s.seedTitle
                    ? t.recoBecauseWatched(s.seedTitle)
                    : t.recoBecauseGenre,
          }))}
        />
      )}

      {/* «من فنّانيك» بعد المقترحات مباشرة: كلاهما صفٌّ شخصيّ، والشخصيّ
          يسبق العامّ. غير مرقّم — هذه أحدث أعمال فنّانيك لا ترتيبها */}
      {artistWorks.length > 0 && (
        <RankedRail title={t.artistsRail} icon="people" items={artistWorks} ranked={false} />
      )}
    </div>
  );
}
