import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getUser,
  getMyProfileLite,
  getNewsPost,
  getNewsThread,
  getPostViewCounts,
  getReactions,
} from "@/lib/data";
import { getMovie, getTv, posterUrl, backdropUrl } from "@/lib/tmdb";
import { newsLine, newsSource } from "@/lib/newsLine";
import { newsViewKey } from "@/lib/postKeys";
import { getT } from "@/lib/locale";
import { Avatar } from "@/components/Avatar";
import { LikeButton } from "@/components/LikeButton";
import { ShareTitleButton } from "@/components/ShareTitleButton";
import { TitleHero } from "@/components/TitleHero";
import { HeroRatings, HeroRatingsSkeleton } from "@/components/HeroRatings";
import { ThreadDateLine, ThreadActionBar } from "@/components/thread/ThreadShell";
import { LOOPZ_USERNAME } from "@/lib/loopz";
import { ThreadReplies } from "@/components/thread/ThreadReplies";

export const dynamic = "force-dynamic";

/**
 * **صفحةُ نشرةِ Loopz** (D-239، وأُعيد تشريحُها في D-242).
 *
 * **طلبُ أحمد بلقطةٍ من تويتر:** «أبغاها مثلها، وحتى طريقة الفتح نفس
 * الصورة. ما أبغى أخترع شي، أبغى شي مألوف للناس ويفهمه بسرعة».
 * **فالترتيبُ ترتيبُ تويتر حرفاً**: ترويسةٌ لاصقة ← المنشور ← سطرُ
 * التاريخ والمشاهدات ← شريطُ الأفعال ← صفُّ الكتابة ← الردود.
 *
 * **والنصُّ ١٧px هنا و١٣ في الخطّ** — نفسُ نصِّ تويتر: **صاحبُ الصفحة
 * يكبر لأنه سببُ فتحها**، والصفُّ في القائمة يصغر لأنه واحدٌ من ثلاثين.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ key: string }>;
}): Promise<Metadata> {
  const { key } = await params;
  const { locale, t } = await getT();
  const post = await getNewsPost(decodeURIComponent(key)).catch(() => null);
  if (!post) return {};
  const line = newsLine(post, t, locale);
  if (!line) return {};
  /* **العنوانُ جملةُ الخبر نفسُها**: من شارك الرابط يريد أن يقول الخبر،
     **لا أن يقول «منشور في Loopz»** — فالمعاينةُ هي الرسالة. */
  return { title: line, description: `${post.title} · Loopz` };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key: raw } = await params;
  const key = decodeURIComponent(raw);
  const { locale, t } = await getT();

  /* **وتُقرأ بلا حساب** كغرفة الكلام (D-221): القراءةُ للجميع والكتابةُ
     للمسجَّلين. **والحراسةُ في القاعدة لا هنا.** */
  const [user, post] = await Promise.all([getUser(), getNewsPost(key)]);
  if (!post) notFound();

  const line = newsLine(post, t, locale);
  /* **ونشرةٌ بلا صيغةٍ تسقط هنا لا في الرسم**: نفسُ حارس `ActivityFeed` */
  if (!line) notFound();

  /* 🆕 **وتفاصيلُ العمل معها — للغلاف وحدَه** (D-299).
     **`getLoopzNews` تحمل الملصقَ ولا تحمل الغلافَ العريض**، **وترويسةٌ
     غلافيّةٌ بلا غلافٍ سطحٌ رماديّ** (D-034). **والنداءُ مقبولٌ هنا وهو
     مرفوضٌ في الخطّ**: صفحةٌ واحدةٌ لعملٍ واحد مقابلَ أربعين صفّاً
     (D-164) — **ونفسُ ما تفعله `/review` حرفاً** (D-145: وصفةٌ واحدة). */
  const [replies, me, views, likes, details] = await Promise.all([
    getNewsThread(key),
    user ? getMyProfileLite() : Promise.resolve(null),
    getPostViewCounts([newsViewKey(key)]),
    getReactions([post.tmdb_id]),
    (post.media_type === "tv" ? getTv(post.tmdb_id) : getMovie(post.tmdb_id)).catch(() => null),
  ]);

  const src = newsSource(post);
  const titleHref = `/${post.media_type === "tv" ? "show" : "movie"}/${post.tmdb_id}`;
  const likeKey = `${post.media_type}-${post.tmdb_id}`;

  const poster = posterUrl(
    post.poster_path ?? (details as { poster_path?: string | null } | null)?.poster_path ?? null,
    "w342",
  );
  const backdrop = backdropUrl(
    (details as { backdrop_path?: string | null } | null)?.backdrop_path ?? null,
    "w780",
  );

  return (
    <main className="pb-24">
      {/**
       * 🆕 **والنشرةُ لبست ترويسةَ الريفيو** (D-299، طلبُ أحمد: «بوستات
       * لوبز خلّها شكلها مثل النشرات الثانية»).
       *
       * **وكان رأسُها شريطاً نصّيّاً مكتوباً عليه «Post»** — **وهو رأسٌ
       * يقول نوعَ الصفحة ولا يقول عن أيِّ عملٍ هي**، **بينما جارتُها
       * `/review` تفتح بغلاف العمل واسمِه وتقييمه.**
       * **وسطحان يتكلّمان عن عملٍ واحد بترويستين يقولان إنهما شيئان
       * مختلفان** (D-244: الترويسةُ الغلافيّة مكوّنٌ واحدٌ لسطوحه).
       *
       * **✅ وبلا مكوّنٍ جديد**: `TitleHero` هي هي — **والثالثُ لها بعد
       * `/review` و`/talk`** (D-266).
       * ⚠️ **ولا `end` فيها**: البابُ الطبيعيُّ من نشرةٍ هو صفحةُ العمل،
       * **والملصقُ يفتحها أصلاً** — **وبابان إلى غرفةٍ واحدة** (D-297).
       */}
      <TitleHero
        backdrop={backdrop}
        poster={poster}
        title={post.title}
        href={titleHref}
        mediaType={post.media_type}
        locale={locale}
        meta={
          <Suspense fallback={<HeroRatingsSkeleton compact />}>
            <HeroRatings
              compact
              ageLabel={t.ageRating}
              imdbId={(details as { imdb_id?: string | null } | null)?.imdb_id ?? null}
              tvId={post.media_type === "tv" ? post.tmdb_id : undefined}
            />
          </Suspense>
        }
      />

      <div className="px-4 max-w-[680px] mx-auto">
      {/* ============ النشرةُ نفسُها ============ */}
      <article className="pt-3">
        <div className="flex items-start gap-3">
          {/* **ختمُ Loopz في موضع الوجه** — الأيقونةُ الرسمية نفسُها (D-039).
              **🆕 وبابٌ إلى حسابه** (D-252) — وجهُ صاحب الصفحة في `/review`
              يفتح ملفَّه، وهذا نظيرُه حرفاً. */}
          <Link
            href={`/u/${LOOPZ_USERNAME}`}
            prefetch={false}
            className="shrink-0 active:opacity-80 transition"
          >
            <Avatar src="/loopz-mark.png" name="Loopz" size={44} alt="" />
          </Link>
          <div className="min-w-0 flex-1">
            <Link
              href={`/u/${LOOPZ_USERNAME}`}
              prefetch={false}
              className="block font-bold text-[15px] leading-tight hover:text-accent transition"
              dir="ltr"
            >
              Loopz
            </Link>
            {/* ⚖️ 🆕 **وسطرُ «الاسم · النوع» سقط** (D-299): **صعد كلُّه إلى
                الغلاف** — الاسمُ في `h1` والنوعُ في أيقونة الملصق —
                **وسطرٌ يُعيد ما فوقه بحجمٍ أصغر تكرارٌ لا سياق** (D-224).
                **والنصُّ لم يتغيّر، تغيّر موضعُه** (D-257/D-286). */}
          </div>
        </div>

        {/* **النصُّ بعرض الصفحة كلِّها لا بجانب الوجه** — تشريحُ تويتر:
            الترويسةُ تجاور الوجه، **والمنشورُ يأخذ العرضَ كلَّه** لأنه
            المقصود. */}
        <p className="mt-3 text-[15px] leading-relaxed font-semibold">{line}</p>

        {src && (
          <p className="mt-2 text-[12px] text-muted">
            {src.url ? (
              <a
                href={src.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="underline decoration-dotted underline-offset-2 hover:text-accent transition"
              >
                {t.newsPerSource(src.name)}
              </a>
            ) : (
              t.newsPerSource(src.name)
            )}
          </p>
        )}

        {/* ⚖️ 🆕 **والملصقُ في المتن سقط** (D-299): **صار في الغلاف فوقه
            بالحجم نفسِه تقريباً وبنفس الوجهة** — **وصورةٌ واحدةٌ مرّتين في
            شاشةٍ واحدة تُقرأ عطلاً لا تأكيداً** (D-257). **وموضعُ صورةِ
            المنشور في تويتر يبقى محجوزاً لصورةٍ يرفعها الكاتب** — وهي
            سطرُ D-298 نفسُه يوم يصل إلى النشرات. */}
      </article>

      <ThreadDateLine
        iso={post.published_at}
        views={views.get(newsViewKey(key)) ?? 0}
        locale={locale}
      />

      <ThreadActionBar>
        <LikeButton
          target="post"
          tmdbId={post.tmdb_id}
          mediaType={post.media_type}
          likes={likes.counts[likeKey] ?? 0}
          likedByMe={likes.mine.has(likeKey)}
          isMine={false}
          readOnly={!user}
          locale={locale}
        />
        <ShareTitleButton path={titleHref} title={post.title} locale={locale} />
      </ThreadActionBar>

      <ThreadReplies
        target={{ kind: "post", postKey: key }}
        replies={replies}
        me={me}
        locale={locale}
        signedIn={!!user}
      />
      </div>
    </main>
  );
}
