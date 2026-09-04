/**
 * ====== عقدُ المكتبة — `GET /api/v1/me/library` ======
 *
 * صفٌّ لكلِّ عملٍ أتابعه، **بالحالة محسوبةً في الخادم** بنفس
 * `core/libraryStatus.ts` الذي يحسبها للويب — فلا يختلف «مكتمل» بين شاشتين.
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
};

export type LibraryPayload = {
  items: LibraryItem[];
  /** عدُّ كلِّ حالةٍ — للرقاقات في أعلى الشاشة بلا مرورٍ ثانٍ على القائمة */
  counts: Record<LibraryStatus, number>;
};
