/**
 * تجديدٌ مُجمَّع لبيانات الخادم.
 *
 * الرئيسية أغلى صفحات التطبيق بناءً، وأربع ضغطاتٍ متتالية كانت تعني أربع
 * إعادات بناءٍ كاملة. النافذة الواحدة (800م.ث) تجمعها في تجديدٍ واحد.
 */
type RouterLike = { refresh: () => void };

let timer: ReturnType<typeof setTimeout> | null = null;

export function coalescedRefresh(router: RouterLike, delay = 800) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    router.refresh();
  }, delay);
}
