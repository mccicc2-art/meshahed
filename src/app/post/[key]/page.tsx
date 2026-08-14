import Link from "next/link";
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
import { newsLine, newsSource } from "@/lib/newsLine";
import { newsViewKey } from "@/lib/postKeys";
import { getT } from "@/lib/locale";
import { Avatar } from "@/components/Avatar";
import { LikeButton } from "@/components/LikeButton";
import { PosterCard } from "@/components/PosterCard";
import { ShareTitleButton } from "@/components/ShareTitleButton";
import { ThreadTopBar, ThreadDateLine, ThreadActionBar } from "@/components/thread/ThreadShell";
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

  const [replies, me, views, likes] = await Promise.all([
    getNewsThread(key),
    user ? getMyProfileLite() : Promise.resolve(null),
    getPostViewCounts([newsViewKey(key)]),
    getReactions([post.tmdb_id]),
  ]);

  const src = newsSource(post);
  const titleHref = `/${post.media_type === "tv" ? "show" : "movie"}/${post.tmdb_id}`;
  const likeKey = `${post.media_type}-${post.tmdb_id}`;

  return (
    <main className="pb-24 px-4 max-w-[680px] mx-auto">
      <ThreadTopBar title={t.postPageTitle} locale={locale} />

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
            <Avatar src="/icon-192.png" name="Loopz" size={44} alt="" />
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
            <div className="mt-0.5 flex items-center gap-1.5">
              <Link
                href={titleHref}
                prefetch={false}
                className="min-w-0 truncate text-[13px] text-muted hover:text-accent transition"
              >
                <bdi>{post.title}</bdi>
              </Link>
              <span aria-hidden className="shrink-0 text-muted text-[12px]">
                ·
              </span>
              <span className="shrink-0 text-[13px] text-muted">
                {post.media_type === "tv" ? t.typeSeries : t.typeMovie}
              </span>
            </div>
          </div>
        </div>

        {/* **النصُّ بعرض الصفحة كلِّها لا بجانب الوجه** — تشريحُ تويتر:
            الترويسةُ تجاور الوجه، **والمنشورُ يأخذ العرضَ كلَّه** لأنه
            المقصود. */}
        <p className="mt-3 text-[17px] leading-relaxed font-semibold">{line}</p>

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

        {/* **الملصقُ بطاقةً عريضةً تحت النصّ** — موضعُ صورةِ المنشور في
            تويتر. **ولا ضغطةَ مطوَّلة هنا**: الصفحةُ للنقاش، **وقائمةٌ
            تفتح «للمشاهدة» فوق خيطِ كلامٍ تسرق الانتباهَ من سبب الزيارة.** */}
        <div className="mt-3 w-[112px]">
          <PosterCard
            href={titleHref}
            title={post.title}
            posterPath={post.poster_path}
            posterSize="w185"
            fallbackIcon={post.media_type === "tv" ? "tv" : "film"}
            hideTitle
          />
        </div>
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
    </main>
  );
}
