// عددُ البطاقات في الصفّ — تفضيلٌ واحد تقرؤه الرئيسية والبروفايل (D-152)

/**
 * **سقفٌ يُقصّ به، لا رقمٌ يُطلب.**
 *
 * لكل صفٍّ في التطبيق سقفُه المكتوب في مكانه: «تابِع المشاهدة» ١٢،
 * و«تقييماتي» ١٦، و«الرائج» ٢٤ — وهي أرقامٌ اختيرت لمعنى الصفّ ولكلفته
 * لا اعتباطاً. فلو صار العدد رقماً حرّاً من المستخدم لصارت هذه الأرقام
 * كذباً، ولفتح البابُ لصفٍّ من مئة بطاقة يدفع ثمنَه الخادمُ والقاعدة.
 *
 * فالتفضيل **يقصّ ولا يمدّ**: `capCards` تأخذ الأصغر من سقف الصفّ وسقف
 * المستخدم. ولهذا الافتراضي **`full`** — أي بلا قصّ — فمن لم يخصّص
 * شيئاً يرى الصفحة **حرفاً بحرف كما هي اليوم** (قاعدة D-129).
 *
 * وثلاث درجاتٍ لا أربع: ثلاثة خياراتٍ ظاهرة لمسةٌ واحدة بلا قائمةٍ
 * تُفتح، وهي بالضبط الحالة التي بقيت فيها العائلة `segmented` (D-076).
 */
export const CARD_COUNTS = ["compact", "medium", "full"] as const;
export type CardCount = (typeof CARD_COUNTS)[number];

export const DEFAULT_CARD_COUNT: CardCount = "full";

/** سقفُ كل درجة — و`full` بلا سقفٍ فوق سقف الصفّ نفسه */
const CAP: Record<CardCount, number> = {
  compact: 10,
  medium: 16,
  full: Number.POSITIVE_INFINITY,
};

/** الأصغر من سقف الصفّ وسقف المستخدم — القصُّ في اتجاهٍ واحد */
export function capCards(rowCap: number, pick: CardCount): number {
  return Math.min(rowCap, CAP[pick]);
}

/** ما جاء من عمود JSON الحرّ قد يكون أيَّ شيء — يسقط إلى الافتراضي */
export function sanitizeCardCount(raw: unknown): CardCount {
  return typeof raw === "string" && (CARD_COUNTS as readonly string[]).includes(raw)
    ? (raw as CardCount)
    : DEFAULT_CARD_COUNT;
}
