/**
 * 🆕 **مفرداتُ تبويبات الترايلرات — بيتُها هنا لا في `trailers.ts`**
 * (D-734).
 *
 * 🔴 **وهي D-669 مقلوبة**: تلك قالت «قيمةٌ خالصةٌ لا تسكن ملفَّ مكوّنِ
 * عميل»، **وهذه تقول: ولا تسكن ملفّاً `server-only` يقرؤها عميل.**
 * **شريطُ الرقائق مكوّنُ عميل**، **و`trailers.ts` تستورد `sections.ts`
 * التي تبلغ `next/headers`** — **فاستيرادُ اسمِ تبويبٍ منها يجرّ الخادمَ
 * كلَّه إلى المتصفّح ويكسر البناء.**
 * 🔑 **والعلامةُ أن الملفَّ لا يستورد شيئاً**: **مفرداتٌ بلا تبعيّات
 * يقرؤها الطرفان بأمان.**
 */
export type TrailerTab = "for-you" | "trending" | "movies" | "shows" | "anime";

/** **والترتيبُ هو ترتيبُ العرض** — «لك» أوّلاً لأنها وجهةُ الصفحة */
export const TRAILER_TABS: TrailerTab[] = ["for-you", "trending", "movies", "shows", "anime"];

/** **ولا يُصدَّق ما يصل**: مجهولٌ يسقط إلى «لك» لا إلى صفحةٍ فارغة */
export function asTrailerTab(raw: string | null | undefined): TrailerTab {
  return TRAILER_TABS.includes(raw as TrailerTab) ? (raw as TrailerTab) : "for-you";
}
