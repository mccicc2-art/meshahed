/**
 * ====== عقدُ المكتبة — `GET /api/v1/me/library` ======
 *
 * صفٌّ لكلِّ عملٍ أتابعه، **بالحالة محسوبةً في الخادم** بنفس
 * `core/libraryStatus.ts` الذي يحسبها للويب — فلا يختلف «مكتمل» بين شاشتين.
 *
 * 🆕 Phase 11 · B1 — **حقولُ التكافؤ الاختياريّة** (قرارُ المراجع
 * `5576037708` على B0): الشاشةُ الأصليّةُ للمكتبة (D-936) كانت ستعرض عنواناً
 * إنجليزيّاً وملصقاً غيرَ الذي اختاره صاحبُه، فتخسر ٩٨٪ في تبويب
 * «مسلسلات» نفسِه. **كلُّها اختياريّة** (`?`) فلا تكسر عميلاً قائماً،
 * **وقيمُها من مصادر الويب نفسِها** (`localizeFollows` · `title_art` ·
 * `follows.is_anime` · `my_favorites` · كوكي التبويب) لا من مصدرٍ ثانٍ —
 * فما تراه الصفحةُ تراه الشاشة. `title`/`poster_path` تبقيان كما كانتا.
 */

import type { TitleKind } from "./tags.ts";

export type LibraryStatus = "watching" | "unstarted" | "completed" | "dropped";

export type LibraryItem = {
  kind: TitleKind;
  id: number;
  title: string;
  poster_path: string | null;
  added_at: string;
  status: LibraryStatus;
  /** مسلسل: ما شوهد / ما بُثّ. فيلم: 1/1 أو 0/1 */
  watched: number;
  aired: number;
  next_air_date: string | null;
  last_watched: string | null;
  rewatch_count: number;
  /** العنوانُ بلغة القارئ — ما تعرضه صفحةُ المكتبة حرفاً (D-048) */
  display_title?: string;
  /** الملصقُ بعد غلافِ صاحبه (`title_art`، D-131) — وإلا `poster_path` */
  display_poster_path?: string | null;
  /** `null` = لم يُصنَّف بعد (الويبُ يسأل عنه عند أوّل فتحٍ لتبويب «أنمي») */
  is_anime?: boolean | null;
  is_favorite?: boolean;
};

/**
 * التبويباتُ الخمسة — 🆕 D-947: **كانت ثلاثةً** (B0 §٣.١ V1، نطاقُ B)
 * **وصارت الخمسةَ كلَّها** بحكم أحمد («كمّل بناءَ المكتبة بالكامل»):
 * «فنّانون» و«قوائم» لهما مساراهما تحت `/api/v1/me/library/*`.
 */
export type LibraryTab = "shows" | "movies" | "anime" | "artists" | "lists";

export type LibraryPayload = {
  items: LibraryItem[];
  /** عدُّ كلِّ حالةٍ — للرقاقات في أعلى الشاشة بلا مرورٍ ثانٍ على القائمة */
  counts: Record<LibraryStatus, number>;
  /** التبويبُ الافتراضيُّ من تفضيل صاحبه (`tabPrefs`) — `shows` بلا كوكي */
  default_tab?: LibraryTab;
  /**
   * 🆕 D-947 — **شريطُ التبويبات كما يرسمه الويب** (`applyTabPrefs`):
   * ترتيبُ صاحبه، والمخفيُّ يُعلَم لا يُحذف (المفتوحُ لا يُخفى من نفسه —
   * الشاشةُ تطبّق ذلك). **العدّادان** لتبويبَي «فنّانون» و«قوائم» بالوصفة
   * نفسِها (`getFollowedArtists(60).length` · `lists + saved`).
   */
  tabs?: { key: LibraryTab; hidden: boolean }[];
  artist_count?: number;
  list_count?: number;
  /** كم عملاً لم يُصنَّف أنمياً بعد — الشاشةُ تطلق `classify-anime` مرّةً كالويب */
  anime_unknown?: number;
  /** الصفوفُ المخفيّة كاملةً بمفاتيح `tab:key` (D-874) — من الكوكي */
  hidden_rails?: string[];
  plus?: boolean;
};

