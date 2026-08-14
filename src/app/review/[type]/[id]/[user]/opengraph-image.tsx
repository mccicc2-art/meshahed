import { ImageResponse } from "next/og";
import { getTitleReviews } from "@/lib/data";
import { displayNameOf } from "@/lib/people";
import { getMovie, getTv, posterUrl } from "@/lib/tmdb";
import { displayWorkTitle } from "@/lib/wikidata";
import { dirOf } from "@/lib/dir";
import { getT } from "@/lib/locale";
import { OG_SIZE, OG_CONTENT_TYPE, ogFonts, threadOgCard } from "@/lib/og";

/**
 * **بطاقةُ مشاركةِ تعليقِ شخص** — ذيلُ D-221.
 *
 * **ورأيُ الإنسان هو البطاقة لا اسمُ العمل**: من شارك رابطَ تعليقٍ يشارك
 * ما قيل، **وبطاقةٌ تقول «فيلمٌ في Loopz» تُخفي سببَ المشاركة.**
 *
 * ⚠️ **و`hide_name` يُحترم هنا كما في الصفحة**: `displayNameOf` هي هي
 * التي تحسم الاسمَ المعروض — **وسطحٌ يُشارَك خارج التطبيق أولى بالحارس
 * لا أحقّ بالاستثناء.** **ولا ملصقَ خاصّاً بك** (`getMyArtFor`): البطاقةُ
 * تُبنى لغريبٍ لا جلسةَ له، فاختيارُك الشخصيُّ للغلاف ليس له.
 */
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Loopz";

export default async function Image({
  params,
}: {
  params: Promise<{ type: string; id: string; user: string }>;
}) {
  const { type, id, user } = await params;
  if (type !== "tv" && type !== "movie") return new Response("not found", { status: 404 });
  const tmdbId = Number(id);
  if (!Number.isFinite(tmdbId)) return new Response("not found", { status: 404 });

  const { locale, t } = await getT();
  const reviews = await getTitleReviews(tmdbId, type).catch(() => []);
  const r = reviews.find((x) => x.id === user);
  const said = r?.review?.trim();
  /* **ورأيٌ بلا نصّ لا بطاقةَ له**: تقييمٌ رقميٌّ وحده لا يصنع جملةً
     تستحقّ المشاركة — تُورَّث بطاقةُ الجذر. */
  if (!r || !said) return new Response("not found", { status: 404 });

  const details = await (type === "tv" ? getTv(tmdbId) : getMovie(tmdbId)).catch(() => null);
  const raw = details
    ? type === "tv"
      ? (details as { name: string }).name
      : (details as { title: string }).title
    : "";
  const work = raw ? await displayWorkTitle(tmdbId, type, raw, locale) : "";

  return new ImageResponse(
    threadOgCard({
      kicker: displayNameOf(r, t.anonymousUser),
      body: said.length > 240 ? `${said.slice(0, 240)}…` : said,
      work,
      poster: posterUrl(
        (details as { poster_path?: string | null } | null)?.poster_path ?? null,
        "w342",
      ),
      badge: r.rating != null ? r.rating.toFixed(1) : null,
      rtl: dirOf(said) === "rtl",
    }),
    { ...size, fonts: await ogFonts() },
  );
}
