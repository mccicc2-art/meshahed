/**
 * ====== عقدُ «النقاش» في التطبيق — `GET /api/v1/thread` وأفعالُه (Phase 11-M · M3) ======
 *
 * 🔑 **شاشةٌ واحدةٌ لثلاثة أبواب** (خطّة §٣): غرفةُ العمل `/talk/{kind}/{id}` · منشورُ لوبز `/post/{key}` ·
 * الرأيُ `/review/{kind}/{id}/{user}` — **والرابعُ (مراجعاتُ القائمة) أصليٌّ منذ L2 في `ListScreen`**. الرأسُ يختلف،
 * والخيطُ واحد: `ThreadReplies`/`ReplyItem` في الويب بقواعدها (العمقُ ٣ في الغرفة · ردٌّ واحدٌ تحت الجذر في الباقي ·
 * القلبُ والتصويتُ للغرفة · الصورةُ والـGIF و«فيها حرق» للغرفة).
 *
 * 🔑 **الحمولةُ تصل مصوغة** (نهجُ D-1172): سطرُ النشرة وتقييمُها ومحجوبُها بلغة القارئ (`bulletinLine` · `bulletinFacts` ·
 * `bulletinSpoiler`)، والترجمةُ الدفعيّة، والصورةُ رابطاً آمناً (`https://` وحدَه) — **والتطبيقُ يرسم ولا يصوغ.**
 * **والترتيبُ وحدَه يُحسب في الطرفين** (`orderThread` في `core/threadOrder.ts`) لأنّ الردَّ المتفائلَ يُدرج قبل رحلة الخادم.
 */
import type { PersonLite } from "../people.ts";

export type ThreadKind = "talk" | "post" | "review";

/** سطرٌ في الخيط — `ThreadReply` الويب مصوغاً */
export type ThreadRow = {
  id: string;
  /** الكاتبُ بشاراته (`id` هنا معرّفُ الكاتب لا الردّ) */
  person: PersonLite;
  parent_id: string | null;
  body: string;
  created_at: string;
  mine: boolean;
  /** نشرةُ لوبز (D-261): السطرُ مصوغاً، و`null` لكلام البشر */
  bulletin: string | null;
  /** تقييمُ الحلقة `9.9` — يغيب على الصفر (D-219) */
  bulletin_vote: string | null;
  /** النثرُ المحجوبُ تحت النشرة بلغة القارئ */
  bulletin_spoiler: string | null;
  /** أعلن كاتبُه أنّ فيه حرقاً (D-268) */
  has_spoiler: boolean;
  /** صورةٌ مرفوعة — `https://` وحدَه (D-298) */
  image: string | null;
  /** معرّفُ Giphy لا رابط (D-362) — الرابطُ يُبنى من `gifUrl` */
  gif_id: string | null;
  /** ترجمتُه بلغة القارئ إن فُعّلت (D-307) */
  translated: string | null;
  likes: number;
  liked_by_me: boolean;
  score: number;
  my_vote: -1 | 0 | 1;
};

/** رأسُ الصفحة — العملُ في الثلاثة (الغلافُ والملصقُ والاسمُ بلغة القارئ) وما يخصّ كلَّ باب */
export type ThreadWork = {
  tmdb_id: number;
  media_type: "tv" | "movie";
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  /** تقييمُ المجتمع (`getCommunityRating`) — `count = 0` لا يُرسم */
  community: { avg: number; count: number };
};

export type ThreadHead =
  | {
      kind: "talk";
      overview: string;
      watched: boolean;
      in_library: boolean;
    }
  | {
      kind: "post";
      key: string;
      line: string;
      source: { name: string; url: string | null } | null;
      published_at: string;
      views: number;
      likes: number;
      liked_by_me: boolean;
    }
  | {
      kind: "review";
      author: PersonLite;
      rating: number | null;
      review: string | null;
      has_spoiler: boolean;
      updated_at: string;
      views: number;
      likes: number;
      liked_by_me: boolean;
      mine: boolean;
    };

export type ThreadPayload = {
  /** `me` = اسمي وصورتي لسطر الردّ المتفائل قبل أن يعود الخادمُ بصاحبه (`getMyProfileLite`) */
  viewer: { signed_in: boolean; me_id: string | null; me: { name: string; avatar: string | null } | null };
  work: ThreadWork;
  head: ThreadHead;
  rows: ThreadRow[];
  /** غرفةٌ متداخلةٌ بعمق ٣ (`talk`) أم ردٌّ تحت جذرٍ واحد */
  nested: boolean;
  /** القلوبُ والأصواتُ للغرفة وحدَها (`likes`/`votes` في الويب) */
  has_likes: boolean;
  has_votes: boolean;
  /** الرابطُ العامُّ للمشاركة — الويبُ صاحبُه (D-221) */
  share_path: string;
};

/** الهدفُ الذي يُكتب عليه — `ReplyTarget` الويب بلا المراجعة القائمة (أصليّةٌ في `ListScreen`) */
export type ThreadTarget =
  | { kind: "talk"; tmdb_id: number; media_type: "tv" | "movie" }
  | { kind: "post"; key: string }
  | { kind: "review"; user_id: string; tmdb_id: number; media_type: "tv" | "movie" };

/** `POST /api/v1/thread/reply` */
export type ThreadReplyBody = {
  target: ThreadTarget;
  body: string;
  parent_id?: string | null;
  /** للغرفة وحدَها — والخادمُ يُسقطها لغيرها */
  has_spoiler?: boolean;
  image_url?: string | null;
  gif_id?: string | null;
};
/** والكاتبُ كما يُرسم (`replyAuthor`) — يستبدل السطرَ المتفائلَ بصاحبه الحقيقيّ (D-241) */
export type ThreadReplyResult = {
  reply_id: string;
  created_at: string;
  author: { nickname: string | null; username: string | null; avatar_url: string | null; hide_name: boolean };
} | null;

/** `POST /api/v1/thread/delete` · `/report` — ردّي أو ردٌّ يُبلَّغ عنه؛ و`what: "review"` بلاغٌ على الرأي نفسِه */
export type ThreadRowBody = { target: ThreadTarget; reply_id: string };
export type ThreadReportBody = { target: ThreadTarget; reply_id?: string; what?: "reply" | "review" };

/** `POST /api/v1/thread/like` · `/vote` — منشوراتُ الغرفة وحدَها */
export type ThreadLikeBody = { post_id: string; on: boolean };
export type ThreadVoteBody = { post_id: string; vote: -1 | 0 | 1; tmdb_id: number; media_type: "tv" | "movie" };

/** `POST /api/v1/thread/image` (multipart) — رابطُ الصورة العامّ من مخزننا (نمطُ `Composer`) */
export type ThreadImagePayload = { url: string };

/** `GET /api/v1/gif?q=&offset=` — معرّفاتٌ لا روابط (D-362)، والتطبيقُ يبني `webp` من القالب */
export type GifHitLite = { id: string; ratio: number; alt: string };
export type GifPayload = { hits: GifHitLite[]; next: number | null };
