import type { PersonLite } from "./people";

/**
 * **شكلُ ردِّ `/api/search` — وحدةٌ نقيّةٌ يقرؤها الطرفان** (D-534).
 *
 * **ولماذا ملفٌّ ثالثٌ لا نوعٌ مُصدَّرٌ من المسار:** ملفُّ المسار يستورد
 * `@/lib/data` وهو يستورد عميلَ الخادم (`next/headers`) — **فاستيرادُ
 * نوعٍ منه في مكوّن عميلٍ يسحب الخادمَ إلى حزمة المتصفّح** ويسقط البناء.
 * **وهو درسُ `people.ts` حرفاً** (D-193): النوعُ المشتركُ يسكن ملفّاً لا
 * يستورد شيئاً.
 */

/** النطاق — رقاقةٌ واحدةٌ من الخمس */
export type SearchScope = "all" | "titles" | "artists" | "members" | "lists";

export interface SearchTitle {
  id: number;
  mediaType: "tv" | "movie";
  title: string;
  year: string | null;
  /** رابطٌ جاهزٌ لا مسارٌ خام — المتصفّح لا يعرف قاعدة صور TMDB */
  poster: string | null;
}

export interface SearchArtist {
  id: number;
  name: string;
  /** مهنتُه بلغة القارئ — «ممثل»/«مخرج» */
  role: string;
  photo: string | null;
}

export interface SearchList {
  id: string;
  /** مارّاً بـ`curatedName` قبل أن يغادر الخادم */
  name: string;
  count: number;
  poster: string | null;
}

export interface SearchPayload {
  titles: SearchTitle[];
  artists: SearchArtist[];
  /** **عضوُ لوبز كما يرسمه `PersonName`** — بقاعدة الإخفاء نفسِها */
  members: PersonLite[];
  lists: SearchList[];
  /** هل خلف كلِّ قسمٍ مزيد؟ — بها وحدها يُرسم «عرض الكل» */
  more: Record<Exclude<SearchScope, "all">, boolean>;
}
