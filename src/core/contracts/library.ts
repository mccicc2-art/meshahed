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
import type { TourState } from "../tour.ts";

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
  /** 🆕 D-1280 — موقوفٌ مؤقّتاً (`follows.watch_state = 'paused'`): علامةٌ على الملصق و«كمّل» في القائمة */
  paused?: boolean;
  /** 🆕 T492 — أوّلُ حلقةٍ معروضةٍ لم تُشاهد (`nextUnwatchedEpisode`، وصفةُ «تابِع المشاهدة» نفسُها): قرصُ «S2 E6» على
      بطاقة المكتبة بدل عدد الباقي. `null` = لا تُعرف (تفاصيلٌ تأخّرت) فلا قرص؛ وخادمٌ أقدم لا يرسل الحقلَ أصلاً */
  next_ep?: { s: number; e: number } | null;
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
  /** 🆕 D-954 — التلميحاتُ المقروءةُ في الحساب (`profiles.ui_state.hints`): الشاشةُ
   *  تُخفي ما قُرئ على أيِّ جهاز (حكمُ أحمد ١٩ أغسطس: التلميحُ شأنُ حسابٍ لا جهاز) */
  hints?: string[];
  /**
   * 🆕 D-1318 — حالةُ الجولة في الحساب (`profiles.ui_state.tour`) **بعد `liveTour`**: `null` = لم
   * تُعرَض عليه جولةُ هذا الإصدار. التطبيقُ يقرؤها ليعرض الاقتراحَ ويستأنف (T1). اختياريٌّ:
   * حمولةٌ محفوظةٌ من قبل لا تحمله — وغيابُه «لا أعرف» لا «لم تُعرَض».
   */
  tour?: TourState | null;
};

/**
 * `POST /api/v1/me/prefs/ui-state` — تعليمُ تلميحاتٍ مقروءةً (اتّحادٌ في الخادم)، **و🆕 تقدّمُ الجولة**
 * (D-1318). كلاهما اختياريٌّ: طلبٌ يحمل أحدَهما لا يمسّ الآخر.
 */
export type UiStateBody = { addHints?: string[]; tour?: TourState; /** 🆕 T606 */ week?: { cinema: boolean; taste: boolean } };

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
  /** 🆕 249 — عددُ المعجبين (القلبُ صار إعجاباً). اختياريٌّ لترتيب الكوميتات (D-028) */
  likes?: number;
  reviews: number;
  rating: number | null;
  /** «تمتلئ وحدَها» أو «N مسلسلاً · M فيلماً» — وإلّا `listCount` */
  count_label: string | null;
  /** خلفيّةُ الغلاف المختار (`w780`) — تحلّ محلَّ الملصقات */
  cover: string | null;
  /**
   * 🆕 T474 — **قائمةُ الحدث المثبَّتة** («طريقك إلى Avengers: Doomsday»): ملصقُ الحدث يأخذ أوضحَ خانةٍ في الملصقات وعليه شارةُ
   * العدّ الصفراء («27 يوماً»)، وسطرُ العدّ يعود «16 عملاً» وحدَه. اختياريٌّ: الغيابُ = بطاقةٌ عاديّة، والتطبيقُ الأقدمُ يتجاهله.
   */
  event?: { poster: string | null; badge: string };
  mine: boolean;
  is_public: boolean;
  /** رايةُ التشغيل — `null` = لا نعرف فلا مفتاحَ (D-217) */
  playlist: boolean | null;
  /** أستطيع الحفظ/إلغاءه (قائمةُ غيري) و«هل حفظتُها» */
  can_save: boolean;
  saved_by_me: boolean;
  /** 🆕 249 — «أأعجبتني؟» — شرطُ الإعجاب شرطُ الحفظ (`can_save`) */
  liked_by_me?: boolean;
  /** D-948 — بابُ التقييم (قائمةٌ عامّةٌ ليست لي) ورأيي القائم — كـ`ListRateStar` */
  can_review?: boolean;
  my_review?: { rating: number; body: string | null; has_spoiler: boolean } | null;
  /** 🆕 D-952 — مصدرُ شرط القائمة الذكيّة (قوائمي وحدَها): `library` يفتح بابَ
   *  التعديل `/library?edit=<id>` (D-876)، `catalog` يعدَّل في اكتشف من صفحتها */
  smart_source?: "library" | "catalog" | null;
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
/** 🆕 T450 — صفحةُ «قائمة جديدة»: المعاينةُ الحيّة للقائمة الذكيّة، والإنشاءُ بالأعمال والتفاصيل دفعةً واحدة */
export type SmartPreviewBody = { rule: Record<string, string>; source: "catalog" | "library" };
export type SmartPreviewItem = { id: number; kind: TitleKind; title: string; poster_path: string | null };
export type SmartPreviewResult = { items: SmartPreviewItem[]; count: number };
export type SmartListCreateBody = { name: string; rule: Record<string, string>; source: "catalog" | "library" };
export type NewListItem = { tmdbId: number; mediaType: TitleKind; title: string; posterPath: string | null };
export type CreateListFullBody = {
  name: string;
  subtitle?: string | null;
  isPublic: boolean;
  kind: "regular" | "ranked" | "watch_order";
  playlist: boolean;
  items: NewListItem[];
};
/**
 * 🆕 T450 — عملٌ في اختيار «قائمة جديدة»: ما يلزم لرقائق المصدر (`status` · `last`) وفلاتره (`genres` · `year` ·
 * `my` · `anime`) **فتُصفّى في الجهاز بلا رحلة**. `last` آخرُ نشاطٍ عليه (آخرُ حلقةٍ أو تاريخُ الإضافة).
 */
