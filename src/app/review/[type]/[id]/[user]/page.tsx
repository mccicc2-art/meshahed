import Link from "next/link";
import { realMentions } from "@/lib/mentionsCore";
import { Suspense } from "react";
import { webWords } from "@/components/webWords";
import { TalkSide, TalkSideCard } from "@/components/talk/TalkSide";
import { OtherReviewsCard } from "@/components/talk/TalkSideLists";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getUser,
  getMyProfileLite,
  getMyArtFor,
  getCommunityRating,
  getTitleReviews,
  getTitleReplies,
  getPostViewCounts,
} from "@/lib/data";
import { displayNameOf, profileHref } from "@/core/people";
import { getMovie, getTv, posterUrl, backdropUrl } from "@/lib/tmdb";
import { displayWorkTitle } from "@/lib/wikidata";
import { commentViewKey } from "@/core/postKeys";
import { dirOf } from "@/core/dir";
import { getT } from "@/lib/locale";
import { AccountBadges } from "@/components/AccountIdentity";
import { Avatar } from "@/components/Avatar";
import { SpoilerText } from "@/components/SpoilerText";
import { FeedReviewText } from "@/components/FeedReviewText";
import { LikeButton } from "@/components/LikeButton";
import { ShareReviewButton } from "@/components/ShareReviewButton";
import { DownloadLoopzBar } from "@/components/DownloadLoopzBar";
import { ReportButton } from "@/components/ReportButton";
import { Icon } from "@/components/Icon";
import { TitleHero } from "@/components/TitleHero";
import { ThreadDateLine, ThreadActionBar } from "@/components/thread/ThreadShell";
import { ThreadReplies } from "@/components/thread/ThreadReplies";
import { getReplyLikes } from "@/lib/threadLikes";

export const dynamic = "force-dynamic";

