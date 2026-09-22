/**
 * ====== عقدُ الرئيسية في التطبيق — `GET /api/v1/me/home` + `/extras` ======
 *
 * 🆕 D-1066 (Phase 11-H · H0) — **نقضُ D-919 بقرار أحمد** (٢٢ سبتمبر: «لا
 * تهتمّ لـD-919 … مطابق ١٠٠٪ للويب فيو»): كانت ثلاثةَ صفوفٍ، وصارت
 * **الرئيسيةَ الويبيّةَ بحذافيرها** — الترويسةُ وأرقامُها الثمانيةُ، شريطُ
 * الأسبوع، والأقسامُ الاثنا عشر بترتيبِ صاحبها وطوابيرِه. **المصدرُ واحد**:
 * `lib/homeCore.ts` تحسب للصفحة وللباب معاً (D-1059 في البحث).
 *
 * 🔑 **النصوصُ المترجَمة تأتي من الخادم** (شارات «لم يبدأ»، «١٢ حلقة»،
 * «بعد ٣ أيام»، سطرُ الملخّص، وقتُ المشاهدة): الويبُ يحسبها في JSX بقاموسه،
 * ونسخُ ذلك المنطقِ في التطبيق نسخةٌ ثانيةٌ تفترق عند أوّل تعديل (القاعدة ٦).
 * لغةُ النصّ لغةُ الحساب (`Accept-Language` من القشرة — D-946).
 *
 * ⚡ **بابان لا واحد** (نظيرُ بثِّ الويب D-087/D-437): `me/home` يعود بما
 * يُرسم فوراً، و`me/home/extras` بما كان الويبُ يبثّه بعد الرفوف — مشاهدُ
 * «التالي» لبطاقات القوائم، أرقامُ حلقات القادم، والرائجُ (نداءُ TMDB الوحيد
 * الذي لا يخصّ مكتبتك). التطبيقُ يرسم الأوّلَ ثمّ يركّب الثاني.
 */

import type { TitleKind } from "./tags.ts";
import type { HomePrefs, HeaderStatKey } from "../homePrefs.ts";
import type { IconName } from "../iconNames.ts";
import type { LibraryListCard } from "./library.ts";

/** خانةٌ في بطاقة الأرقام — القيمةُ نصٌّ لأنّ «الوقت» يقول «٣ أيّام» لا رقماً */
export type HomeStat = {
  key: HeaderStatKey;
  icon: IconName;
  value: string;
  label: string;
  href: string;
};

/** الترويسة — `HomeHeader` بمعاملاتها (D-536/D-540/D-572/D-618/D-633) */
export type HomeHeaderPayload = {
  display_name: string;
  username: string | null;
  plan: string | null;
  founder: boolean;
  plus_until: string | null;
  verified_at: string | null;
  avatar_url: string | null;
  avatar_pos: number | null;
  cover_url: string | null;
  cover_pos: number | null;
  unread_signals: number;
  unread_shares: number;
  followers: number;
  following: number;
  hide_follow_lists: boolean;
  stats: HomeStat[];
  show_stats: boolean;
};

/** عنصرُ طابورِ ترتيب (ورقةُ الأولويّة — D-605/D-615) */
export type HomeQueueItem = {
  key: string;
  title: string | null;
  poster_path: string | null;
  media_type?: TitleKind;
  /** رمزٌ بدل الملصق لما ليس عملاً (`ReorderItem.fallbackIcon`) */
  fallback_icon?: "list" | "people" | "tv" | "film";
};

/** «التالي» في بطاقة قائمةٍ داخل «تابِع المشاهدة» */
export type HomeListNext = {
  kind: TitleKind;
  id: number;
  /** null لعنصرِ قائمةٍ لم يُترجَم اسمُه بعد — كما في `ListContinueCard` */
  title: string | null;
  poster_path: string | null;
  /** هل «التالي» في مكتبتك؟ (D-604) — يغيب عن طابور «بلا قائمة» */
  followed?: boolean;
};

/** بطاقةُ «تابِع المشاهدة» — أربعةُ أشكالٍ في صفٍّ واحدٍ يرتّبه صاحبُه (D-605) */
export type HomeContinueCard =
  | {
      type: "towatch";
      key: "lc-towatch";
      list_name: string;
      next: HomeListNext;
      watched: number;
      total: number;
    }
  | {
      type: "playlist" | "list";
      key: string;
      list_id: string;
      list_name: string;
      next: HomeListNext;
      watched: number;
      total: number;
    }
  | {
      type: "show";
      key: string;
      id: number;
      title: string;
      poster_path: string | null;
      backdrop_path: string | null;
      progress: number;
      watched: number;
      aired: number;
      episode_label: string | null;
      season: number | null;
      episode: number | null;
      runtime: number | null;
    };

/** يومٌ في شريط الأسبوع (١٤ يوماً — D-491) */
export type HomeWeekDay = { date: string; weekday: string; day_num: string };
export type HomeWeekEntry = { date: string; show_id: number; title: string };

