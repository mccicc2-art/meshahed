import Link from "next/link";
import { HeroRatings, HeroRatingsSkeleton } from "@/components/HeroRatings";
import { Fragment, Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import Image from "next/image";
import {
  getUser,
  getFollowState,
  getWatchedForShow,
  getEpisodeRatings,
  getMyLists,
  getListsContaining,
  getMyArtFor,
  getTitlePulse,
  getMyFavorites,
  artKey,
} from "@/lib/data";
import {
  getTv,
  getTrailer,
  getWatchProviders,
  isAnime,
  backdropUrl,
  posterUrl,
} from "@/lib/tmdb";
import { animeExtras } from "@/lib/anilist";
import { displayWorkTitle } from "@/lib/wikidata";
import { EpisodeTracker, type SeasonSummary } from "@/components/EpisodeTracker";
import { getT, getWatchRegion } from "@/lib/locale";
import { originAdjectives } from "@/lib/region";
import { DetailTabs } from "@/components/DetailTabs";
import { TitleCommunityTab } from "@/components/TitleCommunityTab";
import { RelatedTitles } from "@/components/RelatedTitles";
import { CastRail } from "@/components/CastRail";
import { Icon, SectionTitle } from "@/components/Icon";
import { Trailer } from "@/components/Trailer";
import { WatchChip } from "@/components/WatchChip";
import { TitleActions } from "@/components/TitleActions";
import { TitlePulse } from "@/components/TitlePulse";
import { DetailTopBar } from "@/components/DetailTopBar";
import { ReadMore } from "@/components/ReadMore";
import { formatDate } from "@/lib/when";
import { ShowStatsSync } from "@/components/ShowStatsSync";
import { airedEpisodeCount, airedPerSeason } from "@/lib/progress";
import { episodeKey } from "@/lib/keys";
import { buttonClass } from "@/components/ui/Button";

export default async function ShowPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();
  const { id } = await params;
  const tvId = Number(id);
  if (!Number.isFinite(tvId)) notFound();

  // بيانات أول رسمة فقط في الموجة الحاسمة — الترايلر والتعليقات تُبثّ
  // لاحقاً عبر Suspense فلا تؤخّر ترويسة الصفحة وتبويب الحلقات
  const [userRegion, tv, followState, watched, watchWhere, myLists, inLists, epRatings, myArt, favs, pulse] =
    await Promise.all([
    /* قراءةُ كوكي البلد كانت `await` منفرداً قبل الموجة — رحلةً لا يعتمد
       عليها أحدٌ فيها، فدخلتها. */
    getWatchRegion(),
    getTv(tvId).catch(() => null),
    getFollowState(tvId, "tv"),
    getWatchedForShow(tvId),
    getWatchProviders("tv", tvId),
    getMyLists(),
    getListsContaining(tvId, "tv"),
    /* نشاط دائرتك (D-127) — نداء definer واحد داخل الموجة نفسها لا خلف
       Suspense: كلفتُه استعلامٌ محليّ (~50ms من الرياض) والصفحة تنتظر
       TMDB على كل حال، فحاجزُ تعليقٍ ثانٍ يشتري وميضاً لا سرعة */
    /* تقييماتي للحلقات (D-139) — في الموجة نفسها لا خلف حاجز: نداء
       definer واحد على فهرسٍ يخدمه المفتاح الأوّليّ، والصفحة تنتظر TMDB
       على كل حال */
    getEpisodeRatings(tvId),
    /* غلافي المختار لهذا العمل (D-131) — قراءةٌ من خريطةٍ مخبّأة لكل طلب */
    getMyArtFor(tvId, "tv"),
    /* مفضّلاتي (D-130) — نداءٌ واحد مخبّأ للطلب، لا سؤالٌ لكل عمل */
    getMyFavorites(),
    /* 🆕 **نبضُ العمل** (D-408) — انظر تعليقَ صفحة الفيلم */
    getTitlePulse(tvId, "tv"),
  ]);
  const following = followState.following;

  if (!tv) {
    return (
      <div className="text-center py-24">
        <p className="text-muted mb-4">{t.showLoadFailed}</p>
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

  /* العنوان بالعربية إن لم تترجمه TMDB (D-176) — ويكي‑بيانات، بنفس شرطَي
     `displayPersonName`: واجهةٌ عربية وعنوانٌ ليس عربياً أصلاً، فصفرُ طلباتٍ
     في الحالة الغالبة. وبعد حارس `!tv` لا قبله: لا يُسأل عن عملٍ لم يُجلب.
     والفشل صامتٌ فيبقى عنوان TMDB. */
  const title = await displayWorkTitle(tvId, "tv", tv.name, locale);

  /* 🆕 **نسبةُ العمل** (D-562) — **الصفحتان بصفٍّ واحدٍ لا صفَّين**
     (القاعدة ٦): نفسُ الدالّة ونفسُ الموضع ونفسُ السقف. */
  const origins = originAdjectives(
    { origin: tv.origin_country, production: tv.production_countries },
    locale,
  );

  // كانت الصفحة تجلب حلقات كل المواسم دفعة واحدة — مسلسل بثلاثين موسماً يعني
  // ثلاثين طلب TMDB وآلاف الحلقات تُرسل للمتصفح. الآن: رؤوس المواسم فقط،
  // وحلقات موسم واحد (الذي فيه أول حلقة غير مشاهَدة)، والباقي عند الفتح.
  const airedBySeason = airedPerSeason(tv);
  const summaries: SeasonSummary[] = tv.seasons
    .filter((s) => s.season_number >= 1 && s.episode_count > 0)
    .sort((a, b) => a.season_number - b.season_number)
    .map((s) => ({
      season_number: s.season_number,
      name: s.name,
      episode_count: s.episode_count,
      aired_count: airedBySeason.get(s.season_number) ?? 0,
    }));

  // الموسم المفتوح افتراضياً: أول موسم فيه حلقة معروضة لم تُشاهد بعد
  let openSeason = summaries[0]?.season_number ?? null;
  for (const s of summaries) {
    let firstUnwatched = 0;
    for (let e = 1; e <= s.aired_count; e++) {
      if (!watched.has(episodeKey(s.season_number, e))) {
        firstUnwatched = e;
        break;
      }
    }
    if (firstUnwatched) {
      openSeason = s.season_number;
      break;
    }
  }

  // لا انتظار لحلقات الموسم هنا: كانت رحلة TMDB تسلسلية ثانية تؤخّر أول
  // بايت من أسخن صفحة (~150–400ms عند فوات الكاش). المتتبّع يحمّلها بنفسه
  // عبر /api/season ويعرض هيكلاً في أثنائها — الترويسة والتبويبات ترسم فوراً

  // نفس الرقم الذي تستخدمه الرئيسية والمكتبة، فلا تختلف النسبة بين الشاشات
  const airedExact = airedEpisodeCount(tv);

  /* غلافي المختار (D-131) يسبق غلاف TMDB — **في صفحتي أنا وحدها**
     (ق٨). النقطة واحدة هنا فلا تتفرّق على البطاقات. */
  const backdrop = backdropUrl(myArt?.backdrop_path ?? tv.backdrop_path);
  const poster = posterUrl(myArt?.poster_path ?? tv.poster_path, "w342");
  const next = tv.next_episode_to_air;

  return (
    <div>
      {following && (
        <ShowStatsSync
          stats={[
            {
              tmdbId: tvId,
              total: tv.number_of_episodes ?? airedExact,
              aired: airedExact,
              nextAirDate: next?.air_date ?? null,
            },
          ]}
        />
      )}

      {/* الترويسة مختصرة: القصة والترايلر والمنصّات والآراء في تبويبات،
          فلا يمرّ من يريد الحلقات على أربعة أقسام قبلها */}
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
            tmdbId={tvId}
            mediaType="tv"
            posterPath={tv.poster_path}
            initialDropped={followState.dropped}
            art={myArt}
          />
        </div>

        <div className="relative flex gap-4 -mt-24 sm:-mt-28 px-5">
          {/* 🆕 **والملصقُ كبر درجةً** (D-501، طلبُ أحمد: «البوستر كبّره
              شوي»): ١١٢ → ١٢٨ على الجوّال و١٦٠ → ١٧٦ على الواسع —
              **والارتفاعُ يتبعه بنسبة ٢:٣ فيقضم من فراغ الترويسة لا من
              سطرٍ فيها**، والأسطرُ إلى جانبه لم تتغيّر. */}
          <div className="w-32 sm:w-44 shrink-0">
            <div className="relative aspect-[2/3] rounded-poster overflow-hidden ring-1 ring-[color:var(--divider)] bg-surface-2 shadow-[0_18px_44px_rgba(0,0,0,0.55)]">
              {poster && <Image src={poster} alt={title} fill sizes="(max-width: 640px) 128px, 176px" className="object-cover" />}
            </div>
          </div>

          {/* العنوان من قمّة الملصق لا من قاعه — نفس نقلة صفحة الفيلم
              (طلب المالك)، والأنواع صعدت إلى المساحة تحته */}
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
            {/* 🆕 **ولونُ السطر `foreground/85` لا `muted`** (D-501): هذا
                السطرُ يقف على اللوحة لا على خلفيّة الصفحة — **و`muted`
                مصمَّمٌ لنصٍّ ثانويٍّ على سطحٍ هادئ**، فيذوب فوق صورةٍ
                ملوّنة. **والهالةُ معه لا بدلَه**: اللونُ يرفع والظلُّ
                يفصل. */}
            <div className="hero-halo flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-foreground/85 mt-1.5">
              {/* وسم الأنمي: يعرفه المستخدم من الشارة لا من قراءة الأنواع */}
              {isAnime(tv) && (
                <span className="inline-flex items-center gap-1 text-12 font-bold text-accent bg-accent/12 border border-accent/35 px-2 py-0.5 rounded-full">
                  <Icon name="sparkle-star" size={12} />
                  {t.animeBadge}
                </span>
              )}
              {tv.first_air_date && <span>{tv.first_air_date.slice(0, 4)}</span>}
              <span aria-hidden>·</span>
              <span>{t.seasonsCount(tv.number_of_seasons)}</span>
              {/* 🆕 **نسبةُ العمل** (D-562، طلبُ أحمد: «بحيث الشخص يعرف
                  اللهجة المستخدمة») — **في سطر الهوية لا في سطرٍ رابع**،
                  **والأوّلُ هو اللهجة** وما بعده شراكةُ إنتاج. */}
              {origins.map((o) => (
                <Fragment key={o}>
                  <span aria-hidden>·</span>
                  <span>{o}</span>
                </Fragment>
              ))}
            </div>

            {/* المصدر والاستوديو من AniList (D-173) — لِما ثبت أنه أنمي وحده،
                وخلف Suspense خاصّته: السلسلة نداءان إلى خدمتين لا نملكهما،
                فلا تُرهن بهما ترويسةُ الصفحة (D-071). وغيابُهما لا يترك فراغاً
                محجوزاً — السطر إمّا يُرسم كاملاً أو لا يوجد أصلاً. */}
            {isAnime(tv) && (
              <div className="hero-halo">
                <Suspense fallback={null}>
                  <AnimeFacts tmdbId={tvId} t={t} />
                </Suspense>
              </div>
            )}

            {/* التقييم سطرٌ مستقلّ تحت البيانات، بشعارَي IMDb وطماطم لا
                بأسمائهما، ومن هذين المصدرين فقط — لا نجمة TMDB (قرار أحمد
                ٨ أغسطس، يُتمّ نقض D-027) */}
            {/* 🆕 **والتصنيفُ العمريُّ يذيّل السطرَ نفسَه** (D-286، طلبُ
                أحمد: «التصنيف العمري حطها في كل صفحات المسلسلات والأفلام»).
                **ولا نداءَ ثالثاً له** — يصل في ردّ OMDb نفسِه. */}
            <div className="hero-halo">
            <Suspense fallback={<HeroRatingsSkeleton />}>
              <HeroRatings
                tvId={tvId}
                /* 🆕 D-414 — جسرُ الاسم والسنة حين لا يعرف TMDB معرّفَ IMDb */
                name={tv.name}
                year={tv.first_air_date ? Number(tv.first_air_date.slice(0, 4)) : null}
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

            {/* الأنواع صعدت من «معلومات» إلى جنب الملصق — كصفحة الفيلم */}
            {/* 🆕 ⚖️ **والأنواعُ سطرٌ واحدٌ لا يلتفّ، والقنواتُ في طرفِه**
                (D-501، طلبُ أحمد بدائرتين على اللقطة: «نص الجينر فقط
                يكون سطر واحد وممنوع ينزل ويبدأ سطر ثاني، صغّر النص ·
                رموز القنوات خلّها في نفس صف التصنيف»).

                **والالتفافُ كان يكلّف سطراً كاملاً لكلمةٍ واحدة**
                («Animation» وحدَها في سطرٍ ثانٍ) — **وسطرٌ لكلمةٍ في
                ترويسةٍ مزدحمةٍ أغلى من نوعٍ لا يُقرأ.**

                🔑 **وحارسان يجعلان «سطراً واحداً» صحيحاً لا أمنية**:
                الأنواعُ في صندوقٍ `min-w-0 overflow-hidden` **فتُقصّ هي
                عند الضيق**، **والقنواتُ `shrink-0` خارجَه فلا تُقصّ
                أبداً** — **والأولويّةُ لما يقول أين تُشاهِد، لا لما يقول
                إنه كوميديا.** */}
            {(tv.genres.length > 0 || watchWhere) && (
              <div className="mt-2 flex items-center gap-2">
                {tv.genres.length > 0 && (
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
                    {tv.genres.slice(0, 4).map((g) => (
                      <span
                        key={g.id}
                        className="shrink-0 whitespace-nowrap text-[10px] leading-none font-medium bg-surface-2 border border-border px-2 py-1 rounded-full"
                      >
                        {g.name}
                      </span>
                    ))}
                  </div>
                )}
                {/* أين يُبثّ — هنا في الترويسة، وقسم المنصّات في «معلومات» حُذف */}
                {watchWhere && (
                  <div className={tv.genres.length > 0 ? "shrink-0" : "shrink-0 ms-auto"}>
                    <WatchChip
                      options={watchWhere.options}
                      region={watchWhere.region}
                      userRegion={userRegion}
                      locale={locale}
                    />
                  </div>
                )}
              </div>
            )}

            {next?.air_date && (
              <div className="mt-2">
                <span className="inline-block text-12 text-accent-2 bg-accent-2/10 border border-accent-2/30 px-2.5 py-1 rounded-lg">
                  {t.nextEpisodeOn(formatDate(next.air_date, t))}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* الإجراء الرئيسي: أضف لقائمة + دائرة «شاهدتُه كله» — زرّ المتابعة
          الكبير حُذف، فالمتابعة صارت أول صفٍّ داخل ورقة القوائم */}
      <div className="mt-4 px-1">
        <TitleActions
          tmdbId={tvId}
          mediaType="tv"
          title={tv.name}
          posterPath={tv.poster_path}
          /* 🆕 D-313 — غلافُ TMDB لا غلافي المختار (حجّةُ D-131) */
          backdropPath={tv.backdrop_path}
          locale={locale}
          initialFollowing={following}
          lists={myLists.map((l) => ({ id: l.id, name: l.name }))}
          containing={inLists}
          episodesTotal={airedExact}
          runtime={null}
          initialDone={airedExact > 0 && watched.size >= airedExact}
          initialFavorite={favs.has(artKey("tv", tvId))}
        />
      </div>

      <DetailTabs
        tabs={[
          {
            key: "episodes",
            label: t.tabEpisodes,
            icon: "list",
            content: (
              /* التقييم صار في تبويب التعليقات والقوائم في زرّ الترويسة —
                 لا شيء يتكرّر مرتين. المتتبّع يعتمد لقطة الخادم داخلياً
                 بلا key: إعادة التركيب كانت تُغلق الموسم المفتوح. */
              <EpisodeTracker
                showTmdbId={tvId}
                summaries={summaries}
                initialSeason={openSeason}
                airedTotal={airedExact}
                defaultRuntime={tv.episode_run_time?.[0] ?? null}
                initialWatched={[...watched]}
                initialEpisodeRatings={[...epRatings.values()]}
                locale={locale}
              />
            ),
          },
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
                {tv.overview && (
                  <section>
                    <SectionTitle icon="info" className="mb-2">
                      {t.storyTitle}
                    </SectionTitle>
                    <ReadMore text={tv.overview} locale={locale} />
                  </section>
                )}

                {/* الأنواع صعدت إلى الترويسة جنب الملصق — بقي عدّ الحلقات */}
                {tv.number_of_episodes > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-muted bg-surface-2 border border-border px-3 py-1.5 rounded-full tabular-nums">
                      {t.episodesCount(tv.number_of_episodes)}
                    </span>
                  </div>
                )}

                <Suspense
                  fallback={<div className="skeleton aspect-video rounded-2xl" aria-hidden />}
                >
                  <TrailerSection tvId={tvId} name={title} backdrop={backdrop} locale={locale} />
                </Suspense>

                {/* **الطاقمُ عاد إلى «عن العمل» — ثالثاً لا أوّلاً** (D-203،
                    طلب أحمد: «الأوّل القصة بعده الفيديو بعده كاست»).
                    **والترتيبُ ترتيبُ السؤال:** «عن ماذا؟» ثم «كيف يبدو؟»
                    ثم «من فيه؟». وتفصيلُ النقض في نظيره في صفحة الفيلم —
                    **والصفحتان تتحرّكان معاً دائماً** (تنبيهُ أحمد يومَ
                    تحرّكت إحداهما وحدها). */}
                <Suspense fallback={null}>
                  <CastRail mediaType="tv" tmdbId={tvId} locale={locale} />
                </Suspense>
              </div>
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
                  tmdbId={tvId}
                  mediaType="tv"
                  title={tv.name}
                  posterPath={tv.poster_path}
                  backdropPath={tv.backdrop_path}
                  locale={locale}
                />
              </Suspense>
            ),
          },
        ]}
      />

      {/* الأعمال المرتبطة خارج التبويبات — كصفحة الفيلم. ولا «أجزاء»
          للمسلسلات: `belongs_to_collection` حقلُ أفلامٍ عند TMDB وحدها */}
      {/* **والمسافةُ من هنا لا من داخله** (D-402) — انظر رأسَ المكوّن */}
      <div className="mt-6">
        <Suspense fallback={null}>
          <RelatedTitles
            mediaType="tv"
            tmdbId={tvId}
            /* 🆕 D-410 — بصمةُ العمل تُرتّب المرتبطاتِ بلغته */
            language={tv.original_language}
            genreIds={tv.genres.map((g) => g.id)}
            locale={locale}
          />
        </Suspense>
      </div>
    </div>
  );
}

