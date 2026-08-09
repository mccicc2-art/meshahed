// تفضيلات البروفايل — ماذا يرى زائرُ صفحتك وبأي ترتيب (D-129)

/**
 * **توأم `homePrefs` عمداً، لا نسخةٌ منه.**
 *
 * السجلّان منفصلان لأن الأقسام مختلفة، لكن **المحرّك واحد**: نفس
 * `SectionOrderList` يرسم الاثنين، ونفس `updateProfile` يحفظهما. ثاني
 * مصنعٍ لنفس الشيء خلل (قاعدة `06`) — وثاني **قائمة أسماء** ليس مصنعاً.
 *
 * والفرق الجوهري عن الرئيسية: هذه التفضيلات **يقرؤها الزائر**، فما تخفيه
 * هنا يختفي عنه. لكنها إخراجٌ لا خصوصية: القفل الحقيقي في SQL
 * (`can_view_profile`)، وترتيبُك لا يفتح ما أغلقه ولا يغلق ما فتحه.
 */

/** أقسام البروفايل القابلة للترتيب والإخفاء */
export const PROFILE_SECTIONS = [
  "shows",
  "movies",
  /* «فنّانوك»: نفس شبكة تبويب المكتبة الرابع (D-128) — تُبنى مرة وتظهر
     مرتين. خارج الافتراضي لأنها تكلّف نداءات TMDB لعدّ الأعمال */
  "artists",
  "lists",
  "ratings",
] as const;
export type ProfileSection = (typeof PROFILE_SECTIONS)[number];

export interface ProfilePrefs {
  /** صفّ الأرقام الأربعة فوق المستوى */
  stats: boolean;
  /** شريط المستوى */
  level: boolean;
  /** شارة عدد الزيارات على الغلاف */
  visits: boolean;
  /** ترتيب الأقسام، والغائب عن القائمة مخفيّ */
  order: ProfileSection[];
}

export const DEFAULT_PROFILE_PREFS: ProfilePrefs = {
  stats: true,
  level: true,
  visits: true,
  // ما تعرضه الصفحة اليوم حرفياً — فمن لم يخصّص لا يرى شيئاً تغيّر
  order: ["shows", "movies", "lists", "ratings"],
};

/**
 * تنقية ما جاء من قاعدة البيانات — نفس منطق `sanitizeHomePrefs`.
 *
 * العمود JSON حرّ، وقد كتبت فيه نسخةٌ قديمة أو يدٌ عابثة ما لا نتوقّع.
 * والفرق هنا أن **الفراغ مسموح**: من أخفى كل الأقسام أخفاها قصداً،
 * بخلاف الرئيسية حيث ترتيبٌ فارغ يعني صفحةً بيضاء بلا سبب.
 */
export function sanitizeProfilePrefs(raw: unknown): ProfilePrefs {
  const d = DEFAULT_PROFILE_PREFS;
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;

  const bool = (k: "stats" | "level" | "visits") =>
    typeof o[k] === "boolean" ? (o[k] as boolean) : d[k];

  let order: ProfileSection[] = d.order;
  if (Array.isArray(o.order)) {
    const seen = new Set<string>();
    order = o.order.filter(
      (s): s is ProfileSection =>
        typeof s === "string" &&
        (PROFILE_SECTIONS as readonly string[]).includes(s) &&
        !seen.has(s) &&
        !!seen.add(s),
    );
  }

  return { stats: bool("stats"), level: bool("level"), visits: bool("visits"), order };
}