export type PickerItem = {
  id: number;
  kind: TitleKind;
  title: string;
  poster_path: string | null;
  status: "watching" | "unstarted" | "completed" | "dropped";
  last: string;
  genres: number[];
  year: number | null;
  my: number | null;
  anime: boolean;
};
export type PickerPayload = { items: PickerItem[] };
/** 🆕 T454 — اختيارُ الكتالوج (`GET /api/v1/lists/catalog?src=&type=&g=&era=&rate=&q=&n=`) — `more` = بقي ما يُحمَّل بـ«المزيد» */
export type CatalogPickerPayload = { items: SmartPreviewItem[]; more: boolean };
/** إضافةُ دفعةٍ إلى قائمةٍ قائمة (زرُّ «أضف أعمالاً» يفتح الاختيارَ نفسَه) */
export type ListAddItemsBody = { listId: string; items: NewListItem[] };
export type ListPlaylistBody = { listId: string; on: boolean };
/** 🆕 D-1037 — كتاباتُ مالك القائمة من الشاشة الأصليّة (L2)؛ كلُّها فوق دوالّ الويب القائمة */
export type ListUpdateBody = { listId: string; name: string; isPublic: boolean; subtitle?: string | null; kind?: "regular" | "ranked" | "watch_order" };
export type ListDeleteBody = { listId: string };
export type ListReorderBody = { listId: string; keys: string[] };
export type ListCoverBody = { listId: string; tmdbId: number | null; mediaType: "tv" | "movie" | null; backdropPath: string | null };
/** 🆕 D-1038 — القلبُ والردُّ على رأيٍ في قائمة */
export type ListReviewLikeBody = { listId: string; reviewUserId: string; liked: boolean };
export type ListReviewReplyBody = { listId: string; reviewUserId: string; body: string; parentId?: string | null };
export type ListReplyDeleteBody = { listId: string; replyId: string };
export type ListReplyRow = { reply_id: string; review_user_id: string; parent_id: string | null; name: string; username: string | null; avatar_url: string | null; body: string; created_at: string; mine: boolean };
export type SaveListBody = { listId: string; save: boolean };
/** 🆕 249 — `POST /api/v1/lists/like`: إعجابٌ بقائمةِ غيري أو سحبُه (منفصلٌ عن الحفظ). والنسخُ أُزيل مع بابه */
export type LikeListBody = { listId: string; like: boolean };
/** 🆕 234 — `POST /api/v1/lists/members`: دعوةٌ (صاحبُها) · ردٌّ على دعوة (المدعوّ) · إزالةٌ أو مغادرة */
export type ListMembersBody =
  | { listId: string; action: "invite"; userIds: string[] }
  | { listId: string; action: "respond"; accept: boolean }
  | { listId: string; action: "remove"; userId: string };
