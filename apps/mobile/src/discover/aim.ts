/**
 * 🆕 D-1352 (V-A) — **من يفتح «اكتشف» على تبويبٍ بعينه** (المكتبةُ الفارغة في تبويب الأنمي كانت تفتح صفحةَ الويب
 * `/news?tab=anime`). «اكتشف» تبويبٌ ثابتٌ يبقى مركَّباً (K3)، فلا يكفي تعديلُ ما تبدأ به: الطلبُ يُحفظ هنا وتأخذه
 * الشاشةُ عند ظهورها، أو عند تركيبها إن لم تُركَّب بعد. وتبويبٌ أخفاه العضو ⇒ حارسُ `tabsOrder` فيها ينقله إلى أوّل
 * ظاهرٍ كعادته. ملفٌّ وحدَه كي لا تستورد المكتبةُ شاشةَ «اكتشف» وهي تستوردها (دورةُ استيراد).
 */
export type DiscoverAim = "shows" | "movies" | "anime" | "lists";

let aimed: DiscoverAim | null = null;

export function aimDiscoverTab(tab: DiscoverAim): void {
  aimed = tab;
}

/** يُقرأ مرّةً ثمّ يُمحى */
export function takeDiscoverAim(): DiscoverAim | null {
  const a = aimed;
  aimed = null;
  return a;
}
