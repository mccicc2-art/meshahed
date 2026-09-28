/**
 * ====== معاملاتُ «المجتمع» — القارئُ المتسامحُ نفسُه للصفحة والباب (Phase 11-M · M0) ======
 *
 * كانت `asTab`/`asAll` داخل `app/people/page.tsx`؛ **وبابُ `/api/v1/community` قارئٌ ثانٍ**
 * فخرجتا إلى النواة (D-376: الاستخراجُ عند القارئ الثاني) — والحججُ كاملةً في تعليق
 * الصفحة (D-187/D-219/D-264/D-270).
 */

export type CommunityTab = "activity" | "talk" | "people" | "news" | "all";
/** التبويباتُ الثلاثة في الصفّ — والباقيان بالرابط وحدَه (D-219) */
export const COMMUNITY_PAGER_TABS = ["activity", "talk", "people"] as const;
export type CommunityPagerTab = (typeof COMMUNITY_PAGER_TABS)[number];

export function asCommunityTab(v: string | undefined | null): CommunityTab {
  /* `comments` وريثُه `activity` حرفاً — رابطٌ محفوظٌ لا يموت بتغيير اسم */
  if (v === "activity" || v === "comments") return "activity";
  /* المفاتيحُ القديمة (`works` · `mine` · `reviews`) تسقط إلى «نقاش» (D-187) */
  return v === "news" || v === "all" || v === "people" ? v : "talk";
}

/** «عرض الكل» — قسمٌ واحدٌ بعشرة (D-264) */
export const BOARD_SECTIONS = ["featured", "top", "reviews", "lists", "rising"] as const;
export type BoardSection = (typeof BOARD_SECTIONS)[number];

/** مفتاحٌ مجهولٌ (ومنه `people`/`watching` الساقطان، D-270) ⇒ اللوحةُ كاملةً لا `404` */
export function asBoardSection(v: string | undefined | null): BoardSection | null {
  return (BOARD_SECTIONS as readonly string[]).includes(v ?? "") ? (v as BoardSection) : null;
}

/** سقوفُ اللوحة: ٣ في المعاينة و١٠ في «عرض الكل» (D-264/D-289)، وحوضُ الصاعدين ٥٠ (D-311) */
export const BOARD_PREVIEW = 3;
export const BOARD_ALL = 10;
export const LEADERBOARD_POOL = { preview: 20, all: 50 } as const;
/** الزائرُ يرى أفضلَ خمسِ نقاشات (D-628) */
export const GUEST_ROOMS = 5;

/**
 * 🆕 **تفضيلاتُ أدوات المجتمع عبر `/api/v1/me/prefs/community`** — جسمٌ جزئيّ، كلُّ حقلٍ
 * اختياريّ، **والمجهولُ يسقط** (القيمُ تُكتب بكوكيزها نفسِها — D-255/D-306/D-309 — فيقرؤها
 * الويبُ كما يقرؤها التطبيق: جرّةُ الكوكي مشتركة في أندرويد، D-997).
 */
export type CommunityPrefsBody = {
  strangers?: boolean;
  sort?: "smart" | "latest";
  talk_followed?: boolean;
  translate?: boolean;
};

export function parseCommunityPrefsBody(b: unknown): CommunityPrefsBody | null {
  if (!b || typeof b !== "object" || Array.isArray(b)) return null;
  const o = b as Record<string, unknown>;
  const out: CommunityPrefsBody = {};
  if (typeof o.strangers === "boolean") out.strangers = o.strangers;
  if (o.sort === "smart" || o.sort === "latest") out.sort = o.sort;
  if (typeof o.talk_followed === "boolean") out.talk_followed = o.talk_followed;
  if (typeof o.translate === "boolean") out.translate = o.translate;
  return Object.keys(out).length ? out : null;
}
