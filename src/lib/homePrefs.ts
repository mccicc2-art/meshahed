// تفضيلات الصفحة الرئيسية — ماذا يظهر وبأي ترتيب

import { sanitizeCardCount, type CardCount } from "./cardCount";
import { sanitizeDensity, type Density } from "./density";
import type { Dict } from "./i18n";
import type { IconName } from "@/components/Icon";

/** أقسام الرئيسية القابلة للترتيب */
export const HOME_SECTIONS = [
  "continue",
  "week",
  "towatch",
  "upcoming",
  "recap",
  "shows",
  "movies",
  // «تقييماتي» و«قوائمي» (طلب أحمد 9 Aug): خارج الافتراضي كمسلسلاتي
  // وأفلامي — يعودان من التخصيص لمن يريدهما
  "ratings",
  "lists",
  "trending",
  /* 🆕 **«أعمالُ أصدقائك الآن»** (البند ٧) — الدليلُ الاجتماعيُّ صفّاً في
     الرئيسية لا سطوراً في `/people` وحدها. **وفي الافتراضي** لأنه يُخفي
     نفسَه لمن لا يتابع أحداً (D-181) فلا يكلّف من لا دائرةَ له شيئاً. */
  "friends",
] as const;
export type HomeSection = (typeof HOME_SECTIONS)[number];

/**
 * 🆕 أيقونةُ كلِّ قسمٍ واسمُه — **سجلٌّ واحدٌ لقارئَين** (D-595، نظيرُ
 * `profileSectionMeta` حرفاً): كان مكتوباً داخل `HomeCustomize` وحدَها،
 * **ثمّ احتاجته ورقةُ الترتيب التي تُفتح من عناوين الرئيسية نفسِها** —
 * ونسخُه كان سيعني قسماً باسمَين عند أوّل تعديل (D-145).
 */
export function homeSectionMeta(t: Dict): Record<HomeSection, { icon: IconName; label: string }> {
  return {
    continue: { icon: "play", label: t.continueWatching },
    week: { icon: "calendar", label: t.custWeekStrip },
    towatch: { icon: "bookmark", label: t.libToWatch },
    upcoming: { icon: "hourglass", label: t.libUpcoming },
    recap: { icon: "book", label: t.recapTitle },
    shows: { icon: "tv", label: t.myShows },
    movies: { icon: "film", label: t.myMovies },
    ratings: { icon: "star", label: t.panelRatings },
    lists: { icon: "list", label: t.myLists },
    trending: { icon: "trending", label: t.trendingWeek },
    friends: { icon: "people", label: t.railFriendsNow },
  };
}

/** خانات بطاقة الأرقام — خيارات يعرض المستخدم منها ٢ إلى ٤ */
export const HEADER_STATS = [
  "shows",
  "movies",
  "towatch",
  "time",
  "episodes",
  "upcoming",
  "completed",
  "dropped",
  "ratings",
] as const;
export type HeaderStatKey = (typeof HEADER_STATS)[number];

/**
 * **وضعُ العرض في الرئيسية — بصريٌّ أو مضغوط** (D-434).
 *
 * **وهو وضعُ رسمٍ لا صفحةٌ ثانية**: نفسُ البيانات ونفسُ الترتيب ونفسُ
 * النداءات، **والذي يتبدّل هو الشكل وحده** — فمن أراد ملصقاتٍ كبيرة
 * رآها، ومن أراد أكبرَ قدرٍ من مكتبته في شاشةٍ واحدة ضغطها. **وصفحتان
 * لبياناتٍ واحدة كانتا ستفترقان عند أوّل تعديل** (قاعدة ٦).
 */
export const HOME_VIEWS = ["visual", "compact"] as const;
export type HomeView = (typeof HOME_VIEWS)[number];

export const STATS_PICK_MIN = 2;
export const STATS_PICK_MAX = 4;

export interface HomePrefs {
  /** شريط المستوى */
  level: boolean;
  /** بطاقة الأرقام الأربعة */
  stats: boolean;
  /** سطر المتابعين */
  followers: boolean;
  /** أيقونات التعليقات والتقييمات والإعجابات */
  social: boolean;
  /** ترتيب أقسام المحتوى، والغائب عن القائمة مخفيّ */
  order: HomeSection[];
  /** خانات بطاقة الأرقام بترتيب عرضها — من ٢ إلى ٤ */
  statsPick: HeaderStatKey[];
  /** سقفُ بطاقات الصفّ — يقصّ ولا يمدّ (D-152) */
  cards: CardCount;
  /** وضعُ العرض — بصريٌّ (ملصقات) أو مضغوط (صفوف) */
  view: HomeView;
  /** عرضُ الملصق — مضغوط/مريح/كبير (D-441) */
  density: Density;
  /**
   * 🆕 **رايةُ طابور «للمشاهدة»** (D-559، بلاغُ أحمد: «تو واتش خليها
   * تكون ليست في قائمة الليستات بالمكتبة بحيث أقدر أشغّلها وأوقفها
   * وقت ما أبغى… حالياً أنا ما أبغى أشوفها، أبغى الليست الي جنبها
   * فقط وهي جات معها»).
   *
   * **وهي رايةُ `is_playlist` نفسُها بمعناها** (D-505): قوائمُك
   * الحقيقيّةُ تدخل «تابِع المشاهدة» برايةٍ ترفعها من صفحتها،
   * **وطابورُ «للمشاهدة» كان يدخل بلا استئذانٍ ولا مخرج** — **وهو
   * الوحيدُ في الصفّ بلا مفتاح.**
   *
   * ⚠️ **ومكانُها هنا لا في `user_lists`**: الطابورُ **محسوبٌ لا
   * مخزَّن** — تعريفُه «أفلامُك التي لا قائمةَ لها» — **فلو صار صفّاً
   * في جدول القوائم لأصبح كلُّ فيلمٍ فيه ذا قائمةٍ فأفرغ نفسَه في
   * اللحظة نفسِها.** **ورايةٌ في `home_prefs` تعطيه المفتاحَ بلا أن
   * تكسر تعريفَه**، **وبلا هجرة**: العمودُ `jsonb` قائمٌ منذ D-129.
   *
   * **والافتراضُ `true`** — **فمن لم يمسَّ شيئاً لا يفقد شيئاً**
   * (D-028: الغيابُ يعني السلوكَ القائم).
   */
  toWatch: boolean;
}

