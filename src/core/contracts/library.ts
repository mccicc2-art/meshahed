/**
 * ====== عقدُ المكتبة — `GET /api/v1/me/library` ======
 *
 * صفٌّ لكلِّ عملٍ أتابعه، **بالحالة محسوبةً في الخادم** بنفس
 * `core/libraryStatus.ts` الذي يحسبها للويب — فلا يختلف «مكتمل» بين شاشتين.
 *
 * 🆕 Phase 11 · B1 — **حقولُ التكافؤ الاختياريّة** (قرارُ المراجع
 * `5576037708` على B0): الشاشةُ الأصليّةُ للمكتبة (D-936) كانت ستعرض عنواناً
 * إنجليزيّاً وملصقاً غيرَ الذي اختاره صاحبُه، فتخسر ٩٨٪ في تبويب
 * «مسلسلات» نفسِه. **كلُّها اختياريّة** (`?`) فلا تكسر عميلاً قائماً،
 * **وقيمُها من مصادر الويب نفسِها** (`localizeFollows` · `title_art` ·
 * `follows.is_anime` · `my_favorites` · كوكي التبويب) لا من مصدرٍ ثانٍ —
 * فما تراه الصفحةُ تراه الشاشة. `title`/`poster_path` تبقيان كما كانتا.
 */

import type { TitleKind } from "./tags.ts";

export type LibraryStatus = "watching" | "unstarted" | "completed" | "dropped";

export type LibraryItem = {
  kind: TitleKind;
  id: number;
  title: string;
  poster_path: string | null;
  added_at: string;
  status: LibraryStatus;
  /** مسلسل: ما شوهد / ما بُثّ. فيلم: 1/1 أو 0/1 */
  watched: number;
  aired: number;
  next_air_date: string | null;
  last_watched: string | null;
  rewatch_count: number;
  /** العنوانُ بلغة القارئ — ما تعرضه صفحةُ المكتبة حرفاً (D-048) */
  display_title?: string;
  /** الملصقُ بعد غلافِ صاحبه (`title_art`، D-131) — وإلا `poster_path` */
  display_poster_path?: string | null;
  /** `null` = لم يُصنَّف بعد (الويبُ يسأل عنه عند أوّل فتحٍ لتبويب «أنمي») */
  is_anime?: boolean | null;
  is_favorite?: boolean;
};

/** التبويباتُ الثلاثةُ التي تنقلها الشاشةُ الأصليّة (B0 §٣.١ V1) */
export type LibraryTab = "shows" | "movies" | "anime";

export type LibraryPayload = {
  items: LibraryItem[];
  /** عدُّ كلِّ حالةٍ — للرقاقات في أعلى الشاشة بلا مرورٍ ثانٍ على القائمة */
  counts: Record<LibraryStatus, number>;
  /** التبويبُ الافتراضيُّ من تفضيل صاحبه (`tabPrefs`) — `shows` بلا كوكي */
  default_tab?: LibraryTab;
};
