import {
  getMyRating,
  getTitleLoopzNews,
  getTitleReplies,
  getTitleReviews,
  getTitleThread,
} from "@/lib/data";
import { getDict, type Locale } from "@/lib/i18n";
import { bulletinLine } from "@/lib/bulletinLine";
import { newsLine, newsSource } from "@/lib/newsLine";
import { RatingBox } from "./RatingBox";
import { TitleReviewRow } from "./TitleReviewRow";
import { TitleCommunityFeed, type FeedItem } from "./TitleCommunityFeed";
import { TitleJoinCard } from "./TitleJoinCard";
import { TitleNewsRow } from "./TitleNewsRow";

/**
 * **تبويبُ المجتمع — بيتٌ واحدٌ للأخبار والنقاش والآراء** (D-398، طلبُ
 * أحمد بأربع صور: «اجمع الأخبار والنقاش والراوي في مكان واحد وصممه مثل
 * الصورة»).
 *
 * ================= ما دُمج، وما نُقض باسمه =================
 *
 * **ثلاثةُ تبويباتٍ صارت واحداً**: «الأخبار» (D-300) و«التعليقات»
 * و«المجتمع» (D-191). **والحجّةُ أن الثلاثةَ جوابُ سؤالٍ واحد** — «ما
 * الذي يُقال عن هذا العمل؟» — **وسؤالٌ واحدٌ لا يُجاب في ثلاثة أمكنة**
 * (قاعدة ٦).
 *
 * ⚠️ **ونقضُ D-191 يُقال باسمه**: كان تبويبُ «المجتمع» يفتح **غرفةَ
 * العمل** (`title_rooms` — دردشةُ `CommunityRoom`)، **وصارت النقاشاتُ
 * هنا هي خيطُ `‎/talk` (`title_posts`)**. **ولم يكن للعمل حديثان، كان
 * له سطحان لحديثٍ واحد**: أحدُهما (`‎/talk`) شجرةٌ بالأصوات والإعجابات
 * والحجب والصور وتصلُه نشراتُنا (D-257/D-261/D-289/D-305)، والآخرُ دردشةٌ
 * وُلدت بـ`pg_cron`. **فبقي الأغنى، والغرفةُ تبقى في «المجتمع» حيث
 * الغرفُ تُتصفَّح** — **ولم يُحذف منها شيء، نُقل بابُها.**
 *
 * ================= وكلفتُه تُقال =================
 *
 * **ستُّ قراءاتٍ في دفعةٍ واحدة** بدل خمسٍ كانت موزّعةً على ثلاثة
 * تبويبات (`title_room_of` + قراءةُ الغرفة سقطتا، و`title_thread` حلّت
 * محلَّهما) — **فالحسابُ متعادلٌ تقريباً**، **والمكسبُ أن رزمةَ
 * `CommunityRoom` العميلة لم تعد تُحمَّل مع كلِّ صفحةِ عمل.**
 *
 * 🔴 **والنقاشاتُ خرجت من الخطّ** (D-407، نصُّ أحمد: «النقاشات مو لازم
 * تكون هنا في الكوميونتي، يكفي الصندوق اللي فوق اللي يوصل لها»).
 * **وحجّتُه أقوى من حجّةِ الجمع**: مشاركةُ الغرفة **نصفُ حوارٍ لا يُقرأ
 * خارج سياقه** — ردٌّ على ردٍّ على سؤال — **وسطرٌ منها في قائمةِ آراءٍ
 * يبدو كلاماً بلا رأس.** **والغرفةُ لها بابٌ في البطاقة فوق**، وهو
 * البابُ الوحيد. **فالخطُّ صار: آراءُ الناس ونشراتُنا** — **وكلاهما
 * يُقرأ وحدَه.**
 *
 * ⚠️ **ونشراتُ Loopz داخل الخيط أخبارٌ لا نقاشات** (`kind !== null`):
 * **تدخل رقاقةَ الأخبار لا رقاقةَ النقاشات** (D-400، حكمُ أحمد: «نشرات
 * لوبز تدخل مع المراجعة») — **فالخبرُ خبرٌ من أيِّ بابٍ وصل**، **وردودُ
 * الغرفة عليه تُعدُّ على صفّه** فلا يضيع أنه صار حواراً.
 */
