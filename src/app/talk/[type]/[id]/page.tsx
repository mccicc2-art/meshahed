import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getUser,
  getMyArtFor,
  getMyProfileLite,
  getCommunityRating,
  getTitleThread,
  getPostLikes,
  getPostVotes,
  getFollowState,
  isMovieWatched,
} from "@/lib/data";
import { getMovie, getTv, posterUrl, backdropUrl } from "@/lib/tmdb";
import { displayWorkTitle } from "@/lib/wikidata";
import { getT, getTranslateEnabled } from "@/lib/locale";
import { bulletinLine } from "@/lib/bulletinLine";
import { TitleHero } from "@/components/TitleHero";
import { ExpandableText } from "@/components/ExpandableText";
import { getBatchTranslations } from "@/lib/translate";
import { HeroRatings, HeroRatingsSkeleton } from "@/components/HeroRatings";
import { ThreadReplies } from "@/components/thread/ThreadReplies";
import { Icon } from "@/components/Icon";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

/**
 * **عنوانٌ ووصفٌ لصفحةٍ تُقرأ بلا حساب** (D-221).
 *
 * **والوصفُ من الكلام نفسِه لا من قالبٍ عامّ** — أوّلُ مشاركةٍ في الغرفة،
 * **فما يراه الباحثُ هو ما سيجده**. وإن كانت الغرفةُ خاليةً فسطرٌ صادق.
 *
 * ⚠️ **ولا يُنادى TMDB مرّتين:** `getMovie`/`getTv` تمرّان على ذاكرة
 * الطلب نفسِها التي تقرؤها الصفحة، **فالنداءُ واحدٌ للاثنين.**
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}): Promise<Metadata> {
  const { type, id } = await params;
  if (type !== "tv" && type !== "movie") return {};
  const tmdbId = Number(id);
  if (!Number.isFinite(tmdbId)) return {};

  const { locale, t } = await getT();
  const [details, thread] = await Promise.all([
    (type === "tv" ? getTv(tmdbId) : getMovie(tmdbId)).catch(() => null),
    getTitleThread(tmdbId, type).catch(() => []),
  ]);
  const raw = details
    ? type === "tv"
      ? (details as { name: string }).name
      : (details as { title: string }).title
    : "";
  if (!raw) return {};
  const name = await displayWorkTitle(tmdbId, type, raw, locale);

  const said = thread[0]?.body?.trim() ?? "";
  const title = t.talkRoomTitle(name, type === "tv");
  /* **وأوّلُ سطرٍ قد يكون نشرةَ Loopz** (D-261) — **وهي بلا متن**، فكان
     الوصفُ يسقط إلى «لا مشاركات» وفي الغرفة نشرة. الجملةُ تُركَّب هنا
     بنفس الدالّة التي يرسمها الخيط (`bulletinLine`).
     ⚠️ **ولا حرقَ في وصف المستند أبداً**: هذا النصُّ يذهب إلى محرّكات
     البحث وبطاقةِ المشاركة، **وحاجبٌ يُكشف في معاينةِ رابطٍ ليس حاجباً.** */
  const firstLine = said || bulletinLine(thread[0]?.kind ?? null, thread[0]?.data ?? null, t, locale);
  const description = firstLine ? firstLine.slice(0, 155) : t.talkMetaEmpty(name);

  return {
    title,
    description,
    openGraph: { title, description, type: "article" },
    twitter: { card: "summary", title, description },
  };
}

