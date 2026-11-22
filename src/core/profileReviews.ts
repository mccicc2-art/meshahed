/**
 * ====== 🆕 T525 — تبويبُ «المراجعات» في ملفّ الشخص: المكتوبةُ أوّلاً، والنجومُ وحدَها بضغطة ======
 *
 * أحمد ٢٣ نوفمبر ٢٠٢٦ (بتسجيلٍ لملفّ khld: ٤٢ صفّاً منها خمسةٌ مكتوبة): «الرفيو القسم الاساسي خله للمراجعة بكتابة ويقدر
 * الشخص يضغط يظهر التقييمات فقط» · «١أ ٢أ ٣أ نفذ». — عُدولٌ محصورٌ عن D-587 («اعرض كذلك التقييم حتى الي بدون تعليق»):
 * النجومُ باقيةٌ في التبويب لكن خلف رقاقة، لأن خمسَ مراجعاتٍ بين سبعٍ وثلاثين نجمةً لا تُرى.
 *
 * قاعدةٌ واحدةٌ لقارئَين (الويب والتطبيق، القاعدة ٣): القسمةُ، والعرضُ الذي يُفتح عليه، ومقتطفُ المراجعة في صفِّ النشاط.
 */

export type ReviewsView = "written" | "ratings";

/** مكتوبةٌ = نصٌّ غيرُ فارغ — وهو شرطُ «راجَع» في السجلّ نفسُه (`kind: "review"`، `lib/myActivity`) */
export function isWritten(r: { review?: string | null }): boolean {
  return !!r.review?.trim();
}

/** القسمةُ بالترتيب الوارد كما هو — والنجمةُ بلا نصٍّ وبلا رقمٍ لا تُعدّ في أيٍّ منهما */
export function splitReviews<T extends { review?: string | null; rating?: number | null }>(
  rows: readonly T[],
): { written: T[]; ratings: T[] } {
  const written: T[] = [];
  const ratings: T[] = [];
  for (const r of rows) {
    if (isWritten(r)) written.push(r);
    else if (r.rating != null) ratings.push(r);
  }
  return { written, ratings };
}

/**
 * أيُّ العرضين يُفتح: ما طلبه القارئُ إن طلب، وإلّا فالمكتوبةُ — **وملفٌّ بلا مراجعةٍ مكتوبةٍ واحدة يُفتح على النجوم**
 * («٢أ»): تبويبٌ يفتح فارغاً وتحته سبعٌ وثلاثون نجمةً مخبّأةً ضغطةٌ بلا داعٍ.
 */
export function reviewsView(asked: string | null | undefined, writtenCount: number): ReviewsView {
  if (asked === "ratings" || asked === "written") return asked;
  return writtenCount > 0 ? "written" : "ratings";
}

/** سقفُ المقتطف بالمحارف لا بالبايتات — والسطران يقصّهما العارضُ (`line-clamp` · `numberOfLines`) */
export const EXCERPT_MAX = 280;

/**
 * مقتطفُ المراجعة لصفِّ «راجع» في النشاط («٣أ»: سطران والضغطُ يفتحها): المسافاتُ تُطوى (سطرٌ فارغٌ في النصّ يأكل أحدَ السطرين)،
 * والقطعُ على المحرف الكامل (`Array.from`) فلا يُشطر رمزٌ تعبيريّ. الفراغُ ⇒ `null`.
 */
export function reviewExcerpt(text: string | null | undefined): string | null {
  const s = text?.replace(/\s+/g, " ").trim();
  if (!s) return null;
  const chars = Array.from(s);
  return chars.length > EXCERPT_MAX ? `${chars.slice(0, EXCERPT_MAX).join("").trimEnd()}…` : s;
}