export async function TitleCommunityTab({
  tmdbId,
  mediaType,
  title,
  posterPath,
  backdropPath,
  locale,
}: {
  tmdbId: number;
  mediaType: "tv" | "movie";
  /** يُكتب مع التقييم عند الحفظ (D-048: العنوان يُخزَّن مع الصفّ) */
  title: string;
  posterPath: string | null;
  backdropPath?: string | null;
  locale: Locale;
}) {
  /* **الخمسُ معاً**: لا شيء منها يعتمد على الآخر، **والتسلسلُ كان يضيف
     رحلةً لكلِّ واحدة** (D-071). */
  const [myRating, reviews, replies, thread, news] = await Promise.all([
    getMyRating(tmdbId, mediaType),
    getTitleReviews(tmdbId, mediaType),
    getTitleReplies(tmdbId, mediaType),
    getTitleThread(tmdbId, mediaType).catch(() => []),
    getTitleLoopzNews(tmdbId, mediaType).catch(() => []),
  ]);

  /* عدُّ ردود كلِّ رأيٍ مرّةً واحدة — **ولو بحث كلُّ صفٍّ في المصفوفة
     كلِّها صار العملُ حاصلَ ضرب** (حارسُ `TalkThread` نفسُه) */
  const replyCounts = new Map<string, number>();
  for (const r of replies)
    replyCounts.set(r.reviewUserId, (replyCounts.get(r.reviewUserId) ?? 0) + 1);

  /* **وردودُ الغرفة تُعدُّ نزولاً لا مباشرةً**: عمقُها ثلاثةٌ (الهجرة
     ٦٢)، **وردُّ الردِّ ردٌّ على المشاركة** في عين قارئها. خريطةُ
     الأبناء تُبنى مرّةً، ثم مرورٌ واحدٌ لكلِّ جذر. */
  const kids = new Map<string, string[]>();
  for (const p of thread) {
    if (!p.parentId) continue;
    const list = kids.get(p.parentId);
    if (list) list.push(p.postId);
    else kids.set(p.parentId, [p.postId]);
  }
  const descendants = (rootId: string) => {
    let n = 0;
    const stack = [...(kids.get(rootId) ?? [])];
    while (stack.length) {
      const id = stack.pop()!;
      n++;
      const more = kids.get(id);
      if (more) stack.push(...more);
    }
    return n;
  };

  const talkHref = `/talk/${mediaType}/${tmdbId}`;
  /* **صيغةُ الجملة تُقرأ مرّةً هنا** — الصفُّ يرسم ولا يركّب */
  const t = getDict(locale);

  /* **الرأيُ يظهر إن كان مكتوباً أو إن كان له ردود** — حارسُ `TalkThread`
     نفسُه: **تقييمٌ بلا كلامٍ رقمٌ لا صفّ**، وقد أُخذ متوسّطُه في
     البطاقة فوق. */
  /** **مفتاحُ الفرز يعيش هنا وحدَه** — الخطُّ يعرض ولا يرتّب */
  type Dated = FeedItem & { at: string };

  const items: Dated[] = [
    ...reviews
      .filter((r) => r.review?.trim() || replyCounts.has(r.id))
      .map((r) => ({
        kind: "review" as const,
        at: r.updated_at,
        node: (
          <TitleReviewRow
            key={`review-${r.id}`}
            r={r}
            count={replyCounts.get(r.id) ?? 0}
            tmdbId={tmdbId}
            mediaType={mediaType}
            locale={locale}
            signedIn
          />
        ),
      })),
    /* **نشرةُ الغرفة خبرٌ أيضاً** (D-400): صفٌّ في `title_posts` بـ`kind`،
       **جملتُه من `bulletinLine` ووجهتُه الغرفةُ نفسُها** — وردودُه
       تُعدُّ عليه كما تُعدُّ على أيّ مشاركة. **وبلا صيغةٍ يسقط الصفّ**
       (D-179). */
    ...thread
      .filter((p) => !p.parentId && p.kind)
      .map((p) => ({ p, line: bulletinLine(p.kind, p.data, t, locale) }))
      .filter((x): x is { p: (typeof thread)[number]; line: string } => !!x.line)
      .map(({ p, line }) => ({
        kind: "news" as const,
        at: p.createdAt,
        node: (
          <TitleNewsRow
            key={`bulletin-${p.postId}`}
            line={line}
            at={p.createdAt}
            href={talkHref}
            replies={descendants(p.postId)}
            locale={locale}
          />
        ),
      })),
    /* **ونشرتُنا المولَّدة** (`loopz_news`) — **جملتُها `newsLine`
       ووجهتُها `‎/post/[key]`**. */
    ...news
      .map((n) => ({ n, line: newsLine(n, t, locale) }))
      .filter((x): x is { n: (typeof news)[number]; line: string } => !!x.line)
      .map(({ n, line }) => ({
        kind: "news" as const,
        at: n.published_at,
        node: (
          <TitleNewsRow
            key={`news-${n.key}`}
            line={line}
            at={n.published_at}
            href={`/post/${encodeURIComponent(n.key)}`}
            source={newsSource(n)?.name ?? null}
            locale={locale}
          />
        ),
      })),
  ]
    /* **الأحدثُ أوّلاً، والمقارنةُ نصّيةٌ لا زمنيّة**: الطوابعُ كلُّها
       ISO من الخادم نفسِه، **فترتيبُ حروفها هو ترتيبُ زمنها** ولا
       `new Date()` لثلاثين صفّاً. */
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  return (
    <div>
      <TitleJoinCard
        talkHref={talkHref}
        title={title}
        locale={locale}
        composer={
          <RatingBox
            variant="review"
            tmdbId={tmdbId}
            mediaType={mediaType}
            title={title}
            posterPath={posterPath}
            backdropPath={backdropPath}
            locale={locale}
            initialRating={myRating?.rating ?? null}
            initialReview={myRating?.review ?? null}
            initialHasSpoiler={Boolean(myRating?.has_spoiler)}
          />
        }
      />

      <TitleCommunityFeed items={items} locale={locale} />
    </div>
  );
}
