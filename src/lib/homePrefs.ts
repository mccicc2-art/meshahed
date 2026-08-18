// تفضيلات الصفحة الرئيسية — ماذا يظهر وبأي ترتيب

import { sanitizeCardCount, type CardCount } from "./cardCount";

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
}

export const DEFAULT_HOME_PREFS: HomePrefs = {
  level: true,
  stats: true,
  followers: true,
  social: true,
  // «مسلسلاتي» و«أفلامي» انتقلا إلى المكتبة، فليسا في الافتراضي —
  // لكنهما باقيان في قائمة الأقسام لمن يحبّ إرجاعهما من التخصيص
  order: ["continue", "week", "towatch", "friends", "upcoming", "trending"],
  statsPick: ["shows", "movies", "towatch", "time"],
  cards: "full",
  view: "visual",
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
  };
}
