import Link from "next/link";
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
import { displayNameOf } from "@/lib/people";
import { getMovie, getTv, posterUrl, backdropUrl } from "@/lib/tmdb";
import { displayWorkTitle } from "@/lib/wikidata";
import { commentViewKey } from "@/lib/postKeys";
import { dirOf } from "@/lib/dir";
import { getT } from "@/lib/locale";
import { Avatar } from "@/components/Avatar";
import { SpoilerText } from "@/components/SpoilerText";
import { LikeButton } from "@/components/LikeButton";
import { ShareTitleButton } from "@/components/ShareTitleButton";
import { ReportButton } from "@/components/ReportButton";
import { Icon } from "@/components/Icon";
import { TitleHero } from "@/components/TitleHero";
import { ThreadDateLine, ThreadActionBar } from "@/components/thread/ThreadShell";
import { ThreadReplies } from "@/components/thread/ThreadReplies";

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
}: {
  params: Promise<{ type: string; id: string; user: string }>;
}): Promise<Metadata> {
  const { type, id, user } = await params;
  if (type !== "tv" && type !== "movie") return {};
  const tmdbId = Number(id);
  if (!Number.isFinite(tmdbId)) return {};
  const { locale, t } = await getT();
  const reviews = await getTitleReviews(tmdbId, type).catch(() => []);
  const r = reviews.find((x) => x.id === user);
  if (!r) return {};
  const who = displayNameOf(r, t.anonymousUser);
  const work = await workTitle(tmdbId, type, locale);
  return {
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
  const whoHref = r.username ? `/u/${r.username}` : null;
  const titleHref = `/${mediaType === "tv" ? "show" : "movie"}/${tmdbId}`;

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

      <div className="px-4 sm:px-6 max-w-[680px] mx-auto">
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
            {whoHref ? (
              <Link
                href={whoHref}
                prefetch={false}
                className="block min-w-0 truncate font-bold text-[15px] leading-tight hover:text-accent transition"
              >
                <bdi>{who}</bdi>
              </Link>
            ) : (
              <p className="min-w-0 truncate font-bold text-[15px] leading-tight">
                <bdi>{who}</bdi>
              </p>
            )}
            {/* **اسمُ العمل وتقييمُه في سطرٍ واحد** — نفسُ سطر خطّ النشاط
                حرفاً (D-228)، **فمن ضغط الصفَّ يجد ما ضغطه.** */}
            <div className="mt-0.5 flex items-center gap-1.5">
              <Link
                href={titleHref}
                prefetch={false}
                className="min-w-0 truncate text-[12px] text-muted hover:text-accent transition"
              >
                <bdi>{work}</bdi>
              </Link>
              {r.rating != null && (
                <span
                  className="shrink-0 text-[14px] font-bold text-accent tabular-nums"
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
          ) : (
            <p
              dir={dirOf(r.review)}
              className="mt-3 text-[15px] leading-relaxed text-foreground whitespace-pre-line"
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
        <ShareTitleButton path={titleHref} title={work} locale={locale} />
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

      <ThreadReplies
        target={{ kind: "review", reviewUserId: authorId, tmdbId, mediaType }}
        replies={replies}
        me={profile}
        locale={locale}
        signedIn={!!me}
      />
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