/**
 * 🆕 **الافتراضُ صار الرئيسيةَ التي ضبطها أحمد بيده** (D-490، طلبُه ٢٠
 * أغسطس بلقطةٍ لرئيسيّته: «أي حساب جديد أبغى الهوم هذي إعداداته
 * الافتراضية») — **قِرئت من إعداداته الحيّة لا من الذاكرة**: ثلاثةُ
 * أقسامٍ ظاهرة (التقويم · تابِع المشاهدة · للمشاهدة) وثمانيةٌ مخفيّة،
 * وخانتان في بطاقة الأرقام.
 *
 * **والترتيبُ نفسُه حجّة**: التقويمُ أوّلاً يقول «ماذا اليوم»، ثم
 * «أين وقفت»، ثم «ماذا بعد» — **سؤالٌ يتلو سؤالاً، لا رفوفٌ مرصوفة.**
 *
 * ⚠️ **والمخفيّةُ لم تُحذف من `HOME_SECTIONS`** — تعود بضغطةٍ من
 * التخصيص، **والافتراضُ اقتراحٌ لا سقف** (D-152).
 *
 * ⚠️ **وثمنٌ يُقال**: مَن يتخطّى الترحيبَ بلا متابعةِ عملٍ واحد يفتح
 * رئيسيّةً شبهَ خالية — **لأن «الرائج» لم يعد في الافتراضي** وهو الذي
 * كان يملؤها له. **والترحيبُ يملأ المكتبةَ لمن أتمّه** (`/welcome`
 * يحوّل بمجرّد أوّل متابعة)، فالحالةُ حالةُ المتخطّي وحدَه.
 */
export const DEFAULT_HOME_PREFS: HomePrefs = {
  level: true,
  stats: true,
  followers: true,
  social: true,
  /* ⚠️ **و«الرائج» آخرَ الترتيب — لا في تصميمك بل في علاجِ ثمنه**
     (D-497): الثلاثةُ فوقه كلُّها تُرسم من مكتبتك، **ومكتبةُ الحساب
     الجديد فارغة** — فمن تخطّى الترحيبَ فتح رئيسيّةً بيضاء.
     🔑 **وهو لا يظهر لك أنت**: `showTrending` مشروطٌ بأن تكون «تابِع
     المشاهدة» فارغة — **فيملأ الفراغَ لمن لا شيءَ عنده ويختفي وحدَه
     عند أوّل حلقة**، ولا يزحم رئيسيّتك بسطرٍ واحد. */
  order: ["week", "continue", "towatch", "trending"],
  statsPick: ["towatch", "upcoming"],
  cards: "full",
  view: "visual",
  density: "comfortable",
  toWatch: true,
};

/**
 * تنقية ما جاء من قاعدة البيانات.
 *
 * العمود JSON حرّ، وقد كتبت فيه نسخة قديمة أو يدٌ عابثة ما لا نتوقّع.
 * فكل قيمة تُفحص: المفاتيح المنطقية تسقط إلى افتراضيّها إن لم تكن
 * منطقية، والترتيب يُقصر على الأقسام المعروفة بلا تكرار.
 */
export function sanitizeHomePrefs(raw: unknown): HomePrefs {
  const d = DEFAULT_HOME_PREFS;
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;

  const bool = (k: keyof HomePrefs) => (typeof o[k] === "boolean" ? (o[k] as boolean) : d[k]);

  let order: HomeSection[] = d.order;
  if (Array.isArray(o.order)) {
    const seen = new Set<string>();
    const clean = o.order.filter(
      (s): s is HomeSection =>
        typeof s === "string" &&
        (HOME_SECTIONS as readonly string[]).includes(s) &&
        !seen.has(s) &&
        !!seen.add(s),
    );
    if (clean.length) order = clean;
  }

  // خانات البطاقة: المفاتيح المعروفة فقط، بلا تكرار، وبين ٢ و٤
  let statsPick: HeaderStatKey[] = d.statsPick;
  if (Array.isArray(o.statsPick)) {
    const seen = new Set<string>();
    const clean = o.statsPick.filter(
      (s): s is HeaderStatKey =>
        typeof s === "string" &&
        (HEADER_STATS as readonly string[]).includes(s) &&
        !seen.has(s) &&
        !!seen.add(s),
    );
    if (clean.length >= STATS_PICK_MIN) statsPick = clean.slice(0, STATS_PICK_MAX);
  }

  return {
    level: bool("level") as boolean,
    stats: bool("stats") as boolean,
    followers: bool("followers") as boolean,
    social: bool("social") as boolean,
    order,
    statsPick,
    cards: sanitizeCardCount(o.cards),
    view:
      typeof o.view === "string" && (HOME_VIEWS as readonly string[]).includes(o.view)
        ? (o.view as HomeView)
        : d.view,
    density: sanitizeDensity(o.density),
    toWatch: bool("toWatch") as boolean,
  };
}
