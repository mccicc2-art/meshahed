// تفضيلات الصفحة الرئيسية — ماذا يظهر وبأي ترتيب

/** أقسام الرئيسية القابلة للترتيب */
export const HOME_SECTIONS = [
  "continue",
  "week",
  "towatch",
  "upcoming",
  "shows",
  "movies",
  "trending",
] as const;
export type HomeSection = (typeof HOME_SECTIONS)[number];

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
}

export const DEFAULT_HOME_PREFS: HomePrefs = {
  level: true,
  stats: true,
  followers: true,
  social: true,
  // «مسلسلاتي» و«أفلامي» انتقلا إلى المكتبة، فليسا في الافتراضي —
  // لكنهما باقيان في قائمة الأقسام لمن يحبّ إرجاعهما من التخصيص
  order: ["continue", "week", "towatch", "upcoming", "trending"],
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

  return {
    level: bool("level") as boolean,
    stats: bool("stats") as boolean,
    followers: bool("followers") as boolean,
    social: bool("social") as boolean,
    order,
  };
}
