import "server-only";

import { getSuggestions } from "@/lib/suggest";
import { getTrailer, backdropUrl, yearOf } from "@/lib/tmdb";
import { titleOf } from "@/lib/media";
import { getDict, type Locale } from "@/lib/i18n";
import { browseGenreForId, browseGenreName } from "@/lib/browse";

/**
 * 🆕 **علفُ «ترايلرات لك»** (D-726، مواصفةُ أحمد المكتوبة).
 *
 * 🔑 **ولا محرّكَ ترشيحٍ ثانٍ**: `getSuggestions` هي التي تُطعم «مختار
 * لك» منذ D-494 — **وصفٌّ ثانٍ بمصدرٍ ثانٍ تحت الاسم نفسِه («لك»)
 * يُخرج ترشيحين متناقضين في شاشةٍ واحدة** (D-664: رقمان بقاعدتين تحت
 * اسمٍ واحد). **والمصروفُ من `dismissed_titles` مصروفٌ من الاثنين معاً**
 * — **فزرُّ «ليس لي» يعمل يومَ يُبنى بلا جدولٍ جديدٍ ولا فعلٍ جديد.**
 *
 * ⚠️ **والمقطعُ يُطلب لِما سيُعرض وحدَه** (D-510): `getTrailer` نداءٌ
 * أو نداءان لكلِّ عمل، **فلا يُسأل عن ثلاثمئة اقتراحٍ ليُعرض عشرة.**
 * **وردودُ TMDB مخبَّأةٌ ساعةً** (`revalidate: 3600` في `tmdb.ts`) —
 * **فالكلفةُ الحقيقيّةُ أوّلُ قارئٍ في الساعة لا كلُّ فتحة.**
 *
 * ⚠️ **وما لا مقطعَ له يسقط ولا يترك بطاقةً فارغة** (شرطُ أحمد حرفاً،
 * وهو D-222 نفسُها: الصفرُ لا يُرسم) — **ولذلك يُطلب ضِعفُ المطلوب
 * تقريباً ثمّ يُقصّ بعد التصفية، لا قبلها.**
 */
export interface TrailerItem {
  tmdbId: number;
  mediaType: "tv" | "movie";
  title: string;
  /** مفتاحُ يوتيوب — **لا رابطٌ كامل**: القالبُ يُبنى عند الرسم */
  videoKey: string;
  backdrop: string | null;
  /** **المسارُ الخامُ لا الرابط** — `follow` تخزّن المسار (D-718: يُخزَّن ما يُرسم) */
  posterPath: string | null;
  year: string;
  /** اسمُ أوّلِ نوعٍ بلغة القارئ — «Action» تحت الاسم في تصميمه */
  genre: string | null;
  /** «لأنك تحبّ …» — **نصُّ `getSuggestions` نفسُه لا صياغةٌ ثانية** */
  note: string;
}

/** كم عملاً يُسأل عن مقطعه — **وما زاد على الحاجة ثمنُه نداءٌ لا يُعرض** */
const PROBE = 14;

/**
 * 🔑 **والسقفُ المطلوبُ من `getSuggestions` هو سقفُ «مختار لك» نفسُه**
 * (D-726): **الدالّةُ مخبَّأةٌ للطلب بوسائطها** — **فسقفٌ مختلفٌ هنا
 * يُبطل الخبيئةَ صامتاً ويخلط الترشيحَ مرّتين في فتحةٍ واحدة.**
 * **والقصُّ عندنا بعد القراءة لا عندها.**
 */
const POOL = 300;

export async function getTrailerFeed(limit: number, locale: Locale): Promise<TrailerItem[]> {
  const t = getDict(locale);
  /* **والاقتراحاتُ تُطلب واسعةً ثمّ تُقصّ**: `getSuggestions` تخلط
     وتُصفّي المصروفَ والمُشاهَد، **وسقفُها الداخليُّ هو ما نمرّره.** */
  const all = await getSuggestions(POOL, locale).catch(() => []);
  if (!all.length) return [];
  const pool = all.slice(0, PROBE);

  const withKeys = await Promise.all(
    pool.map(async (s) => {
      const mediaType = s.result.media_type === "movie" ? ("movie" as const) : ("tv" as const);
      const trailer = await getTrailer(mediaType, s.result.id).catch(() => null);
      if (!trailer?.key) return null;
      const g = s.result.genre_ids?.length ? browseGenreForId(s.result.genre_ids[0]) : null;
      return {
        tmdbId: s.result.id,
        mediaType,
        title: titleOf(s.result),
        videoKey: trailer.key,
        backdrop: backdropUrl(s.result.backdrop_path ?? null, "w780"),
        posterPath: s.result.poster_path ?? null,
        year: yearOf(s.result) ?? "",
        genre: g ? browseGenreName(g, locale) : null,
        note: s.seedTitle ? t.recoFrom(s.seedTitle) : t.recoFromGenre,
      } satisfies TrailerItem;
    }),
  );

  return withKeys.filter((x): x is TrailerItem => x !== null).slice(0, limit);
}
