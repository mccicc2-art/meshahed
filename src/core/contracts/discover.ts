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
