/**
 * 🆕 442 — **نافذةُ قائمة الحدث** (أحمد ١٩ نوفمبر ٢٠٢٦، «١ ب · ٢ أ · ٣ ب تبقى اسبوعان»).
 *
 * **حسابٌ صافٍ لا يقرأ شبكةً ولا ساعةً بنفسه** — يأخذ التاريخَ و«الآن» معطَيَين، فيُختبر
 * بلا مؤقّتات ولا TMDB (القاعدة: المنطقُ في `core`، والقراءةُ في `lib`).
 *
 * ⚠️ **والعدُّ بأيّام الرياض لا بساعات UTC**: فيلمٌ يُعرض الخميس يقول «اليوم» من منتصف ليل
 * الرياض، **لا من الثالثة فجراً** حين ينقلب يومُ UTC — والقارئُ يعدّ الأيّامَ بتقويمه لا بساعة الخادم.
 */
export type EventPhase = "before" | "today" | "after";

export interface EventWindow {
  /** التثبيتُ قائم: قبل العرض، أو يومَه، أو داخل مهلة ما بعده */
  active: boolean;
  phase: EventPhase;
  /** الأيّامُ الباقية قبل العرض (قبله) أو الماضية بعده (بعده)؛ صفرٌ يومَه */
  days: number;
}

const DAY = 86_400_000;
/* الرياض UTC+3 بلا توقيتٍ صيفيّ — إزاحةٌ ثابتة تكفي، ولا حاجةَ لقاعدة مناطق */
const RIYADH_OFFSET = 3 * 3_600_000;

/** رقمُ اليوم بتقويم الرياض — ليُطرح يومٌ من يومٍ بلا كسور ساعات */
function riyadhDay(ms: number): number {
  return Math.floor((ms + RIYADH_OFFSET) / DAY);
}

/**
 * @param releaseDate `YYYY-MM-DD` (تاريخُ الصالات من TMDB)، أو `null` حين لا تاريخ
 * @param graceDays كم يوماً يبقى مثبَّتاً بعد يوم العرض
 * @param now اللحظةُ الحاليّة بالميلي ثانية
 */
export function eventWindow(releaseDate: string | null | undefined, graceDays: number, now: number): EventWindow {
  /* **لا تاريخ = لا تثبيت** — قائمةٌ «مثبّتةٌ حتى موعدٍ لا نعرفه» وعدٌ بلا نهاية (D-217) */
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(releaseDate ?? "");
  if (!m) return { active: false, phase: "after", days: 0 };
  /* التاريخُ يومٌ تقويميٌّ لا لحظة: يُقرأ رقمَ يومٍ مباشرةً (منتصفُ ليله في الرياض) */
  const release = Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY);
  const today = riyadhDay(now);
  const diff = release - today;
  if (diff > 0) return { active: true, phase: "before", days: diff };
  if (diff === 0) return { active: true, phase: "today", days: 0 };
  const past = -diff;
  return { active: past <= graceDays, phase: "after", days: past };
}

/**
 * 🆕 442 — **ترتيبُ رفِّ «تناسبك» حول قائمة الحدث** — حسابٌ صافٍ يُختبر بلا قاعدةٍ ولا TMDB.
 *
 * الحدثُ أوّلاً، **ويُحذف من «الرائجة»** (صفّان متجاوران لا يحملان البطاقةَ نفسَها — D-366)،
 * **ولا يتكرّر في «تناسبك»**، وما في «الرائجة» يسقط من «تناسبك» كما كان قبله.
 *
 * 🆕 T450 — **وجوائزُ الموسم بعده مباشرةً** (`seasonIds`): قائمةُ الجائزة في شهر حفلها تصعد إلى أوّل
 * خمسِ بطاقات (أحمد: «جينا شهر الأوسكار تصعد جوائز الأوسكار ل توب ٥»)، **والحدثُ يبقى الأوّل** («نعم»
 * على: الجائزةُ ثانيةً إن صادف حدثٌ حفلَها). تُحذف من «الرائجة» كالحدث، وتُقصّ إلى ما يُبقيها في الخمس.
 */
export function orderForYou<T extends { id: string }>(
  pinIds: readonly string[],
  forYouIds: readonly string[],
  trending: readonly T[],
  seasonIds: readonly string[] = [],
): { ids: string[]; trending: T[] } {
  const pinned = new Set(pinIds);
  const season = seasonIds.filter((id) => !pinned.has(id)).slice(0, Math.max(0, 5 - pinIds.length));
  const lifted = new Set([...pinIds, ...season]);
  const kept = trending.filter((c) => !lifted.has(c.id));
  const shown = new Set(kept.map((c) => c.id));
  return {
    ids: [...pinIds, ...season, ...forYouIds.filter((id) => !shown.has(id) && !lifted.has(id))],
    trending: kept,
  };
}

/**
 * 🆕 T450 — **شهرُ الرياض** (١–١٢) لـ«الآن» المعطى — بالإزاحة الثابتة نفسِها التي يعدّ بها `eventWindow` أيّامَه،
 * فينقلب الشهرُ عند منتصف ليل الرياض لا عند منتصف ليل UTC.
 */
export function riyadhMonth(now: number): number {
  return new Date(now + RIYADH_OFFSET).getUTCMonth() + 1;
}
