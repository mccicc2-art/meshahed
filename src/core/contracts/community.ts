/**
 * ====== عقدُ «المجتمع» في التطبيق — `GET /api/v1/community` + `/community/people` ======
 *
 * 🆕 Phase 11-M · M0 — **حمولةُ الصفحة الثلاثيّة كما يقرؤها الخادمُ اليوم** («مجتمعي» ·
 * «الأعمال» · «الناس»)، من `lib/communityCore.ts` نفسِها التي ترسم `/people` — لا نسخةٌ ثانية.
 *
 * 🔑 **الخطُّ يصل مرشَّحاً ومرتَّباً** (`orderCommunityFeed` — D-283/D-306/D-629/D-900)،
 * **وكلُّ صفٍّ يحمل ما يرسمه** (الترجمة · الردود · المشاهدات · حالةُ مكتبتي · قلوبُ القائمة)
 * — فالتطبيقُ لا يحسب صيغةً ولا يعيد ترتيباً. **وسطرُ الخبر مركَّبٌ بلغة القارئ** (`newsLine`)
 * كما في عقد صفحة العمل.
 *
 * 🔑 **لا قصَّ في الخطّ**: الويبُ يقصّ عشرين للرسم الخادميّ (D-884) لأنّ الوثيقةَ تتضخّم؛
 * التطبيقُ يرسم بقائمةٍ افتراضيّة فيأخذ الخطَّ كلَّه.
 *
 * ⚠️ **أنواعُ البطاقات** (`kind` الرأي و`item.kind` الخبر) جردُها في `core/communityFeed.ts`
 * ومختبَرٌ ضدّ `lib/data` — ونوعٌ مجهولٌ يرسمه التطبيقُ بطاقةً عامّةً لا يُسقطه.
 */

import type { TabPref } from "../tabPrefs.ts";
import type { PersonLite } from "../people.ts";
import type { BoardSection, CommunityPagerTab } from "../communityParams.ts";
import type { LibraryListCard } from "./library.ts";

/** حالةُ مكتبتي لعمل البطاقة — خيطُ الملصق الأربعيّ (D-322/D-850) */
export type CommunityLibState = { added: boolean; watched: boolean; progress: number; dropped: boolean };

/** صفُّ رأيٍ — `FeedItem` كما في `lib/data` */
export type CommunityFeedItem = {
  person: PersonLite;
  kind: string;
  tmdb_id: number;
  media_type: "tv" | "movie";
  rating: number | null;
  review: string | null;
  title: string | null;
  poster_path: string | null;
  updated_at: string;
  day: string;
  episodeCount: number;
  topSeason: number;
  likes: number;
  likedByMe: boolean;
  hasSpoiler: boolean;
  listId?: string | null;
  listSlug?: string | null;
  listCover?: string | null;
};

/** خبرُ لوبز — `LoopzNewsItem` كما في `lib/data` */
export type CommunityNewsItem = {
  key: string;
  kind: string;
  tmdb_id: number;
  media_type: "tv" | "movie";
  title: string;
  poster_path: string | null;
  data: Record<string, string | number> | null;
  published_at: string;
};

export type CommunityFeedRow =
  | {
      kind: "comment";
      /** مفتاحُ الرسم — `c-<person>-<list|media-tmdb>-<day>` كالويب */
      key: string;
      /** `commentViewKey` — للإعجاب والمشاهدات والتعليق */
      view_key: string;
      item: CommunityFeedItem;
      /** ترجمتُه بلغة القارئ إن فُعّلت ولم يكن فيه حرق (D-307/D-315) */
      translated: string | null;
      replies: number;
      /** `null` = الخانةُ مخفيّة (قبل الهجرة ٧٤ أو فشلُ القراءة) */
      views: number | null;
      i_follow_them: boolean;
      lib: CommunityLibState;
      /** قلوبُ رأي القائمة وردودُه (D-370) — لصفوف القوائم وحدَها */
      list_social: { likes: number; replies: number; liked_by_me: boolean } | null;
    }
  | {
      kind: "news";
      key: string;
      view_key: string;
      item: CommunityNewsItem;
      /** الجملةُ بلغة القارئ (`newsLine`) */
      line: string;
      /** مصدرُ البلاغ (`newsSource`) — لنوع `report` وحدَه */
      source: { name: string; url: string | null } | null;
      likes: number;
      liked_by_me: boolean;
      replies: number;
      views: number | null;
      lib: CommunityLibState;
    };

