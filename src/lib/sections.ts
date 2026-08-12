import type { SearchResult } from "./tmdb";
import {
  airingTv,
  nowPlayingMovies,
  popularByMedia,
  topByFilter,
  topTenThisWeek,
  topTenGenreThisWeek,
  topTenAnimeThisWeek,
  topTenAnimeMoviesThisWeek,
  upcomingByFilter,
  upcomingByGenre,
  upcomingMovies,
  worksByPeople,
  type DiscoverFilter,
} from "./tmdb";
import { getFollowedArtists } from "./data";
import { railGuard } from "./topChart";

/**
 * **سجلُّ أقسام «اكتشف» — مصدرٌ واحد للصفّ وللصفحة الكاملة** (D-198،
 * مواصفةُ أحمد: «Every section title should be clickable → open the full
 * list page containing all items in that category»).
 *
 * ================= لماذا سجلٌّ ولم يكفِ نسخُ الاستعلام =================
 *
 * **لأن هذا بالضبط هو العطلُ الذي كلّفنا ثلاثةَ قرارات.** «أفضل ٥٠» كان
 * يُبنى في مكانين بطريقتين (D-135)، ثم في مكانٍ ثالث لم يُنتبه له (D-164)،
 * ثم تبدّل مصدرُه مرّتين (D-183 · D-189) — **وكلُّ ذلك لأن سؤالاً واحداً
 * كان له أكثرُ من جوابٍ في الشيفرة**. وصفحةٌ كاملةٌ لكل قسمٍ تعني **مصدراً
 * ثانياً لكل قسم**: أربعةَ عشرَ موضعاً تنحرف.
 *
 * فالقسمُ هنا **شيءٌ واحد**: مفتاحُه واسمُه وأيقونتُه **ودالّةُ بنائه**.
 * الصفُّ يناديها بحدٍّ صغير، والصفحةُ تناديها بحدٍّ كبير — **ونفسُ
 * الصفوف بنفس الترتيب** لأنها نفسُ الدالّة.
 *
 * ⚠️ **وما لا يسكن هنا يُقال:** «أفضل ٥٠» و«أفضل ٢٥٠» لهما محرّكُهما في
 * `topChart.ts` (بِركةُ IMDb وحارسُها الثلاثيّ)، **وهما قائمتان كاملتان
 * أصلاً لا صفٌّ يُختصر** — فلا صفحةَ «كاملة» لهما تختلف عمّا يُعرض.
 * و«مقترح لك» بِركةٌ مشتقّةٌ من مكتبة القارئ لا استعلام، **فصفحتُه
 * الكاملة هي `‎/news` نفسه** (D-197: يُصفّى محلياً ويُخفى إن فرغ).
 *
 * ✅ **والبابُ أُغلق (D-199): الأقسامُ الستّة كلُّها تبني من هنا** —
 * `most-popular` · `top-ten` · `upcoming` · `in-cinemas` · `airing-now` ·
 * `from-artists`. **ولم يبقَ في `news/page.tsx` استعلامُ قسمٍ واحد.**
 *
 * **وما بقي هناك بقي لأنه ليس بناءَ القسم:** مدى النافذة (تاريخٌ يخصّ
 * الرقائق) واسمُ منطقة السينما (سطرٌ تحت العنوان، D-150). **السجلُّ يملك
 * «ما يُعرض»، والصفحةُ تملك «كيف يُقال».**
 *
 * 🔑 **ولماذا هذا قرارُ تجربةٍ لا ترتيبُ شيفرة** (وهو ما طلبه أحمد):
 * الرقائقُ تعِد بأن ضغطَ العنوان يفتح **نفسَ النافذة موسَّعةً**. فلو بقي
 * الفرعُ مكتوباً في ملفّين لرأى العميلُ شهراً في الصفحة وأسبوعاً في الصفّ
 * — **وهو لا يعرف أنه رأى شيئين**، فيقرأ الاختلافَ عطلاً في التطبيق لا
 * اختلافَ نطاق. **المصدرُ الواحد ليس نظافةً بل وعدٌ لا يُخلف.**
 */
export type SectionKey =
  | "most-popular"
  | "top-ten"
  | "upcoming"
  | "in-cinemas"
  | "airing-now"
  | "from-artists";

/** جهةُ المحتوى التي يبنيها القسم — الأنمي جهتان معاً */
export type SectionMedia = "movie" | "tv" | "anime";

