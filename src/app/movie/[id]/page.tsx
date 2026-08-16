import Link from "next/link";
import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import Image from "next/image";
import {
  getUser,
  getFollowState,
  isMovieWatched,
  getMyRating,
  getCommunityRating,
  getTitleReviews,
  getTitleReplies,
  getMyLists,
  getListsContaining,
  getPublicListsContaining,
  getTitleCircle,
  getMyArtFor,
  getMyFavorites,
  artKey,
} from "@/lib/data";
import { getMovie, getTrailer, getWatchProviders, backdropUrl, posterUrl } from "@/lib/tmdb";
import { displayWorkTitle } from "@/lib/wikidata";
import { universeOf } from "@/lib/universes";
import { getT, getWatchRegion } from "@/lib/locale";
import { type Locale } from "@/lib/i18n";
import { AddWorksToList } from "@/components/AddWorksToList";
import { PublicListsRail } from "@/components/PublicListsRail";
import { HeroRatings, HeroRatingsSkeleton } from "@/components/HeroRatings";
import { RatingBox } from "@/components/RatingBox";
import { CommunityReviews } from "@/components/CommunityReviews";
import { DetailTabs } from "@/components/DetailTabs";
import { TitleNewsTab } from "@/components/TitleNewsTab";
import { TitleRoomTab } from "@/components/TitleRoomTab";
import { RelatedTitles } from "@/components/RelatedTitles";
import { CastRail } from "@/components/CastRail";
import { SectionTitle } from "@/components/Icon";
import { Trailer } from "@/components/Trailer";
import { WatchChip } from "@/components/WatchChip";
import { TitleActions } from "@/components/TitleActions";
import { DetailTopBar } from "@/components/DetailTopBar";
import { CircleNote } from "@/components/CircleNote";
import { ReadMore } from "@/components/ReadMore";
import { buttonClass } from "@/components/ui/Button";

