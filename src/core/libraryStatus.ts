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
  /** 🆕 D-1280 — `started`: ضغط «ابدأ» ولم يشاهد حلقةً بعد · `paused`: أوقفه مؤقّتاً (هجرة ١٩٤) */
  watch_state?: string | null;
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
  /* 🆕 D-1280 — **«ابدأ» قرارٌ يُحترم بلا حلقة**: من ضغطه نقل العملَ من «للمشاهدة» إلى ما يتابعه،
     فرفُّه «أتابعه» بصفر. الوصفةُ هنا وحدَها، فالمكتبةُ والقوائمُ الذكيّةُ والعدّاداتُ تقرؤها معاً.
     ⚖️ D-1281 — و«إيقاف مؤقّت» بلا حلقةٍ **ليس حالاً**: بدأ ثمّ أوقف ولم يشاهد شيئاً = لم يبدأ
     (`watchStateOf` تُسقطه)، فقائمتُه تعود «ابدأ» لا «كمّل». */
  if (watchStateOf(f, watched) === "started") return "watching";
  return "unstarted";
}

/**
 * 🆕 D-1281 — **قرارُ صاحب المسلسل كما يُعمل به** (`follows.watch_state` بعد تنقيته) — قارئٌ واحد للرئيسيّة
 * والمكتبة والخريطة التي تصل التطبيق، فلا يفترق سطحان في معنى صفٍّ واحد:
 * - `started` لا يعني شيئاً بعد أوّل حلقة: الوقائعُ تحكم (فلا يُعاد).
 * - `paused` لا يعني شيئاً قبل أوّل حلقة: إيقافُ ما لم يُشاهَد منه شيءٌ تراجعٌ عن «ابدأ».
 * - والموقوفُ بالبطاقة الحمراء لا حالَ له: «تركتُه» تعلو الاثنين.
 */
export function watchStateOf(f: StatusSource, watchedRaw: number): "started" | "paused" | null {
  if (f.dropped) return null;
  if (f.watch_state === "started") return watchedRaw > 0 ? null : "started";
  if (f.watch_state === "paused") return watchedRaw > 0 ? "paused" : null;
  return null;
}

/** **حالةُ فيلم** — **لا «قيد المشاهدة» للفيلم**: يُرى أو لا يُرى */
export function movieStatusOf(f: StatusSource, watched: boolean): LibraryStatus {
  if (f.dropped) return "dropped";
  return watched ? "completed" : "unstarted";
}
