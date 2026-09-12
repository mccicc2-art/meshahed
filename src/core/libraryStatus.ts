/**
 * 🆕 D-948 — **الحقولُ التي تقرؤها الوصفة لا الصفُّ كاملاً**: كان يستورد
 * `FollowRow` من `@/lib/data`، **والنواةُ لا تستورد من `lib` حتى نوعاً** —
 * فالتطبيقُ (`apps/mobile`) يستورد `LIBRARY_STATUSES` من هنا ولا يرى `lib`.
 * `FollowRow` تُرضي هذا النوعَ بنيويّاً فلا يتغيّر قارئٌ واحد.
 */
export type StatusSource = {
  aired_episodes?: number | null;
  total_episodes?: number | null;
  dropped?: boolean | null;
};

/**
 * ====== حالةُ عملٍ في المكتبة — الوصفةُ الواحدة (D-876) ======
 *
 * **كانت هذه الأسطرُ تعيش في `library/page.tsx` وحدَها** (رقائقُ التقسيم
 * وترتيبُ الشبكة). **وقائمةُ المكتبة الذكيّة قارئٌ ثانٍ للحالة نفسِها**
 * — **فاستُخرجت عند القارئ الثاني** (D-376) **لا نُسخت**: **نسختان
 * تفترقان عند أوّل إصلاح، وقائمةٌ تقول «قيد المشاهدة» عن عملٍ تقول
 * المكتبةُ عنه «مكتمل» عطلٌ لا يشتكي.**
 *
 * 🔑 **والاشتقاقُ في التايب سكربت لا في SQL عمداً**: **حالةُ المشاهدة
 * حسابٌ من ثلاثة جداول** (`follows` · `watch_summary` · `watched_movies`)
 * **وليست عموداً** — **ودالّةُ SQL كانت ستكون نسخةً ثانيةً بلغةٍ ثانية**
 * (D-145). **ومكتبةُ عضوٍ مئاتٌ لا ملايين، والقاعدةُ ليست العنق** (P1-B).
 */
export type LibraryStatus = "watching" | "unstarted" | "completed" | "dropped";

export const LIBRARY_STATUSES: readonly LibraryStatus[] = [
  "unstarted",
  "watching",
  "completed",
  "dropped",
];

export function isLibraryStatus(v: unknown): v is LibraryStatus {
  return (LIBRARY_STATUSES as readonly unknown[]).includes(v);
}

/**
 * **حالةُ مسلسل** — **بنفس الترتيب الذي ترسمه الشبكة**: **الموقوفُ أوّلاً**
 * (بطاقةٌ حمراء تعلو كلَّ شيء)، **ثمّ المكتمل**، **ثمّ ما بدأ**، **وما
 * سواها لم يبدأ.** `watched` مقصوصٌ على `aired` كما في الصفحة.
 */
export function showStatusOf(f: StatusSource, watchedRaw: number): LibraryStatus {
  const aired = f.aired_episodes ?? f.total_episodes ?? 0;
  const watched = Math.min(watchedRaw, aired || Infinity);
  const done = aired > 0 && watched >= aired && watched > 0;
  if (f.dropped) return "dropped";
  if (done) return "completed";
  if (watched > 0) return "watching";
  return "unstarted";
}

/** **حالةُ فيلم** — **لا «قيد المشاهدة» للفيلم**: يُرى أو لا يُرى */
export function movieStatusOf(f: StatusSource, watched: boolean): LibraryStatus {
  if (f.dropped) return "dropped";
  return watched ? "completed" : "unstarted";
}
