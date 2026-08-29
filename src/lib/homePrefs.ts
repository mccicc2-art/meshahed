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
    /* 🆕 D-703: اسمُ الصفِّ في لوح التخصيص هو اسمُه في الرئيسية */
    lists: { icon: "list", label: t.listsTitle },
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
 * 🆕 **رمزُ الخانة واسمُها — مصدرٌ واحدٌ لقارئَيه** (D-787، نظيرُ
 * `homeSectionMeta` أعلاه حرفاً).
 *
 * **وجاء قارئُه الثاني فحانت لحظةُ الاستخراج** (D-376): البطاقةُ في
 * الرئيسية ولوحُ التخصيص كانا يكتبان الخريطةَ نفسَها مرّتين —
 * **وافترقتا فعلاً**: «حلقات» كانت `shortEpisodes` في البطاقة
 * و`statsWatchedEpisodes` في اللوح، **فيختار المستخدمُ اسماً ويرى
 * غيرَه** (وهو نقضُ D-703: اسمُ الشيء في اللوح هو اسمُه في الرئيسية).
 *
 * ⚠️ **والأسماءُ هنا قصيرةٌ بالبناء لا بالصدفة**: الخانةُ ثُلثُ بطاقةٍ
 * على هاتف، **فاسمٌ يُستعار من لوحٍ أو تبويبٍ أو شارةٍ يُقصّ** — **ومن
 * أضاف خانةً جديدةً يكتب اسمَها القصير هنا، لا يستعيره من سطحٍ أوسع.**
 */
export function headerStatMeta(
  t: Dict,
): Record<HeaderStatKey, { icon: IconName; label: string }> {
  return {
    shows: { icon: "tv", label: t.shortShows },
    movies: { icon: "film", label: t.shortMovies },
    towatch: { icon: "bookmark", label: t.libToWatch },
    time: { icon: "clock", label: t.shortWatchTime },
    episodes: { icon: "play", label: t.shortEpisodes },
    upcoming: { icon: "hourglass", label: t.libUpcoming },
    completed: { icon: "check", label: t.libTabFinished },
    dropped: { icon: "card", label: t.droppedBadge },
    ratings: { icon: "star", label: t.shortRatings },
  };
}

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

/**
 * 🔴 🆕 **حقولُ التنسيق التي يبيعها لوحُ البلس** (D-791، حكمُ أحمد:
 * «ما تبيعه الصفحة فقط»).
 *
 * 🔴 **ولمَ وُلدت هذه القائمة**: أقفالُ Loopz+ كانت **في المتصفّح
 * وحدَه** — `ThemeSection` تقرأ معامل `plus`، **ولا شرطَ خطّةٍ واحدٌ في
 * أيِّ فعلِ خادم** — **فما نبيعه لم يكن مقفولاً، وقفلٌ في الواجهة بلا
 * خادمٍ يقفل زينةٌ تُفتح بأدوات المطوّر.**
 *
 * ⚖️ **والقائمةُ نصُّ صفحة البيع لا اجتهاداً**: «رتّب الأقسام وأظهِر ما
 * يهمّك… واختر الكثافة ومقاسات البوسترات» و«أيّ أرقامٍ تراها في
 * الترويسة». **وما ليس فيها مجّانيٌّ بحكمه صراحةً**: **زرُّ تبديل
 * العرض** و**مفتاحُ «للمشاهدة»** — **أفعالٌ يوميّةٌ يستعملها الجميع،
 * وقفلُها يُقرأ تضييقاً لا بيعاً** — **وترتيبُ عناصر الطوابير يدويّاً**
 * (D-719): **ترتيبُ ما تملكه ليس تنسيقَ صفحة.**
 */
export const PLUS_HOME_FIELDS = [
  "level",
  "stats",
  "followers",
  "social",
  "order",
  "statsPick",
  "cards",
  "density",
] as const satisfies readonly (keyof HomePrefs)[];

/**
 * **يردّ حقولَ البلس إلى المحفوظ ويقبل ما سواها** — **ولا يرمي خطأً**:
 * النموذجُ يرسل الاسمَ والنبذةَ والتنسيقَ في نداءٍ واحد، **ورفضُ
 * النداء كلِّه كان سيمنع مجّانيّاً من حفظ نبذته** (D-217).
 */
