import Link from "next/link";
import Image from "next/image";
import { redirect, notFound } from "next/navigation";
import {
  getUser,
  getMyRating,
  getCommunityRating,
  getTitleReviews,
  getTitleReplies,
} from "@/lib/data";
import { getMovie, getTv, posterUrl } from "@/lib/tmdb";
import { displayWorkTitle } from "@/lib/wikidata";
import { getT } from "@/lib/locale";
import { RatingBox } from "@/components/RatingBox";
import { TalkThread } from "@/components/TalkThread";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

/**
 * **صفحةُ الكلام عن عمل** (D-193، طلب أحمد بنصّه: «إذا ضغطت على الفيلم ما
 * أبغاه يوديني صفحة الفيلم، لا، أبغى صفحة تعليقات فقط كأني فاتح مجتمع،
 * لكن فيه كل التعليقات الي موجودة في صفحة الفيلم **ومربوطين ببعض**»).
 *
 * **ولماذا صفحةٌ ثالثة والآراءُ موجودةٌ في صفحة العمل؟** لأن صفحة العمل
 * تجيب سؤالاً آخر: «ما هذا العمل، وهل أشاهده؟» — فيها الغلافُ والقصّةُ
 * والممثّلون والمنصّات، والآراءُ تبويبٌ من ثلاثة في أسفلها. **ومن ضغط
 * بطاقةَ كلامٍ في المجتمع لا يسأل ذاك السؤال: هو داخلٌ على حديث.**
 * فتُفتح له الغرفةُ مباشرةً — ملصقٌ صغير وسطرُ عنوانٍ، ثم الكلام.
 *
 * **وهي نفسُ البيانات لا نسخةٌ منها:** `getTitleReviews` هي هي التي
 * تقرؤها صفحةُ العمل، والإعجابُ والبلاغُ نفسُ الجدولين — فرقمُ الإعجاب
 * واحدٌ في السطحين لأنه صفٌّ واحد. **والجديدُ وحده الردود**
 * (`getTitleReplies`، هجرة ٦٢) وهي «مربوطين ببعض» التي طلبها.
 *
 * **والطريقُ إلى العمل نفسه لم يُقطع:** سطرُ الترويسة كلُّه رابطٌ إليه —
 * ومن أراد المشاهدة يصل بلمسة. وصفحةُ العمل بدورها لا تُرسل إلى هنا: لها
 * تبويبُها ولها غرفتُها (D-191)، **ولا نُخرج القارئ من العمل ليتكلّم عنه.**
 *
 * ⚠️ `type` في المسار هو `tv` أو `movie` — **مفرداتُ TMDB لا مفرداتُ
 * الروابط** (`‎/show/…` · `‎/movie/…`). والسببُ أن الصفحة عامّةٌ للنوعين
 * ومفتاحُها في القاعدة `media_type`، فمسارٌ يخالف عمودَ القاعدة يُترجم في
 * كل نداء. **وغيرُهما `notFound` لا افتراضٌ صامت.**
 */
export default async function TalkPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();
  const { type, id } = await params;
  if (type !== "tv" && type !== "movie") notFound();
  const mediaType = type as "tv" | "movie";
  const tmdbId = Number(id);
  if (!Number.isFinite(tmdbId)) notFound();

  /* الأربعةُ معاً: لا شيء منها يعتمد على الآخر، والتسلسلُ كان يضيف
     ثلاث رحلاتٍ إلى صفحةٍ محتواها سطورُ نصّ */
  const [details, reviews, replies, mine, community] = await Promise.all([
    (mediaType === "tv" ? getTv(tmdbId) : getMovie(tmdbId)).catch(() => null),
    getTitleReviews(tmdbId, mediaType),
    getTitleReplies(tmdbId, mediaType),
    getMyRating(tmdbId, mediaType),
    getCommunityRating(tmdbId, mediaType),
  ]);

  /* TMDB ساقطٌ أو المعرّف خاطئ؟ **الكلامُ يبقى** — العنوانُ مخزَّنٌ مع
     كل تقييم (D-048)، فالصفحة تُرسم من القاعدة وحدها. و`notFound` هنا
     كان سيُخفي حواراً قائماً لأن مصدراً خارجياً تعذّر */
  const rawTitle = details
    ? mediaType === "tv"
      ? (details as { name: string }).name
      : (details as { title: string }).title
    : (reviews[0] as { title?: string } | undefined)?.title ?? "";
  const title = rawTitle
    ? await displayWorkTitle(tmdbId, mediaType, rawTitle, locale)
    : t.talkFallbackTitle;
  const posterPath = (details as { poster_path?: string | null } | null)?.poster_path ?? null;
  const poster = posterUrl(posterPath, "w185");
  const href = `/${mediaType === "tv" ? "show" : "movie"}/${tmdbId}`;
  const avg = Math.round(community.avg * 10) / 10;

  return (
    <main className="px-4 sm:px-6 py-5 max-w-xl mx-auto pb-24">
      {/* الترويسة: بابُ العمل. سطرٌ واحدٌ قابلٌ للنقر لا زرٌّ منفصل —
          هدفُ لمسٍ واسع، والسهمُ يقول «هناك المزيد» */}
      <Link
        href={href}
        className="flex items-center gap-3 group active:opacity-80 transition"
      >
        <div className="relative w-[46px] h-[69px] shrink-0 rounded-lg overflow-hidden bg-surface-2 border border-border">
          {poster ? (
            <Image src={poster} alt="" fill sizes="46px" className="object-cover" />
          ) : (
            <span className="absolute inset-0 grid place-items-center text-muted">
              <Icon name={mediaType === "tv" ? "tv" : "film"} size={16} />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-bold text-[17px] leading-tight line-clamp-2 group-hover:text-accent transition">
            {title}
          </h1>
          <p className="mt-1 flex items-center gap-2 text-[12px] text-muted">
            {community.count > 0 && (
              <span className="font-bold text-accent tabular-nums" title={t.communityRating}>
                ★ <span dir="ltr">{avg}</span>
              </span>
            )}
            <span>{t.talkOpenTitlePage}</span>
          </p>
        </div>
        <Icon
          name="chevron-down"
          size={16}
          className="shrink-0 text-muted -rotate-90 rtl:rotate-90"
        />
      </Link>

      {/* «أعلّق على الفيلم» — صندوقُ التقييم نفسُه بلا نسخةٍ ثانية.
          وهو أوّلُ ما تراه بعد العنوان: من فتح غرفةَ كلامٍ يريد أن يتكلّم */}
      <div className="mt-5">
        <RatingBox
          tmdbId={tmdbId}
          mediaType={mediaType}
          title={rawTitle}
          posterPath={posterPath}
          locale={locale}
          initialRating={mine?.rating ?? null}
          initialReview={mine?.review ?? null}
          variant="review"
        />
      </div>

      <h2 className="mt-6 mb-3 font-bold text-[15px]">{t.talkHeading}</h2>
      <TalkThread
        reviews={reviews}
        replies={replies}
        tmdbId={tmdbId}
        mediaType={mediaType}
        locale={locale}
        signedIn
      />
    </main>
  );
}