export default async function MoviePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();
  const { id } = await params;
  const movieId = Number(id);
  if (!Number.isFinite(movieId)) notFound();

  // بيانات TMDB وبيانات المستخدم تُطلب معاً: لا شيء منها يعتمد على الآخر،
  // وانتظار الأولى قبل الثانية كان يضيف رحلة كاملة إلى الخادم
  // بيانات أول رسمة فقط — الترايلر والتعليقات تُبثّ لاحقاً عبر Suspense
  const userRegion = await getWatchRegion();
  const [movie, followState, watched, watchWhere, myLists, inLists, circle, myArt, favs] = await Promise.all([
    getMovie(movieId).catch(() => null),
    getFollowState(movieId, "movie"),
    isMovieWatched(movieId),
    getWatchProviders("movie", movieId),
    getMyLists(),
    getListsContaining(movieId, "movie"),
    /* نشاط دائرتك (D-127) — داخل الموجة نفسها؛ انظر تعليق صفحة المسلسل */
    getTitleCircle(movieId, "movie"),
    /* غلافي المختار لهذا العمل (D-131) — قراءةٌ من خريطةٍ مخبّأة لكل طلب */
    getMyArtFor(movieId, "movie"),
    /* مفضّلاتي (D-130) — نداءٌ واحد مخبّأ للطلب، لا سؤالٌ لكل عمل */
    getMyFavorites(),
  ]);

  if (!movie) {
    return (
      <div className="text-center py-24">
        <p className="text-muted mb-4">{t.movieLoadFailed}</p>
        <div className="flex items-center justify-center gap-2">
          <Link
            href="/"
            className={buttonClass({ size: "sm" })}
          >
            {t.navHome}
          </Link>
          <Link
            href="/search"
            className="px-4 py-2 rounded-xl border border-border text-sm text-muted hover:text-foreground transition"
          >
            {t.navSearch}
          </Link>
        </div>
      </div>
    );
  }

  /* العنوان بالعربية إن لم تترجمه TMDB (D-176) — نفس شرطَي `displayPersonName`
     ونفس صمته، وبعد حارس `!movie` لا قبله. */
  const title = await displayWorkTitle(movieId, "movie", movie.title, locale);

  /* غلافي المختار (D-131) يسبق غلاف TMDB — **في صفحتي أنا وحدها**
     (ق٨). النقطة واحدة هنا فلا تتفرّق على البطاقات. */
  const backdrop = backdropUrl(myArt?.backdrop_path ?? movie.backdrop_path);
  const poster = posterUrl(myArt?.poster_path ?? movie.poster_path, "w342");
  /* العالم فحصٌ محليّ في القاموس — زرّه صعد إلى الترويسة (طلب المالك) */
  const universe = universeOf(movieId);

  return (
    <div>
      {/* الترويسة: الملصق والعنوان والأزرار فقط — القصة والترايلر والآراء
          انتقلت إلى تبويبات، فالصفحة تبدأ من شاشة واحدة لا من عمود طويل */}
      <div className="relative -mx-4 -mt-6 h-44 sm:h-72 mb-4">
        {backdrop && (
          <Image
            src={backdrop}
            alt=""
            fill
            priority
            sizes="(max-width: 640px) 100vw, 1152px"
            className="object-cover opacity-45"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--background)] via-[color:var(--background)]/35 to-transparent" />
        <DetailTopBar
          title={title}
          locale={locale}
          tmdbId={movieId}
          mediaType="movie"
          posterPath={movie.poster_path}
          initialDropped={followState.dropped}
          art={myArt}
        />
      </div>

      <div className="flex flex-wrap gap-4 -mt-24 sm:-mt-28 relative px-1">
        <div className="w-32 sm:w-44 shrink-0">
          <div className="relative aspect-[2/3] rounded-poster overflow-hidden ring-1 ring-white/10 bg-surface-2 shadow-[0_18px_44px_rgba(0,0,0,0.55)]">
            {poster && <Image src={poster} alt={title} fill sizes="176px" className="object-cover" />}
          </div>
        </div>

        {/* ===== عمود البيانات — من قمّة الملصق لا من قاعه (طلب المالك) =====
            كان `self-end` يلصق العنوان بأسفل الملصق ويترك المساحة جنبه
            فارغة. الآن العنوان يوازي بداية الملصق، والمساحة تحته تحمل
            البيانات كلّها: السنة والمدّة والتقييم، فالأنواع، فالمنصّة،
            فأزرار السلسلة والعالم — التي كانت تسكن ذيل الصفحة. */}
        <div className="flex-1 min-w-0 self-start pt-0.5">
          <h1 className="text-xl sm:text-3xl font-extrabold leading-tight tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)]">
            {title}
          </h1>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-muted mt-1">
            {movie.release_date && <span>{movie.release_date.slice(0, 4)}</span>}
            {movie.runtime ? (
              <>
                <span aria-hidden>·</span>
                <span>{t.minutesCount(movie.runtime)}</span>
              </>
            ) : null}
          </div>

          {/* التقييم سطرٌ مستقلّ تحت البيانات، بشعارَي IMDb وطماطم لا
              بأسمائهما، ومن هذين المصدرين فقط — لا نجمة TMDB (قرار أحمد
              ٨ أغسطس، يُتمّ نقض D-027) */}
          {/* 🆕 **والتصنيفُ العمريُّ يذيّل السطرَ نفسَه** (D-286، طلبُ
              أحمد: «التصنيف العمري حطها في كل صفحات المسلسلات والأفلام»).
              **ولا نداءَ ثالثاً له** — يصل في ردّ OMDb نفسِه. */}
          <Suspense fallback={<HeroRatingsSkeleton />}>
            <HeroRatings imdbId={movie.imdb_id} ageLabel={t.ageRating} />
          </Suspense>

          {/* «٣ ممن تتابعهم شاهدوه» (D-127) — انظر تعليق صفحة المسلسل */}
          <CircleNote circle={circle} locale={locale} />

          {/* الأنواع صعدت من تبويب «معلومات» إلى جنب الملصق (طلب المالك):
              هوية الفيلم تُقرأ قبل قصّته لا بعدها */}
          {movie.genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {movie.genres.slice(0, 3).map((g) => (
                <span
                  key={g.id}
                  className="text-[11px] font-medium bg-surface-2 border border-border px-2.5 py-1 rounded-full"
                >
                  {g.name}
                </span>
              ))}
            </div>
          )}

          {/* أين يُبثّ — في الترويسة، وقسم المنصّات في «معلومات» حُذف */}
          {watchWhere && (
            <div className="mt-2">
              <WatchChip
                options={watchWhere.options}
                region={watchWhere.region}
                userRegion={userRegion}
                locale={locale}
              />
            </div>
          )}

        </div>

        {/* زرّا السلسلة والعالم (D-052/D-074) — خرجا من عمود البيانات إلى
            طرف الترويسة الفارغ (طلب المالك من لقطة الشاشة): على الشاشات
            الواسعة عمود ثالث متوسّط عمودياً في نهاية الصفّ، وعلى الضيّقة —
            حيث لا طرف فارغ أصلاً — يلتفّان سطراً كاملاً تحت الترويسة.
            نسخة واحدة تتنقّل بالتخطيط لا نسختان (بابٌ واحد لكل فعل) */}
        {(movie.belongs_to_collection || universe) && (
          <div className="basis-full sm:basis-auto sm:self-center flex flex-wrap sm:flex-col gap-2 mt-3 sm:mt-0 sm:ms-2">
            {/* **زرُّ «احفظ كل الأجزاء كقائمة» حُذف** (D-190، شطبه أحمد
                بلقطة). كان يُنشئ قائمةً من مجموعة الفيلم بضغطةٍ — فعلٌ
                نادرٌ يأخذ أوّلَ صفٍّ في الترويسة فوق «أضف إلى قائمة»
                نفسه، **وزرّان متجاوران يبدأان بـ«أضف/احفظ» يجعلان الأهمَّ
                يُقرأ ثانياً**. ومجموعةُ الفيلم ما زالت في تبويب «مشابه»
                (`RelatedTitles`)، فلا شيء صار غير ممكن — صار أطولَ خطوة.
                وزرُّ الكون (`universe`) باقٍ: مجموعاتُ الأكوان لا يعرضها
                تبويبٌ آخر. */}
            {universe && (
              <AddWorksToList source="universe" id={universe.slug} locale={locale} />
            )}
          </div>
        )}
      </div>

      {/* الإجراء الرئيسي: أضف لقائمة + دائرة «شاهدتُه» — نفس لغة صفحة المسلسل */}
      <div className="mt-5 px-1">
        <TitleActions
          tmdbId={movieId}
          mediaType="movie"
          title={movie.title}
          posterPath={movie.poster_path}
          /* 🆕 D-313 — غلافُ TMDB لا غلافي المختار: البطاقةُ يراها كلُّ
             الناس، **وزينتي لا تسافر** (حجّةُ D-131 حرفاً) */
          backdropPath={movie.backdrop_path}
          locale={locale}
          initialFollowing={followState.following}
          lists={myLists.map((l) => ({ id: l.id, name: l.name }))}
          containing={inLists}
          episodesTotal={null}
          runtime={movie.runtime ?? null}
          initialDone={watched}
          collectionId={movie.belongs_to_collection?.id ?? null}
          initialFavorite={favs.has(artKey("movie", movieId))}
        />
      </div>

      {/* تبويب «تتبّع» حُذف من الأفلام: الفيلم إمّا شوهد أو لم يُشاهَد،
          ودائرة ✓ في الترويسة تقول ذلك وتقلبه — لا يحتاج تبويباً كاملاً */}
      <DetailTabs
        tabs={[
          {
            key: "info",
            label: t.tabInfo,
            icon: "info",
            content: (
              <div className="space-y-7">
                {/* **«أين أشاهده» حُذف من هنا كاملاً** (D-190، طلب أحمد).
                    الشارةُ في الترويسة صارت الجوابَ الوحيد: رموزُ منصّات
                    الطبقة الأولى بلا أسماء، والضغطُ يفتح JustWatch بكلّ
                    التفاصيل. **وثلاثةُ صفوفٍ تقول اشتراك/تأجير/شراء كانت
                    تجيب سؤالاً لم يُسأل** — من يفتح صفحة عملٍ يريد أن يعرف
                    «أقدر أشاهده؟» لا جدولَ أسعارٍ لا نملكه أصلاً (D-150). */}
                {movie.overview && (
                  <section>
                    <SectionTitle icon="info" className="mb-2.5">
                      {t.storyTitle}
                    </SectionTitle>
                    <ReadMore text={movie.overview} locale={locale} />
                  </section>
                )}

                {/* الأنواع صعدت إلى الترويسة جنب الملصق — لا نسخة ثانية هنا */}

                <Suspense
                  fallback={<div className="skeleton aspect-video rounded-2xl" aria-hidden />}
                >
                  <MovieTrailerSection
                    movieId={movieId}
                    title={title}
                    backdrop={backdrop}
                    locale={locale}
                  />
                </Suspense>

                {/* **الطاقمُ عاد إلى «عن العمل» — ثالثاً لا أوّلاً** (D-203،
                    طلب أحمد بنصّه: «تيوب cast احذف وضيف كاست ضمن تبويب
                    أباوت، لكن ما يكون أوّل شيء: الأوّل القصة بعده الفيديو
                    بعده كاست»).

                    **ونقضٌ صريحٌ لقرارٍ سابق:** كان الطاقمُ داخل «معلومات»
                    منذ D-080، ثم خرج تبويباً بطلبه (D-090) لأن التبويبَ
                    طال. **وقد عاد لأن السببَ زال:** «أين أشاهده» غادرت في
                    D-190، والأنواعُ صعدت إلى الترويسة — **فالتبويبُ الذي
                    كان طويلاً صار سطرَ قصّةٍ ومقطعاً**.

                    **والترتيبُ الذي طلبه هو ترتيبُ السؤال:** «عن ماذا؟» ثم
                    «كيف يبدو؟» ثم «من فيه؟» — والوجوهُ آخرُ ما يُسأل عنه
                    قبل المشاهدة لا أوّلُه. **وخمسةُ تبويباتٍ على ٣٦٠px
                    كانت تُقصّ أسماءها** («Epis…» · «Com…» · «Revi…» في
                    لقطته) — فحذفُ واحدٍ يشتري قراءةَ الأربعة الباقية. */}
                <Suspense fallback={null}>
                  <CastRail mediaType="movie" tmdbId={movieId} locale={locale} />
                </Suspense>
              </div>
            ),
          },
          {
            key: "similar",
            label: t.tabSimilar,
            icon: "grid",
            content: (
              <div className="space-y-7">
                <Suspense fallback={null}>
                  <RelatedTitles
                    mediaType="movie"
                    tmdbId={movieId}
                    collectionId={movie.belongs_to_collection?.id ?? null}
                    locale={locale}
                  />
                </Suspense>
                {/* القوائم التي تضمّ هذا الفيلم — طريقُ «أعجبك؟ خذ عشرته» */}
                <Suspense fallback={null}>
                  <ListsWithMovie movieId={movieId} locale={locale} />
                </Suspense>
              </div>
            ),
          },
          {
            /**
             * 🆕 **تبويبُ «الأخبار»** (D-300، طلبُ أحمد: «يُفضّل في صفحة
             * الفلم يكون فيه تبويب أخبار أو تحديث ويُكتب فيه»).
             *
             * **وموضعُه بعد «معلومات» وقبل «التعليقات»**: الأوّلُ حقائقُ
             * العمل الثابتة، **وهذا حقائقُه المتحرّكة**، **والتعليقاتُ
             * كلامُ الناس عنه** — **فالترتيبُ من الأثبت إلى الأكثر
             * تغيّراً إلى الرأي** (D-222: صاحبُ الكلام في صدر صفّه،
             * والحقيقةُ قبل الرأي).
             *
             * **وخلف `Suspense`**: قراءتُه ترشيحٌ فوق ثلاثمئة صفّ
             * (انظر `getTitleLoopzNews`) — **فلا يؤخّر رسمَ الصفحة**
             * (D-071/D-087).
             */
            key: "news",
            label: t.communityTabNews,
            icon: "newspaper",
            content: (
              <Suspense fallback={<div className="skeleton h-40 rounded-2xl" aria-hidden />}>
                <TitleNewsTab tmdbId={movieId} mediaType="movie" locale={locale} />
              </Suspense>
            ),
          },
          {
            key: "reviews",
            label: t.tabReviews,
            icon: "comment",
            content: (
              <Suspense
                fallback={
                  <div className="space-y-4" aria-hidden>
                    <div className="skeleton h-44 rounded-2xl" />
                    <div className="skeleton h-24 rounded-2xl" />
                  </div>
                }
              >
                <MovieReviewsTab
                  movieId={movieId}
                  title={movie.title}
                  posterPath={movie.poster_path}
                  backdropPath={movie.backdrop_path}
                  locale={locale}
                />
              </Suspense>
            ),
          },
          {
            /* **تبويبُ المجتمع — الغرفةُ نفسها لا رابطٌ إليها** (D-191،
               طلب أحمد: «تبويب اسمه كوميونيتي مربوط بغرفة الكوميونيتي
               الخاصة فيه»). وموضعُه **ثالثاً** كما طلب: الحديثُ عن العمل
               أقربُ إلى العمل من «مشابه»، وغرفُ الأعمال (D-140) كانت أثمنَ
               ما في المجتمع وأخفاه — سطراً في تبويبٍ رابع.
               والسطرُ القديم (`TitleRoomLink`) حُذف من «التعليقات» مع
               النقل: **لا بابان لغرفةٍ واحدة.** */
            key: "community",
            label: t.tabCommunity,
            icon: "people",
            content: (
              <Suspense
                fallback={<div className="skeleton h-64 rounded-2xl" aria-hidden />}
              >
                <TitleRoomTab tmdbId={movieId} mediaType="movie" locale={locale} />
              </Suspense>
            ),
          },
        ]}
      />

    </div>
  );
}