/** 🆕 D-947 — `GET /api/v1/me/library/artists`: رفُّ الفنّانين (`getArtistShelf(60)`) */
export type LibraryArtist = {
  person_id: number;
  name: string | null;
  profile_path: string | null;
  /** «شاهدتَ له N أعمال» — يغيب عند الصفر (D-219) */
  watched_works: number;
};
export type LibraryArtistsPayload = { items: LibraryArtist[] };

/**
 * 🆕 D-947 — بطاقةُ قائمةٍ كما يرسمها `ListCardShell` (D-677): **حقولُ
 * `PublicListCard` التي تصل البطاقةَ فعلاً** + ما تحسبه `ListManager`
 * لقوائمي (`count_label` · `cover`). `owner` غائبٌ لقوائمي، ولمخفي الاسم.
 */
export type LibraryListCard = {
  id: string;
  name: string;
  kind: string | null;
  owner: string | null;
  owner_avatar: string | null;
  item_count: number;
  posters: string[];
  saves: number;
  reviews: number;
  rating: number | null;
  /** «تمتلئ وحدَها» أو «N مسلسلاً · M فيلماً» — وإلّا `listCount` */
  count_label: string | null;
  /** خلفيّةُ الغلاف المختار (`w780`) — تحلّ محلَّ الملصقات */
  cover: string | null;
  mine: boolean;
  is_public: boolean;
  /** رايةُ التشغيل — `null` = لا نعرف فلا مفتاحَ (D-217) */
  playlist: boolean | null;
  /** أستطيع الحفظ/إلغاءه (قائمةُ غيري) و«هل حفظتُها» */
  can_save: boolean;
  saved_by_me: boolean;
  /** D-948 — بابُ التقييم (قائمةٌ عامّةٌ ليست لي) ورأيي القائم — كـ`ListRateStar` */
  can_review?: boolean;
  my_review?: { rating: number; body: string | null; has_spoiler: boolean } | null;
};

export type LibraryAutoGroup = {
  kind: "director" | "actor";
  name: string;
  photo: string | null;
  items: { key: string; media_type: TitleKind; tmdb_id: number; title: string; poster: string | null }[];
};

/** 🆕 D-947 — `GET /api/v1/me/library/lists`: تبويبُ «قوائم» كلُّه في ردٍّ واحد */
export type LibraryListsPayload = {
  lists: LibraryListCard[];
  /** بطاقةُ «للمشاهدة» (D-559) — `null` = طابورٌ فارغٌ فلا بطاقة (D-219).
      D-948: `items` الطابورُ كاملاً بترتيب صاحبه لورقة الترتيب (`ReorderItem`) */
  to_watch: { on: boolean; count: number; posters: (string | null)[]; items: QueueItem[] } | null;
  saved: LibraryListCard[];
  saved_count: number;
  auto_groups: LibraryAutoGroup[];
  plus: boolean;
  has_smart: boolean;
};

export type QueueItem = { key: string; title: string; poster_path: string | null; media_type: TitleKind };

/** أجسامُ الكتابات التي يحتاجها تبويبُ «قوائم» أصليّاً (D-947 · D-948) */
export type ListReviewBody = { listId: string; rating: number; body?: string | null; hasSpoiler?: boolean };
export type ListReviewDeleteBody = { listId: string };
export type QueueOrderBody = { row: "continue" | "towatch" | "lists" | "towatchlist"; keys: string[] };
export type SmartListBody = { name: string; rule: Record<string, string> };
export type CreateListBody = { name: string };
export type ListPlaylistBody = { listId: string; on: boolean };
export type SaveListBody = { listId: string; save: boolean };
export type ToWatchBody = { on: boolean };
export type HiddenRailsBody = { keys: string[] };