/**
 * **غرفةُ النقاش — نقاشٌ خالصٌ لا آراء** (D-257).
 *
 * ================= قرارا أحمد اللذان تنفّذهما هذه الصفحة =================
 *
 * **(١) «النقاش ليس الريفيو، يختلف».** كانت هذه الصفحةُ تعرض `TalkThread`
 * — **آراءَ العمل نفسَها** التي تعرضها صفحةُ العمل وصفحاتُ `/review`،
 * وتسمّي نفسَها نقاشاً. **وثلاثةُ أسطحٍ تعرض نفسَ الصفوف ليست ثلاثَ
 * ميزات، هي ميزةٌ واحدةٌ ضائعة.**
 *
 * **(٢) «تخرج — `/talk` تصير نقاشاً خالصاً»** (جوابُه حرفاً على سؤالي).
 * **فالآراءُ خرجت من هنا** إلى بيوتها الثلاثة: خطُّ النشاط، وتبويبُ
 * الآراء في صفحة العمل، وصفحةُ `/review` لكلِّ رأيٍ بعينه. **ولم يُحذف
 * منها شيء، نُقل موضعُ قراءتها.**
 *
 * ================= وما بقي من الترويسة ولماذا =================
 *
 * `TitleHero` بغلافه وملصقه **وتقييم المجتمع**. **والتقييمُ ليس رأياً
 * ولم يخرج:** هو **حقيقةٌ عن العمل** كسنة الإصدار — ومن يدخل غرفةً
 * ليتكلّم عن عملٍ يريد أن يعرف كيف استقبله الناس **قبل أن يكتب**.
 * **وشاراتُ حالتك** («شاهدته» · «في مكتبتك») تبقى للسبب نفسِه.
 *
 * ⚠️ **وزرُّ «رأيك» (`TalkCompose`) خرج**: هو بابُ التقييم والمراجعة،
 * **وبابٌ إلى فعلٍ لم يعد لهذه الصفحة صلةٌ به** يعِد بما لا تعرضه.
 * **ومن أراد أن يقيّم يجده في صفحة العمل** — وسهمُ الترويسة يوصله بلمسة.
 *
 * ⚠️ `type` في المسار هو `tv` أو `movie` — **مفرداتُ TMDB لا مفرداتُ
 * الروابط** (`‎/show/…` · `‎/movie/…`)، لأن مفتاحَ القاعدة `media_type`.
 * **وغيرُهما `notFound` لا افتراضٌ صامت.**
 */