/** القوائم العامة التي تضمّ هذا الفيلم — داخل تبويب «مشابه» */
async function ListsWithMovie({ movieId, locale }: { movieId: number; locale: Locale }) {
  const lists = await getPublicListsContaining(movieId, "movie", 10);
  if (!lists.length) return null;
  return <PublicListsRail lists={lists} locale={locale} />;
}

/** الترايلر يُبثّ بعد أول رسمة */
async function MovieTrailerSection({
  movieId,
  title,
  backdrop,
  locale,
}: {
  movieId: number;
  title: string;
  backdrop: string | null;
  locale: Awaited<ReturnType<typeof getT>>["locale"];
}) {
  const trailer = await getTrailer("movie", movieId);
  if (!trailer) return null;
  return <Trailer videoKey={trailer.key} title={title} thumbnail={backdrop} locale={locale} />;
}

/** تبويب التعليقات يُبثّ لاحقاً — لا يؤخّر الترويسة */
async function MovieReviewsTab({
  movieId,
  title,
  posterPath,
  backdropPath,
  locale,
}: {
  movieId: number;
  title: string;
  posterPath: string | null;
  /** 🆕 D-313 — يمرّ إلى صندوق التقييم فيُكتب مع الحفظ */
  backdropPath?: string | null;
  locale: Awaited<ReturnType<typeof getT>>["locale"];
}) {
  const [myRating, community, titleReviews, titleReplies] = await Promise.all([
    getMyRating(movieId, "movie"),
    getCommunityRating(movieId, "movie"),
    getTitleReviews(movieId, "movie"),
    /* الردودُ مع الآراء في نفس الدفعة (D-193): نداءٌ ثانٍ متسلسلٌ كان
       يضيف رحلةً كاملة إلى تبويبٍ يُبثّ أصلاً */
    getTitleReplies(movieId, "movie"),
  ]);
  return (
    <div className="space-y-4">
      {/* غرفة النقاش قبل التقييم — نفس ترتيب صفحة المسلسل (D-140) */}
      <RatingBox
        variant="review"
        tmdbId={movieId}
        mediaType="movie"
        title={title}
        posterPath={posterPath}
        backdropPath={backdropPath}
        locale={locale}
        initialRating={myRating?.rating ?? null}
        initialReview={myRating?.review ?? null}
      />
      <CommunityReviews
        tmdbId={movieId}
        mediaType="movie"
        locale={locale}
        avg={community.avg}
        count={community.count}
        reviews={titleReviews}
        replies={titleReplies}
      />
    </div>
  );
}