/** بطاقةُ عملٍ في صفوف «للمشاهدة» و«القادم» (`MixedItem`) */
export type HomeMixedCard = {
  key: string;
  kind: TitleKind;
  id: number;
  title: string;
  poster_path: string | null;
  progress: number | null;
  /** «✓» · «٤٥ د» · «بعد ٣ أيام» — نصٌّ جاهز */
  badge: string | null;
  badge_tone: "neutral" | "progress" | "watched" | "rating" | null;
  subtitle: string | null;
  runtime: number | null;
  /** القادمُ وحدَه: موعدُ الحلقة/الفيلم و«الحلقة ٥» (من `extras`) */
  date: string | null;
  ep: string | null;
};

/** «مسلسلاتي» — الأرقامُ الخام والشارةُ الجاهزةُ معاً */
export type HomeShowCard = {
  id: number;
  title: string;
  poster_path: string | null;
  progress: number;
  watched: number;
  aired: number;
  /** حلقاتٌ متبقّية تُطبع على الملصق — أو null */
  count: number | null;
  badge: string | null;
  badge_tone: "watched" | "neutral";
};

export type HomeMovieCard = {
  id: number;
  title: string;
  poster_path: string | null;
  progress: number;
  badge: string;
};

export type HomeRatedCard = {
  kind: TitleKind;
  id: number;
  title: string;
  poster_path: string | null;
  rating: number;
};

export type HomeFriendCard = {
  kind: TitleKind;
  id: number;
  title: string;
  poster_path: string | null;
  saved: boolean;
  watched: boolean;
};

export type HomeTrendCard = {
  kind: TitleKind;
  id: number;
  title: string;
  poster_path: string | null;
  year: string | null;
  badge: string;
  added: boolean;
  watched: boolean;
};

/** بطاقةُ طابور «بلا قائمة» في صفّ «قوائمي» (D-559) */
export type HomeToWatchQueueCard = {
  on: boolean;
  count: number;
  posters: (string | null)[];
};

export type HomePayload = {
  header: HomeHeaderPayload;
  /** تفضيلاتُ الرئيسية كاملةً بعد التعقيم — الترتيبُ والعرضُ والكثافة… */
  prefs: HomePrefs;
  plus: boolean;
  sections: {
    continue: HomeContinueCard[];
    week: { days: HomeWeekDay[]; entries: HomeWeekEntry[] };
    /** الصفُّ (١٦) والعددُ الكامل — «الكل» في الورقة يسرد الكامل */
    towatch: { items: HomeMixedCard[]; all: HomeMixedCard[] };
    upcoming: HomeMixedCard[];
    shows: { items: HomeShowCard[]; total: number };
    movies: { items: HomeMovieCard[]; total: number };
    recap: { line: string; posters: (string | null)[] } | null;
    ratings: HomeRatedCard[];
    lists: {
      cards: LibraryListCard[];
      towatch_card: HomeToWatchQueueCard | null;
      /** موضعُ بطاقة الطابور بين البطاقات (D-866) — أو −1 */
      towatch_at: number;
    };
    friends: HomeFriendCard[];
  };
  /** طوابيرُ ورقة الأولويّة — ما يُرى يُرتَّب (D-217) */
  queues: {
    continue: HomeQueueItem[];
    towatch: HomeQueueItem[];
    lists: HomeQueueItem[];
    towatch_list: HomeQueueItem[];
  };
  /** الودجت (D-929): ثلاثةُ أسطرٍ نصّيّة تكتبها القشرةُ إلى `widget.json` */
  widget: { t: string; s: string | null; h: string }[];
  /** «اختر أنواعك المفضّلة» يظهر لمن لم يختر (رابطٌ إلى تعديل الملفّ) */
  pick_genres_hint: boolean;
  /** التلميحاتُ المقروءة (D-954) — `home-customize` يظهر مرّةً */
  hints: string[];
};

/** ما كان الويبُ يبثّه بعد الرفوف — يُطلب بعد `me/home` ويُركَّب عليه */
export type HomeExtrasPayload = {
  /** `${kind}-${id}` ⇢ مشهدُ «التالي» لبطاقات القوائم (D-507) */
  backdrops: Record<string, string | null>;
  /** `up-tv-<id>` ⇢ «الحلقة ٥» (D-437/D-432) */
  upcoming_eps: Record<string, string>;
  trending: HomeTrendCard[];
};

export type HomeViewBody = { view: "visual" | "compact" };
export type HomeOrderBody = { order: string[] };

/* ——— اكتشف (D-905 — بقيت هنا لأنّ `contracts/discover.ts` و`api/v1/discover` يقرآنها) ——— */

/** `GET /api/v1/discover` — صفوفٌ عامّةٌ من TMDB، الشكلُ واحدٌ لكلِّ صفّ */
export type DiscoverCard = {
  kind: TitleKind;
  id: number;
  title: string;
  poster_path: string | null;
  vote_average: number;
  year: string | null;
};

export type DiscoverRail = {
  key: "trending_tv" | "trending_movie" | "anime" | "airing" | "upcoming";
  items: DiscoverCard[];
};

export type DiscoverPayload = { rails: DiscoverRail[] };