export interface SectionCtx {
  media: SectionMedia;
  /** الفلترُ مبنيّاً — يُحسب مرّةً في الصفحة ويُمرَّر (لا يُعاد بناؤه هنا) */
  base: DiscoverFilter;
  /** معرّفاتُ النوع الدرامي لهذه الجهة — تُضاف إلى `base` عند الطلب */
  genreIds?: number[];
  /** هل الفلترُ مفعَّل؟ بعضُ المصادر لا تقبل محاورَه فتتبدّل */
  active: boolean;
  /** نافذةُ صفّ «أفضل ١٠» — أسبوع/شهر/سنة (D-099) */
  win?: "week" | "month" | "year";
  /** مدى النافذة محسوباً — يُمرَّر كي لا يُحسب التاريخ مرّتين */
  winRange?: { from: string; to: string } | null;
}

/** مفتاحُ الترجمة لعنوان القسم — الاسمُ يبقى في `i18n.ts` لا يُنسخ هنا */
export const SECTION_TITLE_KEY: Record<
  SectionKey,
  { movie: string; tv: string; anime: string }
> = {
  "most-popular": {
    movie: "mostPopularMovies",
    tv: "mostPopularSeries",
    anime: "mostPopularAnime",
  },
  "top-ten": { movie: "top10Movies", tv: "top10Series", anime: "top10Anime" },
  upcoming: { movie: "comingSoon", tv: "comingSoon", anime: "upcomingAnime" },
  "in-cinemas": { movie: "inCinemas", tv: "inCinemas", anime: "animeInCinemas" },
  "airing-now": { movie: "airingNowAnime", tv: "airingNowAnime", anime: "airingNowAnime" },
  "from-artists": { movie: "artistsRail", tv: "artistsRail", anime: "artistsRail" },
};

/**
 * وجهةُ عنوانِ القسم — **والفلترُ يُحمل معه** (مواصفةُ أحمد: الفلترُ عامٌّ
 * داخل التبويب، فمن ضغط عنواناً وهو يصفّي يتوقّع أن تصل التصفيةُ معه).
 *
 * والرابطُ يُبنى من `search` الحاليّ حرفياً بدل إعادة تركيبه محورًا محورًا:
 * **محورٌ جديد غداً يصل من نفسه**، ولو عُدّدت المحاور هنا لصار الرابطُ
 * يُنسى تحديثُه — وهو ما وقع في D-174 مع بانيَي الرابط.
 */
export function sectionHref(key: SectionKey, media: SectionMedia, search?: string): string {
  const p = new URLSearchParams(search ?? "");
  p.delete("tab");
  p.set("m", media);
  const qs = p.toString();
  return `/discover/${key}${qs ? `?${qs}` : ""}`;
}

export function isSectionKey(v: string): v is SectionKey {
  return (
    v === "most-popular" ||
    v === "top-ten" ||
    v === "upcoming" ||
    v === "in-cinemas" ||
    v === "airing-now" ||
    v === "from-artists"
  );
}

export function isSectionMedia(v: string | undefined): v is SectionMedia {
  return v === "movie" || v === "tv" || v === "anime";
}

/** الجهةُ التي تُسأل عنها TMDB — والأنمي يُسأل عن الجهتين ثم يُدمج */
const sides = (m: SectionMedia): ("movie" | "tv")[] =>
  m === "anime" ? ["tv", "movie"] : [m];

/**
 * **بناءُ قسمٍ — الدالّةُ الواحدة التي يناديها الصفُّ والصفحة.**
 *
 * `limit` هو كلُّ الفرق بينهما: الصفُّ يطلب عشرين والصفحةُ ستّين.
 * **ولا فرقَ ثانٍ** — لا ترتيبٌ آخر ولا مصدرٌ آخر ولا حارسٌ آخر، وإلا صار
 * ما تراه في الصفحة غيرَ ما وعد به الصفّ الذي أتيت منه.
 *
 * **والحارسُ (D-194) داخلَ الدالّة لا عند مستدعيها:** لو تُرك للمستدعي
 * لعادت اللغاتُ المكتومة من باب الصفحة الجديدة — وهو حرفياً درسُ D-175
 * (حارسٌ في أحد الفروع يحرس فرعَه وحده).
 */
