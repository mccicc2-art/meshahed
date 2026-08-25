import Link from "next/link";
import { Fragment, Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import Image from "next/image";
import {
  getUser,
  getFollowState,
  isMovieWatched,
  getMyLists,
  getListsContaining,
  getPublicListsContaining,
  getMyArtFor,
  getTitlePulse,
  getMyFavorites,
  getCuratedListIds,
  getMySavedListIds,
  getProviderLinks,
  artKey,
} from "@/lib/data";
import { getMovie, getTrailer, getWatchProviders, backdropUrl, posterUrl } from "@/lib/tmdb";
import { displayWorkTitle } from "@/lib/wikidata";
import { universeOf } from "@/lib/universes";
import { getT, getWatchRegion } from "@/lib/locale";
import { originAdjectives } from "@/lib/region";
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
import { bestSearchTitle } from "@/lib/providerLinks";
import { TitleActions } from "@/components/TitleActions";
import { TitlePulse } from "@/components/TitlePulse";
import { DetailTopBar } from "@/components/DetailTopBar";
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
  /* العالم فحصٌ محليّ في القاموس — يُحسب قبل الموجة حتى يدخل نداءا
     قائمته **الموجةَ نفسَها** بدل موجةٍ ثانيةٍ متسلسلةٍ بعدها (كانا
     رحلتَي قاعدةٍ إضافيّتين لكلّ فيلمٍ له عالَم). */
  const universe = universeOf(movieId);
  const [userRegion, movie, followState, watched, watchWhere, myLists, inLists, myArt, favs, pulse, curatedMap, mySaved] = await Promise.all([
    /* قراءةُ كوكي البلد كانت `await` منفرداً قبل الموجة — رحلةً لا تلزم
       أحداً قبلها، فدخلت الموجة. */
    getWatchRegion(),
    getMovie(movieId).catch(() => null),
    getFollowState(movieId, "movie"),
    isMovieWatched(movieId),
    getWatchProviders("movie", movieId),
    getMyLists(),
    getListsContaining(movieId, "movie"),
    /* غلافي المختار لهذا العمل (D-131) — قراءةٌ من خريطةٍ مخبّأة لكل طلب */
    getMyArtFor(movieId, "movie"),
    /* مفضّلاتي (D-130) — نداءٌ واحد مخبّأ للطلب، لا سؤالٌ لكل عمل */
    getMyFavorites(),
    /* 🆕 **نبضُ العمل** (D-408) — نداءُ `definer` واحدٌ مفهرسٌ داخل
       الموجة نفسِها لا خلف حاجز: **سطرٌ يظهر متأخّراً يدفع الأنواعَ
       تحته** (D-046)، **والصفحةُ تنتظر TMDB على كل حال** (حجّةُ
       `getTitleCircle` حرفاً). */
    getTitlePulse(movieId, "movie"),
    /* 🆕 **معرّفُ قائمة العالم وحالةُ حفظها** (D-347) — **ولا يقعان إلا
       لفيلمٍ له عالَم** (D-152)، والغيابُ يعني «لم تُولَّد بعد» فلا زرّ
       (D-181). كانا موجةً ثانيةً بعد هذه — فدخلاها. */
    universe
      ? getCuratedListIds().catch(() => new Map<string, string>())
      : Promise.resolve(new Map<string, string>()),
    universe
      ? getMySavedListIds().catch(() => new Set<string>())
      : Promise.resolve(new Set<string>()),
  ]);

  /* 🆕 **روابطُ المنصّات المباشرة** (D-608) — نداءٌ واحدٌ لبلد الجواب
     نفسِه (حجّةُ صفحة المسلسل حرفاً) */
  const providerLinks = watchWhere
    ? await getProviderLinks(movieId, "movie", watchWhere.region)
    : {};

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

  /* 🆕 **نسبةُ العمل** (D-562) — **حسابٌ محليٌّ من الردّ نفسِه**: لا
     نداءَ ولا خدمة، **والحقلان كانا يصلان ولا يُقرآن.** */
  const origins = originAdjectives(
    { origin: movie.origin_country, production: movie.production_countries },
    locale,
  );

  /* غلافي المختار (D-131) يسبق غلاف TMDB — **في صفحتي أنا وحدها**
     (ق٨). النقطة واحدة هنا فلا تتفرّق على البطاقات. */
  const backdrop = backdropUrl(myArt?.backdrop_path ?? movie.backdrop_path);
  const poster = posterUrl(myArt?.poster_path ?? movie.poster_path, "w342");
  /* زرُّ العالم في الترويسة (طلب المالك) — نداءاه جُلبا في موجة الصفحة
     الأولى أعلاه. */
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
            {/* 🆕 **ونبضُنا على سطر الاسم** (D-418، طلبُ أحمد بسهمٍ من
                السطر إلى الفراغ جنب الاسم: «القلب والنجمة في صف اسم
                العمل»): **كان سطراً رابعاً تحت التقييمات**، **والفراغُ
                جنبَ الاسم أوسعُ ما في الترويسة** — **ورقمان صغيران في
                فراغٍ قائمٍ خيرٌ من سطرٍ يُضاف.** */}
            <div className="flex items-start gap-3">
              <h1 className="hero-halo text-22 sm:text-3xl font-bold leading-tight tracking-tight">
                {title}
              </h1>
              <span className="ms-auto shrink-0 -mt-0.5">
                <TitlePulse hearts={pulse.hearts} votes={pulse.votes} avg={pulse.avg} locale={locale} />
              </span>
            </div>
            {/* 🆕 **لونٌ أقوى وهالة** (D-501) — نفسُ حجّة صفحة المسلسل */}
            <div className="hero-halo flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-foreground/85 mt-1">
              {movie.release_date && <span>{movie.release_date.slice(0, 4)}</span>}
              {movie.runtime ? (
                <>
                  <span aria-hidden>·</span>
                  <span>{t.minutesCount(movie.runtime)}</span>
                </>
              ) : null}
              {/* 🆕 **نسبةُ العمل إلى بلده** (D-562، طلبُ أحمد: «أبغاك
                  تكتب أعمال تركية أو أعمال مصرية بحيث الشخص يعرف اللهجة
                  المستخدمة في الفلم»).

                  **ومكانُها سطرُ الهوية لا سطرٌ جديد**: **الجنسيّةُ من
                  رتبةِ السنة والمدّة** — تُقرأ معهما في نظرةٍ واحدة —
                  **وسطرٌ رابعٌ في ترويسةٍ فيها أربعةُ أسطرٍ يدفع القصّةَ
                  خارج الشاشة الأولى** (حجّةُ D-419 و D-501 بحرفها).

                  ⚠️ **والأوّلُ هو اللهجة**: بلدُ المنشأ يتقدّم، **وما
                  بعده شراكةُ إنتاجٍ لا لسان.** */}
              {origins.map((o) => (
                <Fragment key={o}>
                  <span aria-hidden>·</span>
                  <span>{o}</span>
                </Fragment>
              ))}
            </div>

            {/* التقييم سطرٌ مستقلّ تحت البيانات، بشعارَي IMDb وطماطم لا
                بأسمائهما، ومن هذين المصدرين فقط — لا نجمة TMDB (قرار أحمد
                ٨ أغسطس، يُتمّ نقض D-027) */}
            {/* 🆕 **والتصنيفُ العمريُّ يذيّل السطرَ نفسَه** (D-286، طلبُ
                أحمد: «التصنيف العمري حطها في كل صفحات المسلسلات والأفلام»).
                **ولا نداءَ ثالثاً له** — يصل في ردّ OMDb نفسِه. */}
            <div className="hero-halo">
            <Suspense fallback={<HeroRatingsSkeleton />}>
              <HeroRatings
                imdbId={movie.imdb_id}
                /* 🆕 D-414 — جسرُ الاسم والسنة حين لا يعرف TMDB معرّفَ IMDb */
                name={movie.title}
                year={movie.release_date ? Number(movie.release_date.slice(0, 4)) : null}
                /* 🆕 D-430 — والجسرُ الثالث: صيغُ الاسم من TMDB نفسِها */
                movieId={movieId}
                ageLabel={t.ageRating}
              />
            </Suspense>
            </div>


            {/* ⚖️ 🆕 **وسطرُ الدائرة حُذف** (D-419، شطبَه أحمد بخطٍّ على
                اللقطة): «٤ ممن تتابعهم شاهدوه · ويقيّمونه ٩٫٨» —
                **جملةٌ من سطرين تحت أربعة أسطرٍ من الأرقام**، **وقد صار
                فوقها نبضُنا يقول العددَ والمتوسّطَ في ستّة رموز**
                (D-408). **وحقيقةٌ تُقال مرّتين بصيغتين تُقرأ زحاماً**
                (D-222). **والنصُّ باقٍ في خطّ النشاط حيث لكلِّ صاحبٍ
                اسمُه** — **ولم يُحذف المعنى، حُذف تكرارُه.** */}

            {/* الأنواع صعدت من تبويب «معلومات» إلى جنب الملصق (طلب المالك):
                هوية الفيلم تُقرأ قبل قصّته لا بعدها */}
            {/* 🆕 ⚖️ **سطرٌ واحدٌ للأنواع والقنواتُ في طرفِه** (D-501) —
                **نفسُ الصفِّ في صفحة المسلسل حرفاً بحرف**: الأنواعُ في
                صندوقٍ يُقصّ، والقنواتُ `shrink-0` لا تُقصّ. (قاعدة ٦:
                صفحتا العمل ترويسةٌ واحدةٌ بمحتويين لا ترويستان.) */}
            {(movie.genres.length > 0 || watchWhere) && (
              <div className="mt-1.5 flex items-center gap-2">
                {movie.genres.length > 0 && (
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
                    {movie.genres.slice(0, 3).map((g) => (
                      <span
                        key={g.id}
                        className="shrink-0 whitespace-nowrap text-[10px] leading-none font-medium bg-surface-2 border border-border px-2 py-1 rounded-full"
                      >
                        {g.name}
                      </span>
                    ))}
                  </div>
                )}
                {/* أين يُبثّ — في الترويسة، وقسم المنصّات في «معلومات» حُذف */}
                {watchWhere && (
                  <div className={movie.genres.length > 0 ? "shrink-0" : "shrink-0 ms-auto"}>
                    <WatchChip
                      options={watchWhere.options}
                      region={watchWhere.region}
                      userRegion={userRegion}
                      locale={locale}
                      links={providerLinks}
                      query={{
                        q: `${bestSearchTitle(movie.original_title, movie.title)} ${(movie.release_date ?? "").slice(0, 4)}`.trim(),
                        qAr: /[؀-ۿ]/.test(movie.title) ? movie.title : null,
                      }}
                      tmdbId={movieId}
                      mediaType="movie"
                    />
                  </div>
                )}
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