/**
 * **صفحةُ تعليقِ شخص** (D-242، طلبُ أحمد: «صفحة الردود على الشخص تكون
 * مثل تويتر… وحتى طريقة الفتح نفس الصورة»).
 *
 * ================= وهي البابُ الذي كان ناقصاً =================
 *
 * كان تعليقُ الشخص في الخطّ يفتح **غرفةَ العمل** (`/talk`) — **فتضغط
 * كلامَ خالد فتصل إلى صفحةٍ فيها كلامُ عشرة**، وتبحث عن سطره بعينك.
 * **وهذا عكسُ ما يفعله تويتر بالضبط**: ضغطةٌ على منشورٍ تفتح **ذلك
 * المنشور** وردودَه. **ولا مكانَ لكلامٍ في هذا التطبيق بلا عنوانٍ يخصّه.**
 *
 * ================= والمِرساةُ ثلاثةُ حقولٍ لا معرّفُ صفّ =================
 *
 * `‎/review/<نوع>/<tmdb>/<صاحب>` — **لأن `reviews` مفتاحُها
 * `(user_id, tmdb_id, media_type)` ولا `id` لها**. وهي نفسُ الثلاثة
 * التي يعرّف بها الإعجابُ والردُّ ومفتاحُ المشاهدة الرأيَ — **فلا هويّةَ
 * رابعة تُخترع لنفس الشيء.**
 *
 * ⚠️ **ولا نداءَ جديداً في القاعدة:** `getTitleReviews` و`getTitleReplies`
 * تقرآن العملَ كلَّه بنداءٍ واحدٍ لكلٍّ، **ونحن نرشّح في الذاكرة**. رأيٌ
 * واحد لا يستحقّ دالّةً سابعةً معلّقة، **والعملُ الواحد لا يحمل آلافَ
 * الآراء بعد** — يوم يحملها تُكتب الدالّة.
 */
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ type: string; id: string; user: string }>;
  searchParams: Promise<{ card?: string }>;
}): Promise<Metadata> {
  const { type, id, user } = await params;
  const { card } = await searchParams;
  if (type !== "tv" && type !== "movie") return {};
  const tmdbId = Number(id);
  if (!Number.isFinite(tmdbId)) return {};
  const { locale, t } = await getT();
  const reviews = await getTitleReviews(tmdbId, type).catch(() => []);
  const r = reviews.find((x) => x.id === user);
  if (!r) return {};
  const who = displayNameOf(r, t.anonymousUser);
  const work = await workTitle(tmdbId, type, locale);
  /* 🆕 T530 — صورةُ المشاركة من `card/route.tsx`: المراجعةُ كاملةً، أو التقييمُ وحده لرابطٍ يحمل `?card=rating` (أحمد «١أ»).
     ورأيٌ بلا درجة (شخصيّةُ AI) لا صورةَ له — تُورَّث صورةُ الجذر */
  const v = Date.parse(r.updated_at) || 0;
  const image = r.rating != null ? `/review/${type}/${tmdbId}/${user}/card?${card === "rating" ? "card=rating&" : ""}v=${v}` : null;
  return {
    ...(image
      ? {
          /* الجذرُ يُستبدل لا يُدمج: الاسمُ والنوعُ واللغةُ تُعاد هنا وإلّا سقطت (مراجعةُ الوكيل ٢، البند ٧) */
          openGraph: {
            type: "website",
            siteName: t.brand,
            locale: locale === "ar" ? "ar_SA" : "en_US",
            images: [{ url: image, width: 1200, height: 630, alt: t.reviewPageMeta(who, work) }],
          },
          twitter: { card: "summary_large_image", images: [image] },
        }
      : {}),
    title: t.reviewPageMeta(who, work),
    /* 🆕 D-315 — **الوصفُ لا يكشف ما حجبه كاتبُه**: بطاقةُ مشاركةٍ تعرض
       الحرقَ في المعاينة تكسر الحاجبَ قبل أن يُفتح */
    description: r.has_spoiler ? undefined : (r.review ?? "").slice(0, 160) || undefined,
  };
}

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ type: string; id: string; user: string }>;
}) {
  const { type, id, user: authorId } = await params;
  if (type !== "tv" && type !== "movie") notFound();
  const mediaType = type as "tv" | "movie";
  const tmdbId = Number(id);
  if (!Number.isFinite(tmdbId)) notFound();

  const { locale, t } = await getT();
  const [me, reviews, allReplies] = await Promise.all([
    getUser(),
    getTitleReviews(tmdbId, mediaType),
    getTitleReplies(tmdbId, mediaType),
  ]);

  const r = reviews.find((x) => x.id === authorId);
  /* **ورأيٌ لا وجود له `notFound` لا صفحةٌ فارغة**: رابطٌ ميّت يجب أن
     يقول إنه ميّت — **وصفحةٌ فارغة تُقرأ عطلاً في التطبيق** (D-181). */
  if (!r) notFound();

  /* **الغلافُ بنفس مصادر صفحة الغرفة** (D-244، طلبُ أحمد: «أحتاج الغلاف
     تبع الفلم فوق»): TMDB للرسميّ، و`getMyArtFor` لاختيارك أنت — **صورتان
     مختلفتان لعملٍ واحد تُقرآن عملين** (D-131). و`getTv`/`getMovie` تمرّان
     على ذاكرة الطلب فلا يُدفع النداءُ مرّتين مع `workTitle`. */
  const [profile, views, work, details, myArt, community] = await Promise.all([
    me ? getMyProfileLite() : Promise.resolve(null),
    getPostViewCounts([commentViewKey(authorId, mediaType, tmdbId)]),
    workTitle(tmdbId, mediaType, locale),
    (mediaType === "tv" ? getTv(tmdbId) : getMovie(tmdbId)).catch(() => null),
    getMyArtFor(tmdbId, mediaType).catch(() => null),
    getCommunityRating(tmdbId, mediaType).catch(() => ({ avg: 0, count: 0 })),
  ]);
  const poster = posterUrl(
    myArt?.poster_path ??
      (details as { poster_path?: string | null } | null)?.poster_path ??
      null,
    "w185",
  );
  const backdrop = backdropUrl(
    myArt?.backdrop_path ??
      (details as { backdrop_path?: string | null } | null)?.backdrop_path ??
      null,
    "w780",
  );

  const replies = allReplies
    .filter((x) => x.reviewUserId === authorId)
    .map((x) => ({
      replyId: x.replyId,
      authorId: x.id,
      nickname: x.nickname,
      username: x.username,
      avatar_url: x.avatar_url,
      hide_name: x.hide_name,
      parentId: x.parentId,
      body: x.body,
      createdAt: x.createdAt,
      isMine: x.isMine,
    }));

  const who = displayNameOf(r, t.anonymousUser);
  /* 🔴 🆕 **والبابُ كان مشروطاً باسمِ مستخدمٍ لا يملكه أكثرُ الأعضاء**
     (D-655، بلاغُ أحمد): **الرابطُ هنا موجودٌ منذ يومه** — **والذي سقط
     أن صاحبَ الرأي بلا `username`**، **وسبعةَ عشرَ من واحدٍ وثلاثين
     كذلك.** **والمعرّفُ طريقٌ مفتوحٌ أصلاً** (`getProfileByUsername`
     فيها فرعُ UUID) — **ولا حرفَ يُكتب في القاعدة.** */
  const whoHref = profileHref(r);
  const titleHref = `/${mediaType === "tv" ? "show" : "movie"}/${tmdbId}`;
  const w = webWords(locale);

  return (
    <main className="pb-24">
      {/* **الغلافُ فوق، والبابُ إلى غرفة العمل في طرفه** (D-244، طلبُ
          أحمد: «فيه زر يدخّلني لصفحة تعليقات الفلم») — **عكسُ سهم صفحة
          الغرفة**: هناك الطرفُ يودّي إلى العمل، وهنا إلى كلامه. **الموضعُ
          واحدٌ والوجهةُ لصاحب الصفحة.** */}
      <TitleHero
        backdrop={backdrop}
        poster={poster}
        title={work}
        href={titleHref}
        mediaType={mediaType}
        avg={Math.round(community.avg * 10) / 10}
        count={community.count}
        ratingLabel={t.communityRating}
        locale={locale}
        end={
          <Link
            href={`/talk/${mediaType}/${tmdbId}`}
            aria-label={t.reviewOpenTalk}
            title={t.reviewOpenTalk}
            className="w-11 h-11 rounded-full bg-black/35 backdrop-blur-md border border-white/15 grid place-items-center text-white/90 active:scale-95 transition"
          >
            <Icon name="comment" size={18} />
          </Link>
        }
      />

      {/* 🆕 R264 — **الرأيُ على الحاسوب بهيكل الغرفة** (أحمد ١٨ نوفمبر): الرأيُ والردودُ في العمود العريض، وبجانبه
          «عن العمل» و«آراءٌ أخرى». وتحت ١٢٨٠ كما كان حرفاً. */}
      <div className="desk:mx-auto desk:grid desk:max-w-[1104px] desk:grid-cols-[minmax(0,760px)_300px] desk:items-start desk:justify-center desk:gap-8 desk:px-6">
      <div className="px-4 sm:px-6 max-w-[680px] mx-auto desk:mx-0 desk:max-w-none desk:px-0">
      {/* ============ التعليقُ نفسُه ============ */}
      <article className="pt-4">
        <div className="flex items-start gap-3">
          {whoHref ? (
            <Link href={whoHref} prefetch={false} className="shrink-0 active:opacity-80 transition">
              <Avatar src={r.hide_name ? null : r.avatar_url} name={who} size={44} alt="" />
            </Link>
          ) : (
            <Avatar
              src={r.hide_name ? null : r.avatar_url}
              name={who}
              size={44}
              alt=""
              className="shrink-0"
            />
          )}
          <div className="min-w-0 flex-1">
            {/* 🆕 **والغلافُ واحدٌ للحالتين** (D-773ب): من له بابٌ ومن لا
                بابَ له يقفان في صفٍّ واحد، **والشارةُ خارج الرابط** فلا
                رابطَ داخل رابط. */}
            <span className="flex items-center min-w-0" style={{ gap: 4 }}>
              {whoHref ? (
                <Link
                  href={whoHref}
                  prefetch={false}
                  className="block min-w-0 truncate font-bold text-15 leading-tight hover:text-accent transition"
                >
                  <bdi>{who}</bdi>
                </Link>
              ) : (
                <span className="min-w-0 truncate font-bold text-15 leading-tight">
                  <bdi>{who}</bdi>
                </span>
              )}
              {r.hide_name ? null : <AccountBadges profile={r} t={t} />}
            </span>
            {/* **اسمُ العمل وتقييمُه في سطرٍ واحد** — نفسُ سطر خطّ النشاط
                حرفاً (D-228)، **فمن ضغط الصفَّ يجد ما ضغطه.** */}
            <div className="mt-0.5 flex items-center gap-1.5">
              <Link
                href={titleHref}
                prefetch={false}
                className="min-w-0 truncate text-12 text-muted hover:text-accent transition"
              >
                <bdi>{work}</bdi>
              </Link>
              {r.rating != null && (
                <span
                  className="shrink-0 text-14 font-bold text-accent tabular-nums"
                  title={t.rateOutOf(r.rating)}
                >
                  ★ <span dir="ltr">{r.rating.toFixed(1)}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {r.review?.trim() &&
          /* 🆕 D-315 — **الحاجبُ في صفحة الرأي نفسِها**: من فتح الرابط لم
             يكشف بعدُ، **والكشفُ ضغطتُه هو** (D-063) */
          (r.has_spoiler ? (
            <SpoilerText text={r.review} locale={locale} />
          ) : r.persona?.alt ? (
            /* 🆕 T383 — مراجعةُ شخصيّةٍ بنصّين: جزيرةُ المتن نفسُها بلا رابط (هذه صفحتُه) وتحتها «اقرأ بالعربية / Read in English» */
            <FeedReviewText review={r.review} alt={r.persona.alt} locale={locale} page />
          ) : (
            <p
              dir={dirOf(r.review)}
              className="fs-content mt-3 text-15 leading-relaxed text-foreground whitespace-pre-line"
            >
              {r.review}
            </p>
          ))}
      </article>

      <ThreadDateLine
        iso={r.updated_at}
        views={views.get(commentViewKey(authorId, mediaType, tmdbId)) ?? 0}
        locale={locale}
      />

      <ThreadActionBar>
        <LikeButton
          reviewUserId={authorId}
          tmdbId={tmdbId}
          mediaType={mediaType}
          likes={r.likes}
          likedByMe={r.likedByMe}
          isMine={r.isMine}
          /* **الزائرُ يقرأ الرقم ولا يضغطه** (D-221) */
          readOnly={!me}
          locale={locale}
        />
        {/* 🆕 T530 — يشارك المراجعةَ لا العمل، ويسأل «المراجعة كاملة» أم «التقييم فقط» حين فيها نصّ (أحمد «١أ») */}
        <ShareReviewButton
          path={`/review/${mediaType}/${tmdbId}/${authorId}`}
          title={work}
          hasText={!!r.review?.trim() && r.rating != null}
          locale={locale}
        />
        {/* **بابُ البلاغ يعود إلى سطحه** (بند ١٦): غادر خطَّ `/talk` مع
            D-242 لأن قائمةَ الخطّ لا تحمل بلاغاً لكلّ صفّ — **فبقي كلامُ
            الناس على سطحٍ عامٍّ بلا بابِ بلاغ، وهذا نقصٌ لا اختصار.**
            وموضعُه هنا صحيح: **صفحةُ التعليق تخصّ تعليقاً واحداً**، فالبلاغ
            فيها لا يحتاج أن يسأل «على أيّهم؟».
            ⚠️ **وشرطان لا واحد**: لا يظهر للزائر (`me`) لأن الكتابةَ
            للمسجَّلين وحدهم (D-221)، ولا لصاحب الرأي — **زرُّ بلاغٍ على
            كلامك أنت عبثٌ يُقرأ عطلاً.** */}
        {me && !r.isMine && (
          <ReportButton
            reviewUserId={authorId}
            tmdbId={tmdbId}
            mediaType={mediaType}
            locale={locale}
          />
        )}
      </ThreadActionBar>

      {/* 🆕 T530 — «حمّل لوبز» لمن وصل بلا حساب (أحمد «٢أ»): زرُّ صفحة الدعوة نفسُه بمراحله لكلِّ جهاز */}
      {!me ? <DownloadLoopzBar locale={locale} /> : null}

      <ThreadReplies
        target={{ kind: "review", reviewUserId: authorId, tmdbId, mediaType }}
        replies={replies}
        me={profile}
        locale={locale}
        signedIn={!!me}
        mentioned={await realMentions([r.review, ...replies.map((x) => x.body)])}
        /* 🆕 T509 — قلبٌ على كلِّ ردّ («١٥ أ»، الهجرة ٢٥٩) — يغيب إن غاب قارئُه فلا يُرسم زرّ */
        likes={await getReplyLikes("review", replies.map((x) => x.replyId)).then((l) => (l.ok ? l : undefined))}
      />
      </div>
      <TalkSide>
        <div className="pt-3 flex flex-col gap-3">
          <TalkSideCard
            icon={mediaType === "tv" ? "tv" : "film"}
            title={w.talkAbout}
            rows={[
              { label: mediaType === "tv" ? t.typeSeries : t.typeMovie, value: <bdi>{work}</bdi> },
              ...(community.count ? [{ label: t.communityRating, value: <span className="text-accent tabular-nums">★ {Math.round(community.avg * 10) / 10}</span> }] : []),
            ]}
            link={{ href: titleHref, label: w.talkWorkPage }}
          />
          <Suspense fallback={null}>
            <OtherReviewsCard tmdbId={tmdbId} mediaType={mediaType} exclude={authorId} locale={locale} />
          </Suspense>
        </div>
      </TalkSide>
      </div>
    </main>
  );
}

/**
 * **اسمُ العمل من TMDB لا من صفّ الرأي** — `reviews` تحمل التقييمَ
 * والنصَّ ولا تحمل عنواناً.
 *
 * ⚠️ **ولا نداءَ مكرَّراً**: `getTv`/`getMovie` تمرّان على ذاكرة الطلب
 * نفسِها، **فالوصفُ والصفحةُ يقتسمان نداءً واحداً** (نفسُ حكم `/talk`).
 * **والسقوطُ لا يُسقط الصفحة**: كلامُ الناس يبقى مقروءاً بلا عنوانِ عمل.
 */
async function workTitle(
  tmdbId: number,
  mediaType: "tv" | "movie",
  locale: "ar" | "en",
): Promise<string> {
  try {
    const d = await (mediaType === "tv" ? getTv(tmdbId) : getMovie(tmdbId));
    const raw =
      mediaType === "tv" ? (d as { name: string }).name : (d as { title: string }).title;
    if (!raw) return "";
    return await displayWorkTitle(tmdbId, mediaType, raw, locale);
  } catch {
    return "";
  }
}
