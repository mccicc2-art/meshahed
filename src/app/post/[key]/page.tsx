import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getUser, getNewsPost, getNewsThread } from "@/lib/data";
import { newsLine, newsSource } from "@/lib/newsLine";
import { getT } from "@/lib/locale";
import { timeAgo } from "@/lib/when";
import { Avatar } from "@/components/Avatar";
import { BackButton } from "@/components/BackButton";
import { PosterCard } from "@/components/PosterCard";
import { NewsThread } from "@/components/NewsThread";

export const dynamic = "force-dynamic";

/**
 * **صفحةُ نشرةِ Loopz** (D-239، طلبُ أحمد: «صفحة الردود» — واختار
 * **صفحةً لكلِّ منشور**).
 *
 * ================= لماذا وُجدت =================
 *
 * D-236 أعطى الردَّ **باباً للكتابة** ولم يُعطه **باباً للقراءة**:
 * `news_post_thread` مكتوبةٌ في الهجرة ٧٣ **وبلا مستهلك**. **فمن ردَّ لم
 * يرَ ردَّه، ومن قرأ النشرةَ لم يعرف أن تحتها كلاماً** — وهذا وعدٌ مكسور
 * لا ميزةٌ ناقصة.
 *
 * ================= ولماذا مسارٌ ثالثٌ للنقاش =================
 *
 * عندنا `‎/talk/[type]/[id]` لكلام الناس عن **عمل**. **وهذه ليست عملاً،
 * هي حدثٌ**: «تجدَّد لموسمٍ ثانٍ» و«موعدُ الصالات» نشرتان عن العمل نفسِه،
 * **ودمجُهما في غرفةٍ واحدة يجعل الردَّ يبدو جواباً على خبرٍ لم يُقرأ**
 * (نفسُ حجّةِ القرار ١ في الهجرة ٧٣). **فالمِرساةُ النشرةُ لا العمل.**
 *
 * **والمفتاحُ في المسار مُرمَّز** (`encodeURIComponent`): `key` نصٌّ
 * مركَّب `kind:media:id:dedupe` — **والنقطتان تمرّان في المسار وغيرُهما
 * لا يمرّ**، فالترميزُ عقدٌ لا احتياط.
 *
 * ⚠️ **ولا هجرةَ جديدة لها**: انظر `getNewsPost` — **صفحةٌ لا تعمل حتى
 * تُشغَّل هجرةٌ ليست صفحة**، وعندنا ستٌّ معلّقةٌ أصلاً.
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
     للمسجَّلين. **والحراسةُ في القاعدة لا هنا** — `news_post_thread`
     تشترط `auth.uid()` وتحترم الحظرَ والإخفاء، **فالزائرُ يرى النشرةَ
     وخيطُها يعود فارغاً بلا خطأ.** */
  const [user, post] = await Promise.all([getUser(), getNewsPost(key)]);
  if (!post) notFound();

  const line = newsLine(post, t, locale);
  /* **ونشرةٌ بلا صيغةٍ تسقط هنا لا في الرسم**: نفسُ حارس `ActivityFeed` */
  if (!line) notFound();

  const replies = await getNewsThread(key);
  const src = newsSource(post);
  const titleHref = `/${post.media_type === "tv" ? "show" : "movie"}/${post.tmdb_id}`;

  return (
    <main className="pb-24 px-4 max-w-[680px] mx-auto">
      <div className="pt-4 pb-2 flex items-center gap-3">
        <BackButton locale={locale} />
        <h1 className="text-[15px] font-bold">{t.postPageTitle}</h1>
      </div>

      {/* ============ النشرةُ نفسُها ============
          **وهي صفُّ الخطّ مكبَّراً لا شكلاً ثانياً**: نفسُ الختم ونفسُ
          الترتيب ونفسُ الملصق في النهاية — **فمن ضغط الصفَّ يجد ما ضغطه**.
          **والمكبَّرُ هو النصُّ وحده** (`text-[15px]` بدل `[13px]`): هنا
          هو الموضوع لا سطرٌ في قائمة. */}
      <article className="pt-2 pb-4 border-b border-[color:var(--divider)] flex gap-3">
        <div className="min-w-0 flex-1 flex flex-col">
          <div className="flex items-center gap-2.5">
            <Avatar src="/icon-192.png" name="Loopz" size={44} alt="" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="shrink-0 font-bold text-[14px] leading-tight" dir="ltr">
                  Loopz
                </span>
                <span className="ms-auto shrink-0 text-[11px] text-muted">
                  {timeAgo(post.published_at, t)}
                </span>
              </div>
              <div className="mt-px flex items-center gap-1.5">
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

          <p className="mt-3 text-[15px] leading-relaxed font-semibold">{line}</p>

          {src && (
            <p className="mt-2 text-[11px] text-muted">
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
        </div>

        <div className="w-[92px] shrink-0">
          {/* **ولا ضغطةَ مطوَّلة هنا**: الصفحةُ للنقاش، **وقائمةٌ تفتح
              «للمشاهدة» فوق خيطِ كلامٍ تسرق الانتباهَ من سببِ الزيارة**.
              والملصقُ رابطٌ إلى العمل كما هو. */}
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

      <NewsThread postKey={key} replies={replies} locale={locale} signedIn={!!user} />
    </main>
  );
}
