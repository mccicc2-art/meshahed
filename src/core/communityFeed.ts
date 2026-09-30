import { commentViewKey } from "./postKeys.ts";

/**
 * ====== ترشيحُ خطّ «مجتمعي» وترتيبُه — نصٌّ واحدٌ لسطحين (Phase 11-M · M0) ======
 *
 * 🔑 **كان هذا كلُّه داخل `ActivityFeed`** (D-283/D-306/D-629/D-900) — والمكوّنُ عميلُ عرضٍ
 * لا يستورده خادمُ `/api/v1/community`. **ونسخُه في التطبيق نسخةٌ ثانيةٌ تفترق عند أوّل
 * تعديلٍ في صيغة أحمد** («كل لايك ينقص من وقته نص ساعة وكل رد ساعة») — فخرج إلى النواة
 * حرفاً، والويبُ والبابُ يقرآنه (القاعدة ٦، نهجُ `homeCore` في 11-H).
 *
 * ⚠️ **لا سلوكَ جديداً هنا**: الترشيحُ والفرزان منقولان كما كانا، والتعليقُ الكاملُ لكلِّ
 * قرارٍ باقٍ عند موضعه الأوّل في `ActivityFeed.tsx` (تاريخُ الملفّ).
 * ⚠️ **وخبرٌ بلا صيغةٍ يُسقَط قبل الدخول** (`newsLine` يحتاج القاموس) — المستدعي يرشّحه.
 */

/** ما يلزم الترتيبَ من صفِّ الرأي — أضيقُ من `FeedItem` كي تُختبر النواةُ بلا `lib` */
export type FeedCommentLike = {
  person: { id: string };
  media_type: "tv" | "movie";
  tmdb_id: number;
  review: string | null;
  updated_at: string;
  likes?: number;
};

/** ما يلزمه من خبرِ لوبز */
export type FeedNewsLike = {
  key: string;
  media_type: "tv" | "movie";
  tmdb_id: number;
  published_at: string;
};

export type FeedSort = "smart" | "latest" | "top";

export type OrderedFeedRow<C, N> =
  | { at: number; kind: "comment"; item: C }
  | { at: number; kind: "news"; item: N };

/** «كل لايك ينقص من وقته نص ساعة وكل رد ساعة» (D-283) — ⚠️ متروكٌ منذ D-1207 (لا قارئَ له) ويبقى لتاريخ D-283 */
export const FEED_LIKE_MS = 30 * 60 * 1000;
export const FEED_REPLY_MS = 60 * 60 * 1000;

/**
 * 🆕 D-1207 — **نافذةُ «الأكثر تفاعلاً»: آخرُ ٣٠ يوماً** (أحمد ٣٠ سبتمبر: «خليها موست اكتف لاخر شهر … حتى النقاش»).
 * كانت `smart` «الأحدث مع دفعةٍ لكلِّ إعجابٍ وردّ» (D-283) — صارت **عدّاً خالصاً داخل النافذة**: ما نُشر في آخر ٣٠ يوماً يُرتَّب
 * بإعجاباته وردوده (والتعادلُ بالأحدث)، وما هو أقدمُ يأتي تحته بالأحدث — **فلا يفرغ الخطّ**. وإن لم يتفاعل أحدٌ داخل النافذة كلِّها
 * فالخطُّ بالأحدث **ويُقال ذلك** (`report.quiet` ⇐ سطرٌ خافت) — لا ترتيبٌ يتطابق مع «الأحدث» فيبدو معطّلاً.
 * القيمةُ المخزّنة تبقى `smart` (الكوكي `loopz_feed_sort`) — الاسمُ على الشاشة «الأكثر تفاعلاً».
 * ⚖️ النافذةُ هنا **بتاريخ المنشور** (الإعجاباتُ مجموعٌ لا تواريخ) — وفي «النقاشات» بتاريخ التفاعل نفسِه (الهجرة ١٩٢).
 */