export type ListMembersPayload = { done: true; count?: number; status?: "active" | "declined" };
/** 🆕 234 — عضوٌ كما يُرسم: صاحبُها أوّلاً، والمعلّقون لا يصلون إلّا لصاحبها (RLS) */
export type ListMember = { id: string; name: string; username: string | null; avatar: string | null; role: "owner" | "member" | "pending" };
export const LIST_MEMBERS_MAX = 10;
export type ToWatchBody = { on: boolean };
export type HiddenRailsBody = { keys: string[] };

/**
 * 🆕 D-1036 — **صفحةُ القائمة شاشةٌ أصليّة** (`GET /api/v1/lists/[id]`): ما تحتاجه القراءةُ — الرأسُ
 * والأعمالُ وشريطُ الحال وحالتي (الحفظ ورأيي). **حالُ المكتبة لكلِّ ملصقٍ ليست هنا**: التطبيقُ يقرؤها
 * من كاش `me:library` الذي عنده أصلاً (كما تفعل «اكتشف») — فلا تُرسَل مرّتين ولا تتقادم في ردٍّ ثانٍ.
 */
export type ListDetailItem = {
  kind: "tv" | "movie";
  id: number;
  title: string;
  poster_path: string | null;
  /** قائمةُ جائزة (D-995): سنةُ الفوز شارةً على الملصق؛ وإلّا `null` */
  badge: number | null;
  /** 🆕 234 — من أضافه في القائمة المشتركة (٥أ) — يُطابَق مع `members` لصورته؛ اختياريّ (D-028) */
  added_by?: string | null;
};
export type ListDetailPayload = {
  id: string;
  name: string;
  subtitle: string | null;
  kind: string;
  is_public: boolean;
  mine: boolean;
  /** تمتلئ وحدَها (D-823) — لا إضافةَ ولا ترتيبَ يدويّ */
  smart: boolean;
  /**
   * Phase 11-G (G5) — **شرطُ الذكيّة ومصدرُه للمالك وحدَه** (`null` لغيره ولغير الذكيّة): بهما ترسم ورقةُ الشرط
   * الأصليّة حالتَها الحاليّة بلا نداءٍ ثانٍ. اختياريّان لترتيب الكوميتات (D-028).
   */
  smart_rule?: Record<string, string> | null;
  smart_source?: "library" | "catalog" | null;
  /** صاحبُها كما يُعرض — `null` لقائمتي؛ وقوائمُ لوبز صاحبُها «Loopz» */
  owner: { name: string; username: string | null; avatar: string | null } | null;
  items: ListDetailItem[];
  saves: number;
  /** 🆕 249 — عددُ المعجبين لخانة ♥ — اختياريٌّ لترتيب الكوميتات */
  likes?: number;
  reviews: number;
  rating: number | null;
  can_save: boolean;
  /** 🗑️ 249 — النسخُ أُزيل: الخادمُ يعيد `false` دائماً لتُخفي نسخُ التطبيق القديمة رقاقتَها */
  can_copy?: boolean;
  /** 🆕 233 — «من قائمة @فلان» (٢أ): الأصلُ المعلنُ وحدَه؛ `username` غائبٌ لمن أخفى اسمه */
  copied_from?: { list_id: string; username: string | null; name: string | null } | null;
  /** 🆕 234 — القائمةُ المشتركة: الأعضاءُ (صاحبُها أوّلاً) — `[]` لقائمةٍ بلا أعضاء */
  members?: ListMember[];
  /** 🆕 234 — عضويّتي: «active» عضوٌ · «pending» دعوةٌ تنتظر ردّي (فوق القائمة «قبول · لا شكراً») · `null` */
  my_membership?: "active" | "pending" | null;
  /** 🆕 234 — «ادعُ» لصاحبها: ليست ذكيّةً ولا من قوائم لوبز */
  can_invite?: boolean;
  /** 🆕 234 — إضافةُ الأعمال وحذفُها: لصاحبها وللعضو الفعّال (٣أ) — لا ترتيبَ ولا تحرير للعضو */
  can_edit_items?: boolean;
  saved_by_me: boolean;
  /** 🆕 249 — «أأعجبتني؟» */
  liked_by_me?: boolean;
  can_review: boolean;
  my_review: { rating: number; body: string | null; has_spoiler: boolean } | null;
  /** آراءُ الناس **للقراءة** (الأحدثُ، حتّى ٣٠) بشكل صفِّ رأي العمل نفسِه؛ الردودُ والقلوبُ أعدادٌ — كتابتُهما في الويب */
  review_rows: {
    user_id: string;
    name: string;
    username: string | null;
    avatar_url: string | null;
    rating: number;
    review: string | null;
    has_spoiler: boolean;
    updated_at: string;
    likes: number;
    replies: number;
    mine: boolean;
    /** D-1038 — قلبي على هذا الرأي */
    liked_by_me: boolean;
  }[];
  /** D-1038 — ردودُ القائمة كلُّها (حتّى ٢٠٠) مفتاحُ خيطها `review_user_id`؛ الحدودُ (الحظر · المخفيّ · المُبلَّغ) يحترمها القارئ */
  reply_rows: ListReplyRow[];
  /** D-1037 — لقائمتي أو محفوظتي: هل هي في «قائمة التشغيل»؟ `null` = لا تنطبق */
  playlist: boolean | null;
  /** D-1037 — غلافُ قائمتي الحاليّ (لورقة التحرير) */
  cover: { tmdb_id: number | null; media_type: "tv" | "movie" | null; backdrop_path: string | null } | null;
  /** 🆕 «ت٣أ» — غلافُ الصفحة للجميع: المختارُ وإلّا خلفيّةُ أوّل عمل (`backdrop_path`) — اختياريٌّ لترتيب الكوميتات */
  cover_art?: string | null;
};

