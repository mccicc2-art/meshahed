/**
 * ====== اسمُ المستخدم — قاعدةٌ واحدةٌ يقرؤها الخادمُ والشاشة (D-1341) ======
 *
 * 🔑 **لماذا وحدةٌ في `core`**: خطوةُ «هذا أنت» في الترحيب تفحص الاسمَ وهو يُكتب،
 * و`updateProfile` يفحصه عند الحفظ — **وحارسٌ يسكن الشاشةَ وحدَها ليس حارساً**
 * (D-821). فالقائمةُ والتنظيفُ والحدّان هنا، ويستوردهما الاثنان.
 *
 * ⚠️ **القواعدُ نفسُها القائمة** (`updateProfile` قبل هذا الملفّ): a–z وأرقام و`_`،
 * حتى ٢٤ حرفاً. ما أُضيف هو الأسماءُ المحجوزة (قرارُ أحمد ١٦: «نعم احجز اسماء»).
 */
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 24;

/** كما يُخزَّن: صغيرٌ، a–z · 0–9 · `_`، مقصوصٌ على الحدّ */
export function cleanUsername(raw: string): string {
  return (raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, USERNAME_MAX);
}

/**
 * الأسماءُ التي لا يأخذها أحد: اسمُ المنتج، أدوارُ الفريق، مساراتُ الموقع، ومزوّدو الدخول.
 * فُحصت على الإنتاج في ١٠ أكتوبر: `loopz` وحدَه مأخوذ (حسابُ النظام) ويبقى له —
 * القائمةُ تمنع أخذاً جديداً ولا تنزع اسماً من صاحبه (`isReservedUsername` + مقارنةُ المحفوظ).
 */
const RESERVED = new Set([
  "loopz", "loopztv", "loopzplus", "admin", "administrator", "support", "help",
  "official", "team", "staff", "mod", "moderator", "system", "root", "api", "www",
  "mail", "info", "contact", "security", "privacy", "terms", "login", "logout",
  "signup", "welcome", "settings", "profile", "account", "news", "search",
  "discover", "library", "community", "home", "null", "undefined", "me", "user",
  "users", "guest", "anonymous", "google", "apple", "tmdb", "meshahed",
]);

/** شكلُ الاسم المولَّد قديماً (`username.sql`) — لا يُختار بيدٍ، فلا يلتبس «لم يختر» بـ«اختار» */
const GENERATED = /^user_[0-9a-f]{8}$/;

/**
 * 🆕 D-1348 — **كلُّ ما يبدأ باسم المنتج محجوز** (قرارُ أحمد ١٠ أكتوبر: «LoopzTV امنع اي شخص ياخذه» ثمّ «كل ما يبدا
 * بلوبز»): انتحالُ المنتج يأتي بلاحقة (`loopz_official` · `loopzsupport`) لا بالاسم نفسِه. حسابُ النظام `loopz` يبقى
 * على اسمه — المنعُ لأخذٍ جديد (مقارنةُ المحفوظ عند القارئَين).
 * ⚠️ **القائمةُ والبادئةُ مكتوبتان مرّتين**: هنا وفي `public.username_reserved` (الهجرة ١٩٨ — القاعدةُ تفرضها على
 * من يكتب العمودَ مباشرة). اسمٌ يُضاف هنا يُضاف هناك؛ الاختبارُ `username.test.ts` يقارن النصَّين.
 */
export const RESERVED_PREFIX = "loopz";

/** للاختبار وحدَه: القائمةُ كما هي، ليقارنها بنصِّ الهجرة */
export const RESERVED_NAMES: readonly string[] = [...RESERVED];

export function isReservedUsername(clean: string): boolean {
  return RESERVED.has(clean) || clean.startsWith(RESERVED_PREFIX) || GENERATED.test(clean);
}

export type UsernameIssue = "short" | "reserved";

/** علّةُ الاسم قبل سؤال القاعدة عن توفّره — `null` يعني «شكلُه سليم» */
export function usernameIssue(clean: string): UsernameIssue | null {
  if (clean.length < USERNAME_MIN) return "short";
  if (isReservedUsername(clean)) return "reserved";
  return null;
}
