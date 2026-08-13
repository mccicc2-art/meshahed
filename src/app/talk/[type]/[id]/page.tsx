import Link from "next/link";
import Image from "next/image";
import { redirect, notFound } from "next/navigation";
import {
  getUser,
  getMyArtFor,
  getMyRating,
  getCommunityRating,
  getTitleReviews,
  getTitleReplies,
} from "@/lib/data";
import { getMovie, getTv, posterUrl, backdropUrl } from "@/lib/tmdb";
import { displayWorkTitle } from "@/lib/wikidata";
import { getT } from "@/lib/locale";
import { BackButton } from "@/components/BackButton";
import { TalkCompose } from "@/components/TalkCompose";
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

  /* الخمسةُ معاً: لا شيء منها يعتمد على الآخر، والتسلسلُ كان يضيف
     أربعَ رحلاتٍ إلى صفحةٍ محتواها سطورُ نصّ.
     **و`getMyArtFor` سادسُها بلا كلفةٍ في الزمن** (D-216): الغلافُ الذي
     اخترتَه للعمل في صفحته هو غلافُه هنا — **صورتان مختلفتان لعملٍ واحد
     تُقرآن عملين.** */
  const [details, reviews, replies, mine, community, myArt] = await Promise.all([
    (mediaType === "tv" ? getTv(tmdbId) : getMovie(tmdbId)).catch(() => null),
    getTitleReviews(tmdbId, mediaType),
    getTitleReplies(tmdbId, mediaType),
    getMyRating(tmdbId, mediaType),
    getCommunityRating(tmdbId, mediaType),
    getMyArtFor(tmdbId, mediaType).catch(() => null),
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
  /* **ملصقان لا واحد، والفرقُ مقصود:** `posterPath` ما يُخزَّن مع التقييم
     — **ملصقُ TMDB الرسميّ** لأنه يُقرأ في أسطح الآخرين. و`artPoster` ما
     تراه أنت في هذه الصفحة (D-131). **وخلطُهما يكتب ذوقَك في بيانات
     غيرك.** */
  const posterPath = (details as { poster_path?: string | null } | null)?.poster_path ?? null;
  const poster = posterUrl(myArt?.poster_path ?? posterPath, "w185");
  const backdrop = backdropUrl(
    myArt?.backdrop_path ??
      (details as { backdrop_path?: string | null } | null)?.backdrop_path ??
      null,
    "w780",
  );
  const href = `/${mediaType === "tv" ? "show" : "movie"}/${tmdbId}`;
  const avg = Math.round(community.avg * 10) / 10;

  return (
    <main className="pb-24">
      {/* ============ الترويسة (D-216) ============

          **طلبُ أحمد:** «المفروض العرض يكون أفضل ١٠٠ مرة، يكون هيدر تبع
          الفلم وزرّ يوديني صفحة الفلم وزرّ يرجّعنا».

          **وشريطٌ قصير لا هيرو كامل** (اختيارُه): صفحةُ العمل تُعطي الغلافَ
          نصفَ الشاشة لأن سؤالَها «ما هذا العمل؟» — **وسؤالُ هذه الصفحة
          «ماذا قالوا؟»**، وغلافٌ طويل فوق حوارٍ يرتكب **نفسَ خطأ صندوق
          التعليق الذي نُصلحه أسفلَ هذا الملفّ**: يدفن المحتوى تحت الطيّة.

          ⚠️ **ويسار/يمين ليست القاعدة — البدايةُ والنهاية هي.** طلبُ أحمد
          «سهم الرجوع فوق يسار وسهم الفلم يمين» صحيحٌ في الإنجليزية
          **وينقلب في العربية**. فالرجوعُ في `start` وسهمُ العمل في `end`،
          **فيقعان حيث طلب في اللاتينية ويصحّان وحدَهما في RTL.** */}
      <header className="relative">
        <div className="relative h-[140px] sm:h-[180px] w-full overflow-hidden bg-surface-2">
          {backdrop && (
            <Image
              src={backdrop}
              alt=""
              fill
              sizes="100vw"
              priority
              className="object-cover"
            />
          )}
          {/* تدرّجان: واحدٌ يُلبس الصورةَ سواداً كي يُقرأ الاسمُ فوقها
              مهما كان لونها، وآخرُ من الأعلى كي يُقرأ الزرّان */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-transparent" />
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/45 to-transparent" />
        </div>

        {/* الزرّان العائمان — **هيئةُ صفحة العمل حرفاً بحرف**: زجاجيّان
            دائريّان بقطر لمسٍ ٤٤، فالرجوعُ بابٌ واحدٌ في التطبيق كلّه */}
        <div className="absolute inset-x-0 top-0 px-3 pt-3 flex items-center justify-between pointer-events-none">
          <div className="pointer-events-auto">
            <BackButton locale={locale} />
          </div>
          <Link
            href={href}
            aria-label={t.talkOpenTitlePage}
            title={t.talkOpenTitlePage}
            className="pointer-events-auto w-11 h-11 rounded-full bg-black/35 backdrop-blur-md border border-white/15 grid place-items-center text-white/90 active:scale-95 transition"
          >
            <Icon name="chevron-down" size={18} className="-rotate-90 rtl:rotate-90" />
          </Link>
        </div>

        {/* الملصقُ والاسمُ يركبان حافّةَ الصورة — **السطرُ كلُّه رابطٌ إلى
            العمل** كما كان: هدفُ لمسٍ واسع، ولا زرَّ داخل زرّ */}
        <div className="px-4 sm:px-6 -mt-10 relative">
          <Link href={href} className="flex items-end gap-3 group active:opacity-80 transition">
            <div className="relative w-[62px] h-[93px] shrink-0 rounded-xl overflow-hidden bg-surface-2 border border-border shadow-lg">
              {poster ? (
                <Image src={poster} alt="" fill sizes="62px" className="object-cover" />
              ) : (
                <span className="absolute inset-0 grid place-items-center text-muted">
                  <Icon name={mediaType === "tv" ? "tv" : "film"} size={18} />
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <h1 className="font-bold text-[18px] leading-tight line-clamp-2 group-hover:text-accent transition">
                {title}
              </h1>
              <p className="mt-1 flex items-center gap-2 text-[12px] text-muted">
                {community.count > 0 && (
                  <span className="font-bold text-accent tabular-nums" title={t.communityRating}>
                    ★ <span dir="ltr">{avg}</span>
                    {/* **ومقامُ النجمة معها هنا أيضاً** (D-216): «٩٫٥»
                        من اثنين ليست «٩٫٥» من ألف */}
                    <span className="font-normal text-muted"> ({community.count})</span>
                  </span>
                )}
                <span>{t.talkOpenTitlePage}</span>
              </p>
            </div>
          </Link>
        </div>
      </header>

      <div className="px-4 sm:px-6 max-w-xl mx-auto">
        {/* **زرٌّ لا صندوق** (D-216) — التفصيلُ في `TalkCompose.tsx` */}
        <div className="mt-5">
          <TalkCompose
            tmdbId={tmdbId}
            mediaType={mediaType}
            title={rawTitle}
            posterPath={posterPath}
            locale={locale}
            initialRating={mine?.rating ?? null}
            initialReview={mine?.review ?? null}
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
      </div>
    </main>
  );
}