export function keepPaidHomePrefs(stored: HomePrefs, incoming: HomePrefs): HomePrefs {
  const out: HomePrefs = { ...incoming };
  /* **نسخٌ محفوظُ النوع لا `Record<string, unknown>`**: المفتاحُ من
     `keyof HomePrefs`، **فحقلٌ يُحذف من الشكل غداً يسقط عند الترجمة لا
     في الإنتاج** — وهو الفرقُ كلُّه. */
  const carry = <K extends keyof HomePrefs>(key: K) => {
    out[key] = stored[key];
  };
  for (const key of PLUS_HOME_FIELDS) carry(key);
  return out;
}

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
  /**
   * 🆕 **أولويّةُ المشاهدة داخل الصفَّين** (D-605، طلبُ أحمد: «أبغاها
   * أقدر أرتّب الأفلام نفسها نفس الي عامله في البروفايل — أشوف القائمة
   * كاملة في تو واتش بضغطة زر أو كنتنيو واتشينغ وأرتّب أولويّة
   * المشاهدة»): مفاتيحُ عناصر الصفِّ بترتيبه — **ما ذُكر يتقدّم
   * بترتيبه، وما لم يُذكر يبقى على ترتيبه المحسوب بعده** (فعنصرٌ جديدٌ
   * لا يختفي ولا يُبعثر ما رتّبتَه). **والفارغُ هو السلوكُ القائم**
   * (D-152). ⚠️ **وهنا لا في جدولٍ**: الصفّان محسوبان لا مخزَّنان
   * (حجّةُ `toWatch` أعلاه نفسُها) — فالترتيبُ تفضيلُ عرضٍ على
   * `home_prefs` القائم بلا هجرة.
   */
  continueOrder: string[];
  towatchOrder: string[];
  /** 🆕 وصفُّ «قوائمي» ثالثُها (D-615): معرّفاتُ القوائم بترتيبه */
  listsOrder: string[];
  /**
   * 🆕 **وترتيبُ بطاقة «للمشاهدة» نفسِها** (D-719، حكمُه: «إذا ضغطتها
   * أبغاها تنفتح، أحتاج أرتّب تسلسل الأفلام فيها»).
   *
   * ⚠️ **ومفتاحٌ رابعٌ لا `towatchOrder`** — **والفرقُ جوهريٌّ لا
   * تنظيميّ**: صفُّ «للمشاهدة» في الرئيسية **مسلسلاتٌ لم تُبدأ وأفلامٌ
   * لم تُكمَل**، والبطاقةُ **أفلامُك التي لا قائمةَ لها** — **مجموعتان
   * مختلفتان باسمٍ واحد.** **ولو تشاركا المفتاحَ لَقفزت أفلامُ البطاقة
   * كلُّها فوق مسلسلات الصفّ** (قاعدةُ `applyQueueOrder`: المذكورُ
   * يتقدّم) — **أثرٌ لم يطلبه أحد.**
   * 🔑 **والأثرُ المطلوبُ يُشترى بلا ذاك**: هذا الترتيبُ يُطبَّق على
   * **أفلام** صفِّ الرئيسية داخلَ قسمها، **فتتقدّم أولويّتُه بين
   * الأفلام ولا تُزيح مسلسلاً.**
   */
  towatchListOrder: string[];
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
  continueOrder: [],
  towatchOrder: [],
  listsOrder: [],
  towatchListOrder: [],
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

  /* مفاتيحُ أولويّة الصفَّين (D-605): نصوصٌ قصيرةٌ بلا تكرار وبسقفٍ —
     العمودُ JSON حرٌّ والمفتاحُ الغريبُ لا يُطابق شيئاً فيسقط أثرُه */
  const keyList = (
    k: "continueOrder" | "towatchOrder" | "listsOrder" | "towatchListOrder",
  ): string[] => {
    if (!Array.isArray(o[k])) return d[k];
    const seen = new Set<string>();
    return (o[k] as unknown[])
      .filter(
        (s): s is string =>
          typeof s === "string" && s.length > 0 && s.length <= 80 && !seen.has(s) && !!seen.add(s),
      )
      .slice(0, 500);
  };

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
    continueOrder: keyList("continueOrder"),
    towatchOrder: keyList("towatchOrder"),
    listsOrder: keyList("listsOrder"),
    towatchListOrder: keyList("towatchListOrder"),
  };
}

/**
 * 🆕 **تطبيقُ أولويّة المشاهدة على صفٍّ محسوب** (D-605) — **قاعدةٌ
 * واحدةٌ لقارئَيها** (الرسمُ وورقةُ الترتيب، D-145): ما ذُكر في
 * الترتيب المحفوظ يتقدّم بترتيبه، **وما لم يُذكر يلحق به على ترتيبه
 * المحسوب** — فعنصرٌ دخل الصفَّ بعد الحفظ لا يختفي ولا يُبعثر ما
 * رتّبه صاحبُه.
 */
export function applyQueueOrder<T>(
  rows: T[],
  keyOf: (r: T) => string,
  order: string[],
): T[] {
  if (order.length === 0) return rows;
  const pos = new Map(order.map((k, i) => [k, i]));
  const ranked: T[] = [];
  const rest: T[] = [];
  for (const r of rows) (pos.has(keyOf(r)) ? ranked : rest).push(r);
  ranked.sort((a, b) => pos.get(keyOf(a))! - pos.get(keyOf(b))!);
  return [...ranked, ...rest];
}