/** غرفةُ نقاش — `TalkRoom` كما في `lib/data`، والاسمُ بلغة القارئ (D-273) */
export type CommunityRoom = {
  tmdbId: number;
  mediaType: "tv" | "movie";
  title: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  posts: number;
  postsWeek: number;
  /** 🆕 D-1201 — إعجاباتُ الأسبوع على مشاركات الغرفة («الأكثر تفاعلاً» — صفرٌ قبل الهجرة ١٩٢) */
  likesWeek: number;
  /** 🆕 D-1201 — العملُ في مكتبتي (شريحةُ «أعمالي») — الشاشةُ تُرشِّح في يدها بلا جلب */
  mine: boolean;
  lastAt: string;
  faces: PersonLite[];
  bulletin: Record<string, unknown> | null;
  /** 🆕 سطرُ النشرة بلغة القارئ (`bulletinLine`) — `null` بلا نشرة */
  bulletin_line: string | null;
  /** درجةُ التثبيت: ٢ لوبز · ١ أنا · ٠ (D-301/D-314) */
  pin: 0 | 1 | 2;
};

export type CommunityLeaderRow = PersonLite & { posts: number; reviews: number; total: number; prevTotal: number };
export type CommunityTopReview = PersonLite & {
  tmdbId: number;
  mediaType: "tv" | "movie";
  title: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  review: string;
  rating: number;
  likes: number;
  createdAt: string;
  hasSpoiler: boolean;
};
/** بطاقةُ قائمة — شكلُ بطاقة المكتبة نفسُه (`toLibraryListCard`، D-068) فترسمها `ListCard` الأصليّةُ كما في «اكتشف» */
export type CommunityListCard = LibraryListCard;

/** لوحةُ «الناس» — كلُّ قسمٍ مقصوصٌ كما يُرسم (`boardRows`)، و`null` = مطفأٌ بـ«الصفوف المخفيّة» (D-874) */
export type CommunityBoard = {
  featured: CommunityLeaderRow[] | null;
  top: CommunityLeaderRow[] | null;
  reviews: CommunityTopReview[] | null;
  talked_about: CommunityRoom | null;
  lists: CommunityListCard[] | null;
  rising: CommunityLeaderRow[] | null;
  /** الأقسامُ كلُّها فارغة ⇒ جملةُ `peopleTabEmpty` (D-181) */
  empty: boolean;
};

/** تفضيلاتُ ورقة الأدوات — تُكتب بـ`POST /api/v1/me/prefs/community` و`/me/prefs/tabs` */
export type CommunityPrefs = {
  strangers: boolean;
  sort: "smart" | "latest";
  /** شريحةُ «أعمالي» في «النقاشات» (كانت مفتاحَ الأدوات «أعمالي المتابَعة فقط» — D-306 ⇐ D-1201) */
  talk_followed: boolean;
  /** 🆕 D-1201 — ترتيبُ «النقاشات» */
  talk_sort: "latest" | "active";
  translate: boolean;
  /** ترتيبُ التبويبات وإخفاؤها (سطح `community`) */
  tabs: TabPref[];
  /** الصفوفُ المخفيّة كاملةً (`tab:key`) — كما يمرّرها الويبُ إلى اللوح */
  hidden_rails: string[];
};

export type CommunityPayload = {
  viewer: { signed_in: boolean; me_id: string | null; admin: boolean };
  /** التبويباتُ الظاهرة بترتيب صاحبها، والمفتوحُ أوّلاً (`defaultTab` — جوابُ أحمد ٢٨ سبتمبر) */
  tabs: { visible: CommunityPagerTab[]; initial: CommunityPagerTab };
  /** `null` للزائر — لا ورقةَ أدواتٍ له (D-629) */
  prefs: CommunityPrefs | null;
  feed: {
    rows: CommunityFeedRow[];
    /** «الأفضل» للزائر · تفضيلُ العضو له (D-629) */
    sort: "smart" | "latest" | "top";
    empty_text: string;
    /** أتابع حسابَ لوبز؟ — لصفّ المتابعة في بطاقة الخبر */
    follow_loopz: boolean;
  };
  rooms: CommunityRoom[];
  board: CommunityBoard;
  following_ids: string[];
};

/** `GET /api/v1/community/people?all=<قسم>` — «عرض الكل»: قسمٌ واحدٌ بعشرة (D-264) */
export type CommunityPeopleAllPayload = {
  section: BoardSection;
  leaders: CommunityLeaderRow[] | null;
  reviews: CommunityTopReview[] | null;
  lists: CommunityListCard[] | null;
  empty: boolean;
  following_ids: string[];
  me_id: string | null;
};
