import type { LibraryStatus } from "@/core/libraryStatus";

/**
 * 🆕 T375 — **من يفتح «المكتبة» على تبويبٍ بعينه، وعلى رفٍّ فيه** (تسجيلُ أحمد ١٠ نوفمبر: خانةُ «أفلام» في رأس
 * الرئيسيّة فتحت المكتبةَ على «مسلسلات» — الرابطُ كان يقول `?filter=movie` والتطبيقُ يرميه ويفتح آخرَ تبويب).
 * المكتبةُ تبويبٌ ثابتٌ يبقى مركَّباً (K3)، فلا يكفي تعديلُ ما تبدأ به: الطلبُ يُحفظ هنا وتأخذه الشاشةُ عند ظهورها —
 * وصفةُ `discover/aim.ts` حرفاً. ملفٌّ وحدَه كي لا تستورد الرئيسيّةُ شاشةَ المكتبة لأجل متغيّر.
 */
export type LibraryAim = { tab: "shows" | "movies" | "anime"; section: LibraryStatus | null };

let aimed: LibraryAim | null = null;

export function aimLibrary(a: LibraryAim): void {
  aimed = a;
}

/** يُقرأ مرّةً ثمّ يُمحى */
export function takeLibraryAim(): LibraryAim | null {
  const a = aimed;
  aimed = null;
  return a;
}

/**
 * رابطُ خانةٍ إلى وجهتها في المكتبة — `?filter=` هو نفسُه الذي تقرؤه صفحةُ الويب (`library/page.tsx`)، و`section`
 * يقرؤه التطبيقُ وحدَه (الويبُ يتجاهله فيفتح التبويبَ الصحيح أعلاه). رابطٌ بلا `filter` معروفٍ ⇒ `null`:
 * المكتبةُ تُفتح كما كانت، على آخر تبويب.
 */
export function libraryAimOf(href: string): LibraryAim | null {
  const q = href.indexOf("?");
  if (q < 0) return null;
  const p = new URLSearchParams(href.slice(q + 1));
  const f = p.get("filter");
  const tab = f === "tv" ? "shows" : f === "movie" ? "movies" : f === "anime" ? "anime" : null;
  if (!tab) return null;
  const s = p.get("section");
  const section = s === "watching" || s === "unstarted" || s === "completed" || s === "dropped" ? s : null;
  return { tab, section };
}