export async function buildSection(
  key: SectionKey,
  ctx: SectionCtx,
  limit = 20,
): Promise<SearchResult[]> {
  const { media, base, genreIds, active } = ctx;
  const anime = media === "anime" ? ("only" as const) : ("drop" as const);
  /* «خلّها تظهر إذا شخص حدّد جنسيتهم فقط» (D-194) — والكتمُ يسقط بلغةٍ أو بلد */
  const unmute = !!base.lang || !!base.country;
  const guard = (rows: SearchResult[]) =>
    railGuard(rows, { anime, unmute }).slice(0, limit);

  try {
    switch (key) {
      case "most-popular": {
        /* بلا فلتر: قائمةُ TMDB الجاهزة (`/popular`) — ترتيبُ شعبيةٍ
           تراكميّ لا نملك مثله. ومع الفلتر: `/discover` بنفس الترتيب،
           فالمحاورُ تُقبل. **وتبويبُ الأنمي `/discover` دائماً** لأن
           `/popular` لا يقبل مفتاحاً (فتصفيتُه بالأنمي تُفرغه). */
        const rows = await Promise.all(
          sides(media).map((mt) =>
            active || media === "anime"
              ? topByFilter(mt, { ...base, genreIds }, limit * 2, "popularity.desc")
              /* صفحاتٌ بقدر الحدّ: الصفُّ صفحةٌ واحدة، والصفحةُ الكاملة
                 ثلاث — **قِيس على الإنتاج: بلا هذا عادت الستّون سبعةَ
                 عشر**. */
              : popularByMedia(mt, Math.ceil((limit * 1.5) / 20)),
          ),
        );
        return guard(
          rows
            .flat()
            .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0)),
        );
      }

      case "top-ten": {
        /* نوافذُ D-099 كما هي: الأسبوعُ من الرائج (أو `/discover` المُصفّى)،
           والشهرُ والسنةُ من `/discover` بمدىً محسوبٍ في المستدعي. */
        const w = ctx.win ?? "week";
        const rows = await Promise.all(
          sides(media).map((mt) => {
            if (media === "anime" && !active) {
              const r = ctx.winRange ?? undefined;
              return mt === "movie"
                ? topTenAnimeMoviesThisWeek(limit, r)
                : topTenAnimeThisWeek(limit, r);
            }
            if (active || w !== "week" || media === "anime") {
              return topByFilter(
                mt,
                { ...base, genreIds, ...(ctx.winRange ?? {}) },
                limit,
                w === "week" ? "vote_average.desc" : "popularity.desc",
              );
            }
            return genreIds?.length
              ? topTenGenreThisWeek(mt, genreIds, limit)
              : topTenThisWeek(mt, limit);
          }),
        );
        return guard(rows.flat());
      }

      case "upcoming": {
        const rows = await Promise.all(
          sides(media).map((mt) =>
            active || media === "anime"
              ? upcomingByFilter(mt, { ...base, genreIds })
              : genreIds?.length
                ? upcomingByGenre(genreIds, mt)
                : mt === "movie"
                  ? upcomingMovies()
                  : airingTv(),
          ),
        );
        const today = new Date().toISOString().slice(0, 10);
        return guard(
          rows
            .flat()
            .filter((r) => (r.release_date || r.first_air_date || "") >= today)
            .sort((a, b) =>
              (a.release_date || a.first_air_date || "").localeCompare(
                b.release_date || b.first_air_date || "",
              ),
            ),
        );
      }

      case "in-cinemas": {
        /* `‎/now_playing` **لا يقبل نوعاً ولا لغةً** — يقبل المنطقة وحدها،
           فيغيب وقتَ الفلتر بدل أن يعرض ما لم يُطلب (D-075). */
        if (active) return [];
        const c = await nowPlayingMovies();
        return c ? guard(c.results) : [];
      }

      case "airing-now": {
        /* **موسمُ الأنمي الحاليّ لا `‎/tv/on_the_air`** — وقد جُرّبت تلك
           وأعادت صفراً على الإنتاج (قائمةٌ عالميّة لا تقبل مفتاحاً). */
        const now = new Date();
        const q = `${now.getUTCFullYear()}-${String(
          Math.floor(now.getUTCMonth() / 3) * 3 + 1,
        ).padStart(2, "0")}-01`;
        const rows = await topByFilter(
          "tv",
          { ...base, genreIds, from: base.from ?? q, to: base.to ?? now.toISOString().slice(0, 10) },
          limit * 2,
          "popularity.desc",
        );
        return guard(rows);
      }

      case "from-artists": {
        /* أعمالُ من تتابعه — **أفلامٌ فقط، قيدُ مصدرٍ لا اختيار**:
           TMDB لا يقبل `with_people` على `/discover/tv` (D-062). */
        const artists = await getFollowedArtists(20);
        if (!artists.length) return [];
        const rows = await worksByPeople(
          artists.map((a) => a.person_id),
          limit,
        );
        /* ⚠️ **ولا كتمَ لغةٍ في هذا القسم وحده** — وهو **استثناءٌ مقصود
           لا سهو** (D-194): الصفُّ أعمالُ فنّانين **اختارهم العميلُ
           بنفسه**، وكتمُ لغةٍ اختارها هو **تجاهلٌ لذوقه لا تحرير**. ومن
           تابع مخرجاً كوريّاً يريد أفلامه — لا صفّاً فارغاً يسأل نفسه
           لماذا. **والأنمي يُسقط كما هو** (له تبويبُه). */
        return railGuard(rows, { anime, unmute: true }).slice(0, limit);
      }
    }
  } catch {
    /* قسمٌ تعذّر بناؤه يعود فارغاً فيُخفى — لا شاشةَ خطأ لصفٍّ واحد */
    return [];
  }
}