export const ACTIVE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export function orderCommunityFeed<C extends FeedCommentLike, N extends FeedNewsLike>(o: {
  comments: readonly C[];
  /** أخبارٌ لها سطرٌ بلغة القارئ — المرشَّحةُ بـ`newsLine` سلفاً */
  news: readonly N[];
  /** فارغٌ للزائر */
  meId: string;
  followingIds?: ReadonlySet<string>;
  showStrangers: boolean;
  sort: FeedSort;
  /** ردودُ الآراء بمفتاح `commentViewKey` */
  reviewReplies?: ReadonlyMap<string, number>;
  /** إعجاباتُ الأخبار بمفتاح `<media>-<tmdb>` */
  newsLikes?: Readonly<Record<string, number>>;
  /** ردودُ الأخبار بمفتاح المنشور */
  newsReplies?: ReadonlyMap<string, number>;
  /** 🆕 D-1207 — «الآن» للنافذة (الاختباراتُ تثبّته) */
  now?: number;
  /** 🆕 D-1207 — يُملأ مع `smart`: `quiet` ⇐ لا تفاعلَ في النافذة كلِّها فالخطُّ بالأحدث */
  report?: { quiet: boolean };
}): OrderedFeedRow<C, N>[] {
  /* المكتوبُ وحدَه يدخل — «شاهد» و«قيّم بلا نصّ» أحداثٌ بلا كلام */
  const rows: OrderedFeedRow<C, N>[] = [
    ...o.comments
      .filter((a) => a.review?.trim())
      .map((item) => ({ at: Date.parse(item.updated_at) || 0, kind: "comment" as const, item })),
    ...o.news.map((item) => ({ at: Date.parse(item.published_at) || 0, kind: "news" as const, item })),
  ].sort((a, b) => b.at - a.at);

  /* D-900: المفتاحُ هو الحكم — مفتوحٌ ⇒ المجتمعُ كلُّه؛ مغلقٌ ⇒ دائرتُك وحدَها.
     والزائرُ خارج الترشيح (D-629). */
  const guest = !o.meId;
  let shown =
    guest || o.showStrangers
      ? rows
      : rows.filter(
          (r) =>
            r.kind === "news" ||
            r.item.person.id === o.meId ||
            (o.followingIds?.has(r.item.person.id) ?? false),
        );

  const cKey = (c: FeedCommentLike) => commentViewKey(c.person.id, c.media_type, c.tmdb_id);
  const nKey = (n: FeedNewsLike) => `${n.media_type}-${n.tmdb_id}`;

  /* العدُّ الخالص: إعجاباتٌ + ردود — «الأكثر تفاعلاً» للعضو و«الأفضل» للزائر يعدّان به */
  const heat = (r: OrderedFeedRow<C, N>): number =>
    r.kind === "comment"
      ? (r.item.likes ?? 0) + (o.reviewReplies?.get(cKey(r.item)) ?? 0)
      : (o.newsLikes?.[nKey(r.item)] ?? 0) + (o.newsReplies?.get(r.item.key) ?? 0);

  /* 🆕 D-1207 — «الأكثر تفاعلاً»: عدٌّ داخل نافذة الشهر، والأقدمُ تحته بالأحدث (`shown` مرتّبٌ بالأحدث سلفاً) */
  if (o.sort === "smart") {
    const since = (o.now ?? Date.now()) - ACTIVE_WINDOW_MS;
    const inWin = shown.filter((r) => r.at >= since);
    const hot = inWin.some((r) => heat(r) > 0);
    if (o.report) o.report.quiet = !hot;
    if (hot) {
      const older = shown.filter((r) => r.at < since);
      shown = [...inWin.sort((a, b) => heat(b) - heat(a) || b.at - a.at), ...older];
    }
  }
  /* «الأفضل» للزائر (D-629): عدٌّ خالصٌ والأحدثُ يفصل التعادل */
  if (o.sort === "top") {
    shown = [...shown].sort((a, b) => heat(b) - heat(a) || b.at - a.at);
  }
  return shown;
}

/**
 * 🔑 **جردُ أنواع البطاقات** (خطّة 11-M §٧: «نوعٌ يُنسى يختفي من الخطّ بلا خطأ»).
 * `FeedKind` في `lib/data` و`LoopzNewsItem.kind` — **والاختبارُ يقارن هذه القائمة بهما
 * نصّاً**، فنوعٌ يُضاف هناك ولا يُضاف هنا يكسر `npm test` قبل أن يصل التطبيق. والتطبيقُ
 * يرسم ما لا يعرفه بطاقةً عامّةً لا يُسقطه.
 */
export const FEED_COMMENT_KINDS = ["rate", "movie", "episodes", "add", "list_review"] as const;
export const FEED_NEWS_KINDS = [
  "trailer",
  "date",
  "season",
  "status",
  "season_date",
  "theatrical",
  "released",
  "chart",
  "provider",
  "report",
] as const;

/**
 * 🆕 **صفوفُ قسمٍ من لوحة «الناس»** — كانت في `PeopleLeaderboard` (D-216/D-264)؛ خرجت كي
 * يعيد البابُ القسمَ مقصوصاً كما يُرسم. «الصاعدون» بالفرق ومن لم يصعد لا يظهر؛ «الأكثر»
 * و«المميّزون» بالمجموع.
 */
export function boardRows<R extends { total: number; prevTotal: number }>(
  rows: readonly R[],
  mode: "top" | "rising" | "featured",
  limit: number,
): R[] {
  return mode === "rising"
    ? rows
        .map((r) => ({ r, delta: r.total - r.prevTotal }))
        .filter((x) => x.delta > 0)
        .sort((a, b) => b.delta - a.delta)
        .slice(0, limit)
        .map((x) => x.r)
    : [...rows].sort((a, b) => b.total - a.total).slice(0, limit);
}
