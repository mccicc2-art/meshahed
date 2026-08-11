import { getImdbChart } from "./data";
import { localizeRows } from "./localize";
import type { Locale } from "./i18n";
import type { SearchResult } from "./tmdb";
import { rankByImdb, withImdbRatings } from "./omdb";
import { getMovie, getTv, topRatedRows } from "./tmdb";

/**
 * صفٌّ في قائمة «أفضل ٢٥٠» — بشكل صفّ TMDB عمداً.
 *
 * الشكل ليس اعتباطاً: المستدعيان يمرّرانه إلى `titleOf`/`yearOf`، فلو
 * أعدنا شكلاً خاصاً لاحتاج كلٌّ منهما تحويلاً خاصاً به — وهذا بالضبط
 * موضع الانحراف الذي يوجد هذا الملف لمنعه.
 */
export interface TopRow {
  id: number;
  media_type: string;
  poster_path: string | null;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  /** تقييم IMDb وعدد أصواته — يأتيان مع صفّ القائمة نفسه، بلا نداءِ OMDb.
      الصفّ المرقّم يرسم الشارة منهما (D-164). */
  imdb_rating?: number;
  imdb_votes?: number;
}

/**
 * قائمة «أفضل ٢٥٠» لصنفٍ واحد — **مصدرٌ واحد لمكانين** (D-135).
 *
 * كانت المعاينة (`api/franchise`) والحفظ (`saveUniverseList`) ينسخان
 * نفس الخطوات، وفي رأس كلٍّ منهما تعليقٌ يرجو ألّا ينسى أحدٌ نسخ التغيير
 * إلى الآخر. الرجاء ليس آليةً: قائمةٌ محفوظة تخالف ما عايَنه المستخدم
 * قبل ثانية أسوأ من ترتيبٍ رديء، فالخطوات هنا مرّةً واحدة.
 *
 * **ثلاث طبقات، بهذا الترتيب:**
 *  ١) `imdb_chart` — بِركتها ملفّات IMDb كلّها؛ هذه هي القائمة الصحيحة.
 *  ٢) **ذيلٌ من مسار D-132** إن قصُرت: الأنمي خاصّةً قد لا يبلغ ٢٥٠ عملاً
 *     فوق عتبة الأصوات، وقائمةٌ من ١٨٠ بطاقة نقصٌ يراه المستخدم فوراً
 *     بينما اختلاطُ المصدر في الذيل لا يراه أحد.
 *  ٣) لا شيء من (١): كل القائمة من مسار D-132 — أضعفُ لا مكسور.
 */