export default async function TalkPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  /* **وتُقرأ بلا حساب** (D-221): القراءةُ للجميع والكتابةُ للمسجَّلين،
     **والحراسةُ في القاعدة لا هنا** — `title_thread` تشترط `auth.uid()`
     وتستثني المحظور، فالزائرُ يرى الترويسةَ ودعوةَ الدخول. */
  const user = await getUser();
  const signedIn = !!user;

  const { locale, t } = await getT();
  const { type, id } = await params;
  if (type !== "tv" && type !== "movie") notFound();
  const mediaType = type as "tv" | "movie";
  const tmdbId = Number(id);
  if (!Number.isFinite(tmdbId)) notFound();

  /* الستّةُ معاً: لا شيء منها يعتمد على الآخر، **والتسلسلُ كان يضيف
     رحلاتٍ إلى صفحةٍ محتواها سطورُ نصّ.** */
  const [details, thread, community, myArt, me, follow, watchedIt] = await Promise.all([
    (mediaType === "tv" ? getTv(tmdbId) : getMovie(tmdbId)).catch(() => null),
    getTitleThread(tmdbId, mediaType),
    getCommunityRating(tmdbId, mediaType),
    /* **غلافُك أنت** (D-216): الغلافُ الذي اخترتَه للعمل في صفحته هو
       غلافُه هنا — **صورتان مختلفتان لعملٍ واحد تُقرآن عملين.** */
    getMyArtFor(tmdbId, mediaType).catch(() => null),
    user ? getMyProfileLite() : Promise.resolve(null),
    getFollowState(tmdbId, mediaType).catch(() => ({ following: false, dropped: false })),
    /* ⚠️ **و«شاهدته» للأفلام وحدها**: المسلسلُ يُشاهَد حلقةً حلقة، **ولا
       صفَّ واحداً يقول «شاهدتُه»** — فادّعاؤه للمسلسلات كان سيكذب. */
    mediaType === "movie" ? isMovieWatched(tmdbId).catch(() => false) : Promise.resolve(false),
  ]);

  /* 🆕 **وإعجاباتُ المشاركات بعد الخيط لا معه** (D-289): **مفاتيحُها هي
     معرّفاتُ الخيط نفسِه**، فلا تُنادى قبل أن يصل. **ونداءٌ واحدٌ
     للغرفة كلِّها** (D-164/D-205)، **وسقوطُه صامتٌ فيُرسم الزرُّ
     بصفر.** */
  const [postLikes, postVotes] = await Promise.all([
    getPostLikes(thread.map((p) => p.postId)).catch(() => ({
      counts: {} as Record<string, number>,
      mine: [] as string[],
    })),
    /* 🆕 **والأصواتُ معها** (D-305، الهجرة ٩٤) — نفسُ المفاتيح فنفسُ
       اللحظة، **والسقوطُ صامتٌ بصفر** (D-179). */
    getPostVotes(thread.map((p) => p.postId)),
  ]);

  /* 🆕 **ترجمةُ كلام الأعضاء بلغة القارئ** (D-307) — **النشراتُ ثنائيّةُ
     اللغة أصلاً** (`name_ar`/`name_en`) فلا تدخل، **والمفتاحُ غائبٌ؟
     خريطةٌ فارغةٌ والأصلُ وحدَه** (D-077). */
  const translations = (await getTranslateEnabled())
    ? await getBatchTranslations(
    thread.filter((p) => !p.kind && p.body?.trim()).map((p) => ({ id: p.postId, text: p.body })),
        locale === "ar" ? "ar" : "en",
      )
    : {};



  /* TMDB ساقطٌ أو المعرّف خاطئ؟ **الكلامُ يبقى** — العنوانُ مخزَّنٌ مع
     كل مشاركة (نمطُ D-048)، فالصفحة تُرسم من القاعدة وحدها. و`notFound`
     هنا كان سيُخفي حواراً قائماً لأن مصدراً خارجياً تعذّر. */
  const rawTitle = details
    ? mediaType === "tv"
      ? (details as { name: string }).name
      : (details as { title: string }).title
    : "";
  const title = rawTitle
    ? await displayWorkTitle(tmdbId, mediaType, rawTitle, locale)
    : t.talkFallbackTitle;

  const posterPath = (details as { poster_path?: string | null } | null)?.poster_path ?? null;
  const backdropPath = (details as { backdrop_path?: string | null } | null)?.backdrop_path ?? null;
  const poster = posterUrl(myArt?.poster_path ?? posterPath, "w185");
  const backdrop = backdropUrl(myArt?.backdrop_path ?? backdropPath, "w780");
  const href = `/${mediaType === "tv" ? "show" : "movie"}/${tmdbId}`;
  /* **النبذةُ من TMDB مباشرةً** — `details` مقروءةٌ أصلاً لهذه الصفحة،
     **فلا نداءَ جديد** (D-198). و`?.trim()` لأن TMDB تُرجع نصّاً فارغاً
     لا `null` حين لا تملك ترجمة. */
  const overview = ((details as { overview?: string | null } | null)?.overview ?? "").trim();
  const avg = Math.round(community.avg * 10) / 10;

  return (
    <main className="pb-24">
      <TitleHero
        backdrop={backdrop}
        poster={poster}
        title={title}
        sub={t.talkRoomTitle(title, mediaType === "tv")}
        href={href}
        mediaType={mediaType}
        avg={avg}
        count={community.count}
        ratingLabel={t.communityRating}
        locale={locale}
        /* 🆕 **تقييمُ IMDb والتصنيفُ العمريّ تحت الاسم** (D-286، طلبُ
           أحمد). **خلف `Suspense`** لأن OMDb رحلةُ شبكةٍ خارجية —
           **والترويسةُ تُرسم فوراً والسطرُ يلحق** (D-071)، **وهيكلُه
           بارتفاع السطر فلا تقفز الكتلة** (D-046).
           **والمعرّفُ يأتي مع تفاصيل الفيلم، ويُحلُّ للمسلسل داخل
           المكوّن** — وهو تقسيمُ `HeroRatings` القائم، لا شرطٌ جديد. */
        meta={
          <Suspense fallback={<HeroRatingsSkeleton compact />}>
            <HeroRatings
              compact
              ageLabel={t.ageRating}
              imdbId={(details as { imdb_id?: string | null } | null)?.imdb_id ?? null}
              tvId={mediaType === "tv" ? tmdbId : undefined}
            />
          </Suspense>
        }
        /* 🆕 **ووصفُ الغرفة صعد إلى الغلاف** (D-286، طلبُ أحمد: «اكتب
           العنوان في المساحة في الغلاف»). **النصُّ هو نفسُه حرفاً** —
           وهو ما يجعل من ضغط بطاقةً يجد عنوانَها فوق الغرفة (D-257) —
           **وإنما تركَ متنَ الصفحة للنبذة ثم للكلام.** */
        /* ⚖️ 🆕 **وسهمُ «افتح صفحة العمل» حُذف** (D-297، نصُّ أحمد:
           «السهم اللي فوق يمين احذفه، لأن اللي يبغى بيانات المسلسل يضغط
           على صورته»). **وحجّتُه صحيحةٌ وحرفيّة: الملصقُ والاسمُ رابطٌ
           واحدٌ إلى الوجهة نفسِها منذ أوّل يوم** — **فكان بابين إلى غرفةٍ
           واحدة** (D-266: أرخصُ عنصرٍ هو الذي لا يُرسم).
           ⚠️ **ولم يسقط `end` من `TitleHero`**: صفحةُ `/review` تضع فيه
           **علامةَ تعليقٍ تفتح النقاش** — **وجهةٌ أخرى لا نسخةٌ من
           الملصق** — **والمعاملُ يُحذف حين يسقط قارئوه كلُّهم لا أوّلُهم**
           (D-214). */
      />

      {/* ⚖️ **ووصفُ الغرفة غادر المتنَ إلى الغلاف** (D-286، طلبُ أحمد:
          «اكتب العنوان في المساحة في الغلاف»).
          **وسيرتُه في سطرين:** كان `h1` ثانياً في صفحةٍ فيها `h1`، فنزل
          في D-284 إلى سطرٍ خافت، **ثم صعد اليوم إلى الفراغ الذي كان في
          الغلاف** — **والنصُّ لم يتغيّر في المرّتين** (D-257).
          **فصار أوّلُ ما يقرؤه القارئُ في المتن نبذةَ العمل، ثم الكلام.** */}
      <div className="px-3 sm:px-6 max-w-xl mx-auto mt-1">
        {/* **ونبذةُ العمل مكانَ الفراغ** (D-284، طلبُ أحمد: «ونبذة عن
            المسلسل»). **ثلاثةُ أسطرٍ لا أكثر**: الصفحةُ للحوار، **والنبذةُ
            تعرّف بمن لم يشاهد ولا تزاحم من جاء يقرأ** (D-223: صوتُنا لا
            يعلو على صوت الناس).
            **وتُقصّ بلا زرِّ توسيع**: صفحةُ العمل على بُعد ضغطةٍ من
            الترويسة، **وبابٌ قائمٌ خيرٌ من بابٍ ثانٍ** (D-266).
            ⚠️ **واتّجاهُها من نصّها** (D-282): TMDB تُرجعها بلغة القارئ
            حين تتوفّر، **فقد تعود عربيةً في واجهةٍ إنجليزية.** */}
        {/* 🆕 **سطرٌ واحدٌ وزرُّ «المزيد»** (D-304، طلبُ أحمد) — والحجّةُ
            كاملةً في رأس `ExpandableText`. **ولا مكوّنَ ثانٍ للنصّ
            المطويّ**: هذا هو الأوّل، **ومن أراد نصّاً يُوسَّع بعده يقرؤه
            من هنا** (D-002). */}
        {overview && <ExpandableText text={overview} locale={locale} />}

        {/* **شاراتُ حالتك — تُقرأ ولا تُضغط** (D-217): «المُطَوَّق يُضغط
            والعاري يُقرأ»، فلا يظنُّها أحدٌ زرّين ويضغطهما بلا أثر. */}
        <div className="mt-2 flex items-center gap-3 flex-wrap">
          {!signedIn && (
            /* **دعوةٌ لا جدار** (D-221): الزائرُ قرأ الحوار أوّلاً،
               **فالطلبُ يأتي بعد أن رأى لماذا.** */
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 active:scale-95 transition hover:border-accent"
            >
              <Icon name="comment" size={13} className="shrink-0 text-accent" />
              <span className="text-12 font-bold">{t.talkSignInToWrite}</span>
            </Link>
          )}
          {watchedIt && (
            <span className="inline-flex items-center gap-1.5 text-12 text-muted">
              <Icon name="check" size={13} className="text-accent" />
              {t.talkWatchedIt}
            </span>
          )}
          {!watchedIt && follow.following && (
            <span className="inline-flex items-center gap-1.5 text-12 text-muted">
              <Icon name="bookmark" size={13} className="text-accent" />
              {t.talkInLibrary}
            </span>
          )}
        </div>
      </div>

      {/* **الخيطُ شجرةٌ كـReddit** (طلبُ أحمد: «تكون مثل Reddit لا مثل
          تويتر») — والحجّةُ كاملةً في رأس `ThreadReplies`.
          **والعنوانُ والملصقُ والغلافُ يُمرَّرون ليُكتبوا مع الصفّ**: بطاقةُ
          الغرفة تقرؤهما من المشاركات لا من TMDB (D-164). */}
      {/* 🆕 **وحشوةُ الخيط ضاقت** (D-296، طلبُ أحمد: «فيه هوامش يمين
          ويسار فاضية»): **١٢px لا ١٦** على الجوال، **وتبقى ٢٤ على العريض**
          حيث المساحةُ ليست شحيحة. **ومع سقوط عمود الوجه صار المكسبُ
          ٥٦px في كلِّ سطر.** */}
      <div className="px-3 sm:px-6 max-w-xl mx-auto mt-3">
        <ThreadReplies
          /* 🆕 **إعجاباتُ الغرفة — نداءٌ واحدٌ لكلِّ مشاركاتها** (D-289،
             الهجرة ٩٠). **بعد الخيط لأن مفاتيحَه هي مدخلُه**، **وقبل
             الرسم فلا يقفز الرقم** (D-046). */
          likes={postLikes}
          target={{
            kind: "talk",
            tmdbId,
            mediaType,
            title: rawTitle || null,
            posterPath,
            backdropPath,
          }}
          votes={postVotes}
          translations={translations}
          replies={thread.map((p) => ({
            replyId: p.postId,
            authorId: p.authorId,
            nickname: p.nickname,
            username: p.username,
            avatar_url: p.avatar_url,
            hide_name: p.hide_name,
            parentId: p.parentId,
            body: p.body,
            createdAt: p.createdAt,
            isMine: p.isMine,
            /* 🆕 D-261 — تمرُّ كما جاءت، **والصفُّ يقرّر متنَه** */
            kind: p.kind,
            data: p.data,
            spoiler: p.spoiler,
            /* 🆕 D-271 — إعلانُ الكاتب، **والصفُّ يحجب متنَه به** */
            hasSpoiler: p.hasSpoiler,
            /* 🆕 D-312 — الصورةُ من عمودها الحقيقيّ (الهجرة ٩٧) */
            imagePath: p.imagePath,
            /* 🔴 🆕 **والـGIF يعبر معها** (D-423، شكوى أحمد: «GIF أقدر
               أختاره وبعد ما أرسله يختفي ما يظهر»).
               **والعطلُ كان هنا وحدَه**: العمودُ في القاعدة والدالّةُ
               تعيده و`data.ts` تقرؤه و`ReplyItem` يرسمه — **وهذه
               الخريطةُ الصريحةُ في الصفحة نسيَته**، فيسافر مع النسخة
               التفاؤليّة ويسقط عند أوّل تحديث. **وخريطةُ حقولٍ مكتوبةٌ
               بيدٍ تُنسى حقلاً، ولا يشتكي منها المترجمُ لأن الحقلَ
               اختياريّ** — سيرةُ D-179 مقلوبةً: التسامحُ الذي يحمي من
               العطل يخفي النسيان. */
            gifId: p.gifId,
          }))}
          me={me}
          locale={locale}
          signedIn={signedIn}
        />
      </div>
    </main>
  );
}