/* ====== Phase 11-G · G5/G6 — شرطُ الذكيّة ومشاركةُ القائمة أصليّاً ====== */
/** `POST /api/v1/lists/smart-rule` — تعديلُ شرطِ قائمةٍ ذكيّةٍ قائمة؛ المصدرُ يُقرأ من الصفّ عند الخادم (`updateSmartListRule`) */
/** `full` (🆕 T454): الشرطُ كاملٌ من صفحة التعديل — بلا دمجِ «إخفاء»/«ترتيب» القديمين */
export type SmartRuleBody = { listId: string; rule: Record<string, string>; full?: boolean };
/** `POST /api/v1/lists/share-friend` — إرسالُ القائمة إلى صديق (متابعةٌ متبادلة)؛ `note` حتّى ٢٨٠ حرفاً */
export type ShareFriendBody = { listId: string; recipientId: string; note?: string | null };
/** `POST /api/v1/communities/post` — رسالةٌ في مجتمع (رابطُ القائمة في المشاركة) */
export type CommunityPostBody = { communityId: string; body: string };
/** `GET /api/v1/me/friends` — من أتابعه ويتابعني، بشكل `PersonLite` (قاعدةُ الإخفاء عند القارئ: `displayNameOf`) */
export type FriendsPayload = { people: { id: string; nickname: string | null; username: string | null; avatar_url: string | null; hide_name: boolean; plan?: string | null; founder?: boolean | null; verified_at?: string | null }[] };
/** `GET /api/v1/me/follows?dir=followers|following` — قائمةُ ورقة العدّادين في الرئيسيّة الأصليّة (Phase 11-H، يقفل «ما بقي ويباً» في D-1066): الشكلُ شكلُ `FriendsPayload` نفسُه لأنّ الصفَّ نفسُه يُرسم (D-145) */
export type FollowsPayload = FriendsPayload & { dir: "followers" | "following" };
/** `GET /api/v1/me/communities` — مجتمعاتي (`my_communities`) */
export type CommunitiesPayload = { rooms: { id: string; name: string; member_count: number; photo_url: string | null }[] };