export async function topChartRows(
  kind: "movie" | "tv" | "anime",
  want: number,
): Promise<TopRow[]> {
  const chart = await getImdbChart(kind, want).catch(() => []);
  const out: TopRow[] = chart.map((c) => ({
    id: c.tmdb_id,
    media_type: c.media_type,
    poster_path: c.poster_path,
    title: c.title ?? undefined,
    name: c.title ?? undefined,
    imdb_rating: typeof c.rating === "number" ? c.rating : Number(c.rating),
    imdb_votes: typeof c.votes === "number" ? c.votes : Number(c.votes),
  }));
  if (out.length >= want) return out.slice(0, want);

  /* **البِركة أوسع من الناقص بستّين بالمئة**: `rankByImdb` تُسقط كل عملٍ
     بلا تقييم IMDb إسقاطاً كاملاً — لا إلى الذيل — فبِركةٌ بحجم النقص
     تعني ذيلاً ناقصاً بدوره. */
  const pool = await topRatedRows(kind, Math.round(want * 1.6)).catch(() => []);
  const ranked = rankByImdb(await withImdbRatings(pool), { want });

  const seen = new Set(out.map((r) => `${r.media_type}-${r.id}`));
  for (const r of ranked) {
    if (out.length >= want) break;
    const mt = r.media_type === "tv" ? "tv" : "movie";
    const k = `${mt}-${r.id}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({
      id: r.id,
      media_type: mt,
      poster_path: r.poster_path ?? null,
      title: r.title,
      name: r.name,
      release_date: r.release_date,
      first_air_date: r.first_air_date,
      imdb_rating: r.imdb_rating ?? undefined,
      imdb_votes: r.imdb_votes ?? undefined,
    });
  }
  return out;
}

/** رقم نوع «وثائقي» عند TMDB */
const DOCUMENTARY_GENRE = 99;
/** رقم نوع «رسوم متحرّكة» — واحدٌ للأفلام والمسلسلات */
const ANIMATION_GENRE = 16;

/** كم صفّاً نطلبه من القائمة لكل صفٍّ نعرضه — هامشٌ يُعوّض ما يسقط */
const DOC_MARGIN = 1.6;

/**
 * أعمالٌ تُستبعد من رفوف «أفضل ٥٠» بمعرّفها، لا بقاعدة (D-170).
 *
 * **ولماذا قائمةٌ يدوية وهي آخر ما نحبّ:** أحمد أشار إلى صفٍّ بعينه
 * («رقم ٦ هذا تحديداً شيله»)، **ولا حقلَ في TMDB يفصله عمّا يريد إبقاءه**.
 * «بلوي» مسلسلُ رسومٍ للأطفال، و«ريك ومورتي» مسلسلُ رسومٍ للكبار — وقد
 * قال صراحةً إن الثاني يبقى. والنوعُ ١٦ يجمعهما، ونوع «أطفال» (10762)
 * يشمل أعمالاً لم يطلب حذفها. **فالقاعدة هنا تُسقط ما لم يُطلب إسقاطه —
 * والمعرّف الصريح أصدق من قاعدةٍ تتظاهر بأنها تعرف الفرق.**
 *
 * **وشرطُ بقائها نظيفة:** كل سطرٍ يحمل اسمه وسببه ومن طلبه. قائمةٌ بلا
 * أسماء تصير مقبرةً لا أحد يجرؤ على مراجعتها. **ولا تُضاف إليها إلا
 * بطلبٍ صريح من أحمد** — وإلا صارت ذوقَ من كتب الشيفرة.
 */
const RAIL_EXCLUDED: { id: number; media: "tv" | "movie"; why: string }[] = [
  // طلب أحمد ١٢ أغسطس، بلقطة شاشة: «رقم ٦ هذا تحديداً شيله من توب ٥٠»
  { id: 82728, media: "tv", why: "Bluey — رسومٌ للأطفال في رفٍّ للدراما" },
];
const isExcluded = (id: number, media: string) =>
  RAIL_EXCLUDED.some((x) => x.id === id && x.media === (media === "tv" ? "tv" : "movie"));

/**
 * يُسقط الوثائقيات من رفّ «أفضل ٥٠» — **ومنه وحده** (D-165).
 *
 * **بلاغ أحمد:** «الوثائقيات لا يحطها في توب ٥٠». وقد كان محقّاً قبل
 * D-164 بالمصادفة لا بالتصميم: الرفّ كان يُبنى من `vote_count.desc` عند
 * TMDB فلم يكن الوثائقيّ يبلغه أصلاً. ولمّا صار الرفّ يقرأ قائمة IMDb
 * الحقيقية دخلت معها اثنتا عشرة وثائقيّة في المسلسلات — Planet Earth
 * ثالثاً ورابعاً، وBlue Planet وCosmos وOur Planet خلفهما.
 *
 * **ولا تُحذف من «أفضل ٢٥٠»:** أحمد قال إن الـ٢٥٠ صحيحة، وهي كذلك —
 * قائمة IMDb نفسها تضع Planet Earth في صدارة مسلسلاتها. فالمطلب ليس
 * «الوثائقيّ ليس عملاً عظيماً» بل «رفُّ الخمسين واجهةُ دراما لا أرشيف
 * طبيعة». الفرق في **مكان العرض** لا في **جودة العمل**، فالتصفية هنا في
 * الرفّ لا في القائمة ولا في SQL.
 *
 * **والنوع من TMDB لا من IMDb:** `imdb_pool` لا يحمل نوعاً — و`is_anime`
 * وحده يُقرأ من ردّ `/find`. وإضافةُ `is_doc` نظيراً له هي الحلّ الصحيح
 * نهائياً (تصفيةٌ بلا نداءٍ واحد)، لكنها تحتاج ترحيلاً في القاعدة يشغّله
 * أحمد بنفسه وإعادةَ ملءٍ للبِركة. فحتى ذلك: تفاصيل TMDB مخبّأة ساعةً،
 * **و`localizeRows` تطلبها لهذه الصفوف نفسها بعد سطرين** — فما نُنفقه
 * فعلاً هو هامش الثلاثين الزائد لا الثمانون.
 */
async function filterRail(
  rows: TopRow[],
  want: number,
  kind: "movie" | "tv" | "anime",
): Promise<TopRow[]> {
  /* **الأنمي يغادر رفَّي الأفلام والمسلسلات كليهما (D-170، طلب أحمد).**
     رفُّ المسلسلات خلا منه في D-164 مجّاناً لأن SQL يفصل `is_anime`،
     **ورفُّ الأفلام لم يخلُ**: `is_anime` يشترط `media_type='tv'`، فـ«روح
     الربيع» و«اسمك» تسكنان بِركة الأفلام العامّة. ولمّا صار للأنمي تبويبه
     (D-169) صار وجودُه في الرفّين تكراراً لا إثراءً. */
  const dropAnime = kind !== "anime";
  const drop: boolean[] = [];
  /* خمسٌ وعشرون متوازيةً كما في `imdbChart.ts` — نفس الخادم ونفس السبب */
  for (let i = 0; i < rows.length; i += 25) {
    const got = await Promise.all(
      rows.slice(i, i + 25).map(async (r) => {
        if (isExcluded(r.id, r.media_type)) return true;
        try {
          const d =
            r.media_type === "tv"
              ? ((await getTv(r.id)) as {
                  genres?: { id: number }[];
                  original_language?: string;
                })
              : ((await getMovie(r.id)) as {
                  genres?: { id: number }[];
                  original_language?: string;
                });
          const genres = d.genres ?? [];
          if (genres.some((g) => g.id === DOCUMENTARY_GENRE)) return true;
          /* والأنمي بالبيانات لا بالاسم (D-089/D-154): رسومٌ متحرّكة
             بلغةٍ أصلية يابانية — نفس تعريف `is_anime` في القاعدة، فلا
             يتفرّق التصنيف بين موضعين. و«ريك ومورتي» يبقى: ليس يابانياً. */
          if (
            dropAnime &&
            genres.some((g) => g.id === ANIMATION_GENRE) &&
            d.original_language === "ja"
          ) {
            return true;
          }
          return false;
        } catch {
          /* لم نعرف؟ يبقى. الحذفُ بالشكّ يُنقص القائمة عملاً حقيقياً،
             والإبقاءُ بالشكّ يُبقي واحداً — أهونُ الضررين. */
          return false;
        }
      }),
    );
    drop.push(...got);
  }

  const out: TopRow[] = [];
  for (let i = 0; i < rows.length && out.length < want; i++) {
    if (!drop[i]) out.push(rows[i]);
  }
  return out;
}

/**
 * نفس القائمة، بشكل صفٍّ جاهزٍ للعرض ومترجَمةً — لرفوف «أفضل ٥٠» (D-164).
 *
 * **ولماذا هنا لا في الصفحة:** الصفحة كانت المكان الثالث الذي يبني
 * «الأفضل» بطريقته الخاصّة، وهو أصل العطل. فالتحويل والترجمة يقعان مرّةً
 * واحدة إلى جانب المصدر، فلا يُولد مكانٌ رابع.
 *
 * **والترجمة عند العرض لا عند البناء (D-048/D-147):** الجدول يخزّن العنوان
 * مرّةً بلغة من بناه، وهذا صفٌّ لا يملكه أحد ويقرؤه الناس بلغتين — فلو
 * عُرض كما خُزّن لرأى نصفُ المستخدمين لغةَ النصف الآخر. والمحرّك مخبّأ
 * ساعةً والقائمة واحدةٌ للجميع، فالكلفة تُدفع مرّةً لا لكل زائر.
 */
export async function topChartRail(
  kind: "movie" | "tv" | "anime",
  want: number,
  locale: Locale,
): Promise<SearchResult[]> {
  /* نطلب أكثر ممّا نعرض ثم نُسقط الوثائقيات: التصفية بعد القصّ كانت
     ستُعيد ثمانيةً وثلاثين بطاقة وتسمّيها «أفضل خمسين» */
  const pool = await topChartRows(kind, Math.round(want * DOC_MARGIN));
  if (pool.length === 0) return [];
  const rows = await filterRail(pool, want, kind);
  if (rows.length === 0) return [];

  const localized = await localizeRows(
    rows.map((r) => ({
      tmdb_id: r.id,
      media_type: (r.media_type === "tv" ? "tv" : "movie") as "tv" | "movie",
      title: r.title ?? null,
      poster_path: r.poster_path,
    })),
    locale,
    want,
  );

  return rows.map((r, i) => {
    const l = localized[i];
    return {
      id: r.id,
      media_type: (r.media_type === "tv" ? "tv" : "movie") as "tv" | "movie",
      title: l?.title ?? r.title,
      name: l?.title ?? r.name,
      poster_path: l?.poster_path ?? r.poster_path,
      backdrop_path: null,
      overview: "",
      vote_average: 0,
      release_date: r.release_date,
      first_air_date: r.first_air_date,
      imdb_rating: r.imdb_rating,
      imdb_votes: r.imdb_votes,
    } as SearchResult;
  });
}

/**
 * «أفضل ٥٠ فيلم أنمي» — الصفُّ الوحيد الذي لا قائمةَ IMDb خلفه (D-169).
 *
 * **ويُقال صراحةً بدل أن يُخفى:** `imdb_chart` تصنّف `movie | tv | anime`،
 * و`anime` فيها **مسلسلاتٌ حصراً** لأن `is_anime` في `imdb_pool` يشترط
 * `media_type='tv'`. فأفلام الأنمي موجودةٌ في بِركة الأفلام مختلطةً بغيرها
 * ولا سبيل لاستخراجها منها. فهذا الصفّ يمشي على **مسار D-132**: بِركةٌ من
 * `/discover` بكلمة الأنمي، ثم ترتيبٌ بايزيّ بتقييمات IMDb.
 *
 * **وهو أضعفُ من أخواته ولا يُدّعى غير ذلك:** بِركة TMDB أضيق من ملفّات
 * IMDb، وعتبةُ الأصوات ثابتة. الحلّ النهائيّ رفعُ شرط `tv` عن `is_anime`
 * — هجرةٌ وإعادةُ ملء، وهي دَينٌ مُعلَن.
 */
export async function animeMovieRail(want: number, locale: Locale): Promise<SearchResult[]> {
  /* البِركة أوسع من المطلوب بمرّتين: `rankByImdb` تُسقط كل عملٍ بلا تقييم
     IMDb إسقاطاً كاملاً، فبِركةٌ بحجم المطلوب تعطي صفّاً ناقصاً */
  const pool = await topRatedRows("anime-movie", want * 2).catch(() => [] as SearchResult[]);
  if (pool.length === 0) return [];
  const ranked = rankByImdb(await withImdbRatings(pool), { want });
  if (ranked.length === 0) return [];

  const localized = await localizeRows(
    ranked.map((r) => ({
      tmdb_id: r.id,
      media_type: "movie" as const,
      title: r.title ?? r.name ?? null,
      poster_path: r.poster_path,
    })),
    locale,
    want,
  );

  return ranked.map((r, i) => ({
    ...r,
    title: localized[i]?.title ?? r.title,
    name: localized[i]?.title ?? r.name,
    poster_path: localized[i]?.poster_path ?? r.poster_path,
  }));
}