/** الترايلر يُبثّ بعد أول رسمة — طلبا TMDB المتسلسلان له لا يؤخّران الصفحة */
async function TrailerSection({
  tvId,
  name,
  backdrop,
  locale,
}: {
  tvId: number;
  name: string;
  backdrop: string | null;
  locale: Awaited<ReturnType<typeof getT>>["locale"];
}) {
  const trailer = await getTrailer("tv", tvId);
  if (!trailer) return null;
  return <Trailer videoKey={trailer.key} title={name} thumbnail={backdrop} locale={locale} />;
}

/**
 * سطرُ «عن مانغا · استوديو MAPPA» — أو لا شيء (D-173).
 *
 * مكوّن خادمٍ صغير لأن `animeExtras` تنادي خدمتين خارجيتين، ووضعُه خلف
 * `Suspense` يُخرجهما من المسار الحرج للترويسة.
 */
async function AnimeFacts({
  tmdbId,
  t,
}: {
  tmdbId: number;
  t: Awaited<ReturnType<typeof getT>>["t"];
}) {
  const extras = await animeExtras(tmdbId, "tv");
  if (!extras) return null;
  const parts = [
    extras.source ? t.animeSourceLabel(extras.source) : "",
    extras.studio ? t.animeStudioLabel(extras.studio) : "",
  ].filter(Boolean);
  if (parts.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-muted mt-1">
      {parts.map((p, i) => (
        <span key={p} className="inline-flex items-center gap-2">
          {i > 0 && <span aria-hidden>·</span>}
          <span>{p}</span>
        </span>
      ))}
    </div>
  );
}
