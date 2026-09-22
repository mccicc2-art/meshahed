/**
 * ====== عقدُ البحث — `/api/v1/search` و`/api/v1/search/story` (Phase 11-G · G0) ======
 *
 * 🔑 **الشكلُ شكلُ `searchTypes.ts` نفسُه** — لا نوعٌ ثانٍ للبحث: الويبُ يقرأه
 * عارياً من `/api/search` والتطبيقُ بغلاف `{data}` من `v1`، **والحمولةُ واحدة**
 * فلا يفترق صفُّ نتيجةٍ بين المنصّتين (القاعدة ٦). هذا الملفُّ ممرٌّ + عقدُ
 * بابِ الوصف الذي لم يكن له شكلٌ مشتركٌ قبل اليوم (كان server action).
 */
export type { SearchScope, SearchTitle, SearchArtist, SearchList, SearchPayload } from "../searchTypes";

/** جسمُ `POST /api/v1/search/story` — وصفٌ حرٌّ من ٨ إلى ٦٠٠ حرف (حدودُ `aiStorySearch`) */
export interface SearchStoryBody {
  description: string;
}

/** نتيجةُ الوصف: عملٌ مثبَّتٌ بـTMDB + سببُ الترشيح (شكلُ `SearchTitle` زائدَ `reason`) */
export interface SearchStoryItem {
  id: number;
  mediaType: "tv" | "movie";
  title: string;
  titleSecondary?: string | null;
  year: string | null;
  poster: string | null;
  reason: string | null;
}

export interface SearchStoryPayload {
  items: SearchStoryItem[];
  /** `short`: أقلُّ من ٨ أحرف · `empty`: النموذجُ لم يجد — الواجهةُ تقرّر النصّ */
  reason: "short" | "empty" | null;
  /** المسارُ البديل (بلا نموذج) — الويبُ لا يميّزه بصريّاً اليوم، يمرّ للمستقبل */
  fallback: boolean;
}
