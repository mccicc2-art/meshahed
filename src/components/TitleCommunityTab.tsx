import {
  getCommunityRating,
  getMyRating,
  getTitleLoopzNews,
  getTitleReplies,
  getTitleReviews,
  getTitleThread,
} from "@/lib/data";
import { type Locale } from "@/lib/i18n";
import { RatingBox } from "./RatingBox";
import { TalkReviewRow } from "./TalkThread";
import { TitleCommunityFeed, type FeedItem } from "./TitleCommunityFeed";
import { TitleJoinCard } from "./TitleJoinCard";
import { TitleNewsRow } from "./TitleNewsRow";
import { TitleTalkRow } from "./TitleTalkRow";

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
 * ⚠️ **ونشراتُ Loopz داخل الخيط تُستبعد من النقاشات** (`kind !== null`):
 * **هي أخبارٌ وبيتُها رقاقةُ الأخبار**، **وصفٌّ يظهر مرّتين في قائمةٍ
 * واحدة عطلٌ لا وفرة.**
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
  /* **الستُّ معاً**: لا شيء منها يعتمد على الآخر، **والتسلسلُ كان يضيف
     رحلةً لكلِّ واحدة** (D-071). */
  const [myRating, community, reviews, replies, thread, news] = await Promise.all([
    getMyRating(tmdbId, mediaType),
    getCommunityRating(tmdbId, mediaType),
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
          <TalkReviewRow
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
    ...thread
      .filter((p) => !p.parentId && !p.kind && p.body?.trim())
      .map((p) => ({
        kind: "talk" as const,
        at: p.createdAt,
        node: (
          <TitleTalkRow
            key={`talk-${p.postId}`}
            p={p}
            count={descendants(p.postId)}
            href={talkHref}
            locale={locale}
          />
        ),
      })),
    ...news.map((n) => ({
      kind: "news" as const,
      at: n.published_at,
      node: <TitleNewsRow key={`news-${n.key}`} n={n} locale={locale} />,
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
        avg={community.avg}
        count={community.count}
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
