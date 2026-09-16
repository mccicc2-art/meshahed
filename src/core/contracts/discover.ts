import type { DiscoverCard } from "./home";

/**
 * ====== عقدُ «اكتشف» الأصليّ — Phase 11-C · C1 (D-955) ======
 *
 * صفٌّ منسَّقٌ واحدٌ لكلِّ نداء (`GET /api/v1/discover/rail?tab=&key=`): الشاشةُ
 * تطلب الصفوفَ متوازيةً وترسم كلَّ صفٍّ حين يصل — **وهو ما تفعله الصفحةُ
 * بـ`Suspense`**، لا موجةٌ واحدةٌ تنتظر أبطأَ نداءِ TMDB.
 */
export type CuratedRailKey = "cinemas" | "airing" | "popular" | "top10-movie" | "top10-tv" | "top50-movie" | "top50-tv" | "soon";
export type CuratedTab = "shows" | "movies" | "anime";

export type CuratedCard = DiscoverCard & {
  /** تقييمُ IMDb إن عُرف (`withImdbRatings`/`attachImdbRatings`) — يُطبع بمنزلة */
  imdb_rating: number | null;
  /** تاريخُ الصدور الكامل — لصفّ «قريباً» (العدّ التنازليّ يُحسب في الشاشة) */
  date: string | null;
};

export type CuratedRailPayload = {
  key: CuratedRailKey;
  tab: CuratedTab;
  /** D-992 — عنوانٌ يفرضه الخادم (صفُّ الجائزة: اسمُها)؛ `null` = عنوانُ المفتاح المعتاد */
  title?: string | null;
  /** مرتَّبٌ بالأرقام (أفضل ١٠ · أفضل ٢٥) أم لا (السينما · الشائع · قريباً) */
  ranked: boolean;
  /** منطقةُ السينما (`cinemas` وحدَه) — لسطر «في سينمات …» */
  region: string | null;
  /** بابُ «عرض الكلّ» في الويب إن وُجد (`sectionHref`) */
  see_all: string | null;
  items: CuratedCard[];
};

/* ====== الصفوفُ الشخصيّة — C2 (D-955) ====== */
export type PersonalCard = CuratedCard & {
  /** سببُ الاقتراح («من «X»» · «من أنواعك المفضّلة») — «مقترحٌ لك» وحدَه */
  note: string | null;
};

/** `GET /api/v1/discover/personal?tab=` — `private, no-store`؛ للمسجَّل وحدَه */
export type PersonalRailsPayload = {
  tab: CuratedTab;
  foryou: PersonalCard[];
  myrows: { key: string; title: string; items: CuratedCard[]; see_all: string }[];
  artists: CuratedCard[];
  artists_see_all: string | null;
  /** الفلاترُ المحفوظة لهذا القسم — رقاقاتٌ تفتح `/news?<q>&tab=` باباً */
  filters: { name: string; q: string }[];
};

/* ====== تبويبُ «القوائم» — C3 (D-955) ====== */
import type { LibraryListCard } from "./library";

/** `GET /api/v1/discover/lists` — موجةُ `ListsDiscovery` في ردٍّ واحد؛ الفلترةُ (لوبز/المجتمع) في الشاشة */
export type DiscoverListsPayload = {
  for_you: LibraryListCard[];
  trending: LibraryListCard[];
  community: LibraryListCard[];
  /** العوالمُ المنسَّقة — كلُّ عالمٍ صفٌّ من بطاقات لوبز، و«الكل» يفتح `/news?tab=lists&fr=` */
  franchises: { slug: string; name: string; see_all: string; sets: LibraryListCard[] }[];
};

/* ====== صفُّ التريلرات — D-958 (١٤ سبتمبر ٢٠٢٦) ====== */
/** بطاقةُ تريلر للشاشة الأصليّة: خلفيّةٌ وعنوانٌ ومفتاحُ يوتيوب — **لا مشغّلَ أصليّاً** (قرارُ C3)؛ الضغطُ بابٌ إلى `/trailers?at=` */
export type TrailerCard = {
  kind: "tv" | "movie";
  id: number;
  title: string;
  year: string;
  genre: string | null;
  /** نسبةُ العمل («أمريكي») — السطرُ الثاني كما في بطاقة الويب (D-729) */
  country: string | null;
  /** مسارُ الملصق الخام — لـ«مكتبتي» (`track/follow` يخزّن ما يُرسم، D-718) */
  poster_path: string | null;
  /** خلفيّةُ TMDB الكاملة (`w780`) — وإن غابت فمصغّرةُ يوتيوب تُبنى من المفتاح في الشاشة */
  backdrop: string | null;
  video_key: string;
  /**
   * 🆕 **بدائلُ المقطع مرتّبةً** (D-959) — **`videoKeys` من `TrailerItem` كما هي**
   * (D-743: الأوّلُ هو `video_key` نفسُه): المشغّلُ الأصليُّ يجرّب التاليَ حين
   * يرفض يوتيوب الأوّل (حجبٌ بلديٌّ أو تعطيلُ تضمين) — **والحجبُ يُكتشف لا
   * يُتوقّع**، والصفحةُ الويبيّة تفعل هذا منذ D-756.
   */
  video_keys: string[];
  /** بابُ المشغّل الويبي لهذه البطاقة (`/trailers?scope=&at=`) — احتياطُ D-959 حين تُرفض المفاتيحُ كلُّها */
  href: string;
};

/** `GET /api/v1/discover/trailers?tab=` — `private`؛ مفتوحٌ للضيف كالصفحة؛ الصامتُ عند الفشل صفٌّ فارغ */
export type TrailersRailPayload = {
  tab: CuratedTab;
  /** بابُ «الكل» (`/trailers?scope=`) */
  see_all: string;
  items: TrailerCard[];
};

/** `GET /api/v1/discover/providers?tab=` — منصّاتُ الاشتراك لورقة الفلاتر الأصليّة (D-992) */
export type ProvidersPayload = { region: string; providers: { id: number; name: string; logo_path: string | null }[] };

/** `POST /api/v1/me/prefs/saved-filters` — حفظُ فلترٍ أو حذفُه (D-993) */
export type SavedFilterBody = { name?: string; section?: string; q?: string; remove?: string };
export type SavedFilterResult = { ok: boolean; needsPlus?: true; filters: { id: string; name: string; section: string; q: string }[] };

/** `GET /api/v1/discover/section` — شبكةُ «الكلّ» لصفٍّ (D-994) */
export type SectionPayload = { section: string; media: "movie" | "tv" | "anime"; page: number; has_more: boolean; items: CuratedCard[] };
