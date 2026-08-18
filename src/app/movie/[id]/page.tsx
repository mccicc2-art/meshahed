import Link from "next/link";
import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import Image from "next/image";
import {
  getUser,
  getFollowState,
  isMovieWatched,
  getMyLists,
  getListsContaining,
  getPublicListsContaining,
  getTitleCircle,
  getMyArtFor,
  getTitlePulse,
  getMyFavorites,
  getCuratedListIds,
  getMySavedListIds,
  artKey,
} from "@/lib/data";
import { getMovie, getTrailer, getWatchProviders, backdropUrl, posterUrl } from "@/lib/tmdb";
import { displayWorkTitle } from "@/lib/wikidata";
import { universeOf } from "@/lib/universes";
import { getT, getWatchRegion } from "@/lib/locale";
import { type Locale } from "@/lib/i18n";
import { UniverseSaveRow } from "@/components/UniverseSaveRow";
import { PublicListsRail } from "@/components/PublicListsRail";
import { HeroRatings, HeroRatingsSkeleton } from "@/components/HeroRatings";
import { DetailTabs } from "@/components/DetailTabs";
import { TitleCommunityTab } from "@/components/TitleCommunityTab";
import { RelatedTitles } from "@/components/RelatedTitles";
import { CastRail } from "@/components/CastRail";
import { SectionTitle } from "@/components/Icon";
import { Trailer } from "@/components/Trailer";
import { WatchChip } from "@/components/WatchChip";
import { TitleActions } from "@/components/TitleActions";
import { TitlePulse } from "@/components/TitlePulse";
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
  const [movie, followState, watched, watchWhere, myLists, inLists, circle, myArt, favs, pulse] = await Promise.all([
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
    /* 🆕 **نبضُ العمل** (D-408) — نداءُ `definer` واحدٌ مفهرسٌ داخل
       الموجة نفسِها لا خلف حاجز: **سطرٌ يظهر متأخّراً يدفع الأنواعَ
       تحته** (D-046)، **والصفحةُ تنتظر TMDB على كل حال** (حجّةُ
       `getTitleCircle` حرفاً). */
    getTitlePulse(movieId, "movie"),
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
  /* 🆕 **ومعرّفُ قائمته المولَّدة وحالةُ حفظها** (D-347): نداءان مخبّآن
     **ولا يقعان إلا لفيلمٍ له عالَم** — ومن لا عالَمَ له لا يدفع شيئاً
     (D-152). **والغيابُ يعني «لم تُولَّد بعد» فلا زرَّ** (D-181). */
  const [curatedMap, mySaved] = universe
    ? await Promise.all([
        getCuratedListIds().catch(() => new Map<string, string>()),
        getMySavedListIds().catch(() => new Set<string>()),
      ])
    : [new Map<string, string>(), new Set<string>()];
  const universeListId = universe ? curatedMap.get(universe.slug) ?? null : null;
  const universeSaved = !!universeListId && mySaved.has(universeListId);

  return (
    <div>
      {/* الترويسة: الملصق والعنوان والأزرار فقط — القصة والترايلر والآراء
          انتقلت إلى تبويبات، فالصفحة تبدأ من شاشة واحدة لا من عمود طويل */}
      {/* 🆕 **الغلافُ ارتفع والملصقُ معه** (D-399، طلبُ أحمد:
          «والهيدر ارفعه والبوستر كذلك»). **١٧٦px صارت ١٤٤** على
          الجوال و**٢٨٨ صارت ٢٤٠** على العريض، **والفجوةُ تحته ١٢
          لا ١٦** — **فالعنوانُ والأزرارُ صعدت ٣٦px** ودخل أوّلُ
          صفٍّ من المحتوى في الشاشة الأولى. **والملصقُ يبقى مطلّاً
          على الغلاف بنفس المقدار** (`-mt-24`) فلا ينقطع التداخلُ
          الذي يصنع العمق. */}
      {/* 🆕 **الغلافُ ينزل خلف الملصق كلِّه** (D-403، لقطةُ أحمد
          بمستطيلين: «الغلاف حالياً ماخذ المساحة الحمراء فقط، أحتاجه ينزل
          وياخذ المساحة الخضراء كاملة، بحيث يكون البوستر فوقه مو مشكلة»).

          **وما كان قبله:** صندوقٌ بارتفاعٍ ثابت يحمل الصورة، **وصفُّ
          الملصق يُسحب إليه بهامشٍ سالب** — **فالصورةُ تنتهي عند منتصف
          الملصق** والثلثُ الأسفل منه يجلس على خلفيّة الصفحة. **صورةٌ
          مقطوعةٌ في منتصف عنصرٍ يعلوها تُقرأ عطلاً لا عمقاً.**

          **والآن طبقتان لا صندوق**: الغلافُ `absolute inset-0` **يغطّي
          الترويسة كلَّها** — الفراغَ العلويَّ وصفَّ الملصق معاً —
          **والمحتوى فوقه `relative`**. **وارتفاعُ الترويسة صار ارتفاعَ
          ما فيها** لا رقماً يُضبط بيده: الفراغُ العلويّ (`h-36 sm:h-60`)
          زائداً صفَّ الملصق ناقصاً سحبَه. **فلا رقمَ ثالثاً يُصان.**

          ⚠️ **والتدرّجُ صار بمحطّةٍ ثالثة**: القاعُ خلفيّةٌ صافية (فلا
          حدَّ حادّاً فوق الأزرار)، **وعند ٤٠٪ يخفّ إلى ٢٠٪** فتُرى
          الصورةُ خلف الملصق، **والقمّةُ شفّافة.** والنصُّ حيث كان يُقرأ
          يبقى كما كان.

          ⚠️ **و`px-5` لا `px-1`**: الصفُّ صار داخل حاويةٍ ملغيةٍ لحشوة
          التخطيط (`-mx-4`)، **فحشوتُه تُعاد هنا** — ١٦ + ٤ = ٢٠،
          **وهي نفسُها إلى البكسل.** */}
      <div className="relative -mx-4 -mt-6 mb-3">
        <div className="absolute inset-0 overflow-hidden">
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
          <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--background)] via-[color:var(--background)]/20 via-40% to-transparent" />
        </div>

        <div className="relative h-36 sm:h-60">
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

        <div className="relative flex flex-wrap gap-4 -mt-24 sm:-mt-28 px-5">
          <div className="w-32 sm:w-44 shrink-0">
            <div className="relative aspect-[2/3] rounded-poster overflow-hidden ring-1 ring-[color:var(--divider)] bg-surface-2 shadow-[0_18px_44px_rgba(0,0,0,0.55)]">
              {poster && <Image src={poster} alt={title} fill sizes="176px" className="object-cover" />}
            </div>
          </div>

          {/* ===== عمود البيانات — من قمّة الملصق لا من قاعه (طلب المالك) =====
              كان `self-end` يلصق العنوان بأسفل الملصق ويترك المساحة جنبه
              فارغة. الآن العنوان يوازي بداية الملصق، والمساحة تحته تحمل
              البيانات كلّها: السنة والمدّة والتقييم، فالأنواع، فالمنصّة،
              فأزرار السلسلة والعالم — التي كانت تسكن ذيل الصفحة. */}
          <div className="flex-1 min-w-0 self-start pt-0.5">
            {/* 🆕 **وهالةُ العنوان من اللوحة لا من الأسود** (D-405): كانت
              `rgba(0,0,0,0.65)` — **هالةٌ سوداء خلف نصٍّ أسود** في الثيم
              الفاتح، **فتُقرأ لطخةً لا رفعاً.** و`color-mix` تشتقّها من
              `--background` نفسِها: **سوداءُ في الليل وبيضاءُ في النهار
              بلا متغيّرٍ جديد ولا فرعٍ في الشيفرة.** */}
            <h1
              className="text-xl sm:text-3xl font-extrabold leading-tight tracking-tight"
              style={{
                filter:
                  "drop-shadow(0 2px 10px color-mix(in srgb, var(--background) 70%, transparent))",
              }}
            >
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
              <HeroRatings
                imdbId={movie.imdb_id}
                /* 🆕 D-414 — جسرُ الاسم والسنة حين لا يعرف TMDB معرّفَ IMDb */
                name={movie.title}
                year={movie.release_date ? Number(movie.release_date.slice(0, 4)) : null}
                ageLabel={t.ageRating}
              />
            </Suspense>

            {/* 🆕 **ونبضُنا تحت نبض العالم** (D-408): ما يقوله IMDb
                أوّلاً، **وما يقوله أهلُ Loopz بعده مباشرة** — والحجّةُ
                كاملةً في رأس المكوّن. */}
            <TitlePulse hearts={pulse.hearts} votes={pulse.votes} avg={pulse.avg} locale={locale} />

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
          {/* 🔴 🆕 **والشرطُ صار شرطَ ما يُرسم فعلاً** (D-402، لقطةُ أحمد
              بثلاثة خطوطٍ حمراء): كان `belongs_to_collection || universe`
              **يفتح صفّاً كاملاً لفيلمٍ له مجموعة** — **وداخلَه لا يُرسم
              شيءٌ إلا إذا وُلِّدت قائمةُ عالَمه.** **وحاويةٌ فارغةٌ ليست بلا
              كلفة**: `basis-full` تكسر سطراً في `flex-wrap`، **فتأخذ
              `gap-4` الصفِّ (١٦) و`mt-3` نفسِها (١٢) — ٢٨px من فراغٍ لا
              يحمل شيئاً**، وهو الخطُّ الأحمر الأوّل حرفاً.
              **والقاعدة: الشرطُ يسأل عمّا سيُرسم، لا عمّا قد يُرسم**
              (D-217/D-266: أرخصُ عنصرٍ هو الذي لا يُرسم). */}
          {universe && universeListId && (
            <div className="basis-full sm:basis-auto sm:self-center flex flex-wrap sm:flex-col gap-2 mt-3 sm:mt-0 sm:ms-2">
              {/* **زرُّ «احفظ كل الأجزاء كقائمة» حُذف** (D-190، شطبه أحمد
                  بلقطة). كان يُنشئ قائمةً من مجموعة الفيلم بضغطةٍ — فعلٌ
                  نادرٌ يأخذ أوّلَ صفٍّ في الترويسة فوق «أضف إلى قائمة»
                  نفسه، **وزرّان متجاوران يبدأان بـ«أضف/احفظ» يجعلان الأهمَّ
                  يُقرأ ثانياً**. ومجموعةُ الفيلم ما زالت في تبويب «مشابه»
                  (`RelatedTitles`)، فلا شيء صار غير ممكن — صار أطولَ خطوة.
                  وزرُّ الكون (`universe`) باقٍ: مجموعاتُ الأكوان لا يعرضها
                  تبويبٌ آخر. */}
              {/* 🔴 **وهذا البابُ الثاني للفعل نفسِه — فتبع الحكمَ** (D-347):
                  كان ينسخ عالَمَ الفيلم قائمةً جديدةً باسمك، **بينما بطاقتُه
                  في اكتشف وصفحتُه صارتا تحفظانه مرجعاً حيّاً**. **وبابان
                  لفعلٍ واحد بمعنيين مختلفين هو العطل بعينه** (D-068/D-294).
                  ⚠️ **وقبل التوليد لا زرَّ أصلاً**: مجموعةٌ بلا صفٍّ لا
                  تُحفظ — **وزرٌّ لا يكتب شيئاً أسوأ من غيابه** (D-217). */}
              <UniverseSaveRow
                listId={universeListId}
                saved={universeSaved}
                label={t.curatedSaveBtn}
                locale={locale}
              />
            </div>
          )}
        </div>
      </div>

      {/* الإجراء الرئيسي: أضف لقائمة + دائرة «شاهدتُه» — نفس لغة صفحة المسلسل */}
      <div className="mt-4 px-1">
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
              <div className="space-y-5">
                {/* **«أين أشاهده» حُذف من هنا كاملاً** (D-190، طلب أحمد).
                    الشارةُ في الترويسة صارت الجوابَ الوحيد: رموزُ منصّات
                    الطبقة الأولى بلا أسماء، والضغطُ يفتح JustWatch بكلّ
                    التفاصيل. **وثلاثةُ صفوفٍ تقول اشتراك/تأجير/شراء كانت
                    تجيب سؤالاً لم يُسأل** — من يفتح صفحة عملٍ يريد أن يعرف
                    «أقدر أشاهده؟» لا جدولَ أسعارٍ لا نملكه أصلاً (D-150). */}
                {movie.overview && (
                  <section>
                    <SectionTitle icon="info" className="mb-2">
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

                {/* 🆕 ⚖️ **والمرتبطاتُ حلّت محلَّ الطاقم تحت الفيديو**
                    (D-416، طلبُ أحمد: «سمايلر في الأفلام فقط تكون cast،
                    و Related titles يكون في أباوت تحت الفيديو بدل كاست»).

                    **ونقضٌ ثالثٌ لموضع الطاقم يُقال باسمه**: D-080 وضعه
                    في «معلومات»، وD-090 أخرجه تبويباً، **وD-203 أعاده
                    ثالثاً تحت الفيديو** — **واليوم يخرج تبويباً مرّةً
                    ثانية.** **والسببُ الذي أعاده في D-203 كان أن التبويبَ
                    قصُر** («سطرُ قصّةٍ ومقطع»)، **والسببُ الذي يُخرجه
                    اليوم أن «مشابه» صار تبويباً بلا اسمٍ صادق**: يحمل
                    المرتبطاتِ والقوائمَ، **وكلاهما جوابُ «وبعد؟» لا جوابُ
                    «من فيه؟».**

                    **والترتيبُ يبقى ترتيبَ السؤال** (حجّةُ D-203 نفسُها):
                    «عن ماذا؟» ثم «كيف يبدو؟» **ثم «وماذا يشبهه؟»** —
                    **والوجوهُ سؤالٌ قائمٌ بذاته فصار له بابُه.** */}
                <Suspense fallback={null}>
                  <RelatedTitles
                    mediaType="movie"
                    tmdbId={movieId}
                    collectionId={movie.belongs_to_collection?.id ?? null}
                    /* 🆕 D-410 — بصمةُ العمل تُرتّب المرتبطاتِ بلغته */
                    language={movie.original_language}
                    genreIds={movie.genres.map((g) => g.id)}
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
            /* 🆕 **تبويبُ الطاقم — الاسمُ صار صادقاً** (D-416): كان
               «مشابه» يحمل المرتبطاتِ والقوائم، **فحمل اسماً لا يصفه
               وحدَه** — **والآن يحمل الوجوهَ ويُسمّى بها.** */
            key: "cast",
            label: t.castTitle,
            icon: "people",
            content: (
              <Suspense fallback={null}>
                <CastRail mediaType="movie" tmdbId={movieId} locale={locale} />
              </Suspense>
            ),
          },
          {
            /**
             * 🆕 **تبويبُ المجتمع — ثلاثةٌ صارت واحداً** (D-398، طلبُ أحمد
             * بأربع صور: «اجمع الأخبار والنقاش والراوي في مكان واحد
             * وصممه مثل الصورة»).
             *
             * **نقضٌ مزدوجٌ يُقال باسمه:** «الأخبار» (D-300) و«التعليقات»
             * و«المجتمع» (D-191) — **ثلاثةُ تبويباتٍ جوابُها سؤالٌ واحد**:
             * «ما الذي يُقال عن هذا العمل؟». **وصار الجوابُ قائمةً واحدةً
             * مرتّبةً بالزمن، ورقائقُ ترشّحها.** والحجّةُ كاملةً في رأس
             * `TitleCommunityTab`، **وأثرُها هنا أن الشريطَ صار ثلاثةً
             * لا خمسة** — **وخمسُ خاناتٍ على هاتفٍ خمسُ كلماتٍ مقصوصة.**
             *
             * **وخلف `Suspense`**: ستُّ قراءاتٍ في دفعةٍ واحدة، **فلا
             * تؤخّر رسمَ الترويسة ولا الحلقات** (D-071/D-087).
             */
            key: "community",
            label: t.tabCommunity,
            icon: "people",
            content: (
              <Suspense
                fallback={
                  <div className="space-y-4" aria-hidden>
                    <div className="skeleton h-28 rounded-2xl" />
                    <div className="skeleton h-44 rounded-2xl" />
                  </div>
                }
              >
                <TitleCommunityTab
                  tmdbId={movieId}
                  mediaType="movie"
                  title={movie.title}
                  posterPath={movie.poster_path}
                  backdropPath={movie.backdrop_path}
                  locale={locale}
                />
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
