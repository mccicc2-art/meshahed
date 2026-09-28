/**
 * ====== ما فوق الجذر — الشاشاتُ الأصليّةُ المفتوحة فوق مجموعة التبويبات (M3-fix) ======
 *
 * 🔑 **البابُ الويبيُّ من شاشةٍ أصليّة يعود إليها لا إلى جذرها** (تسجيلُ خالد ٢٨ سبتمبر: «المجتمع» ← غرفة ← صورةُ شخص
 * ← ملفّه ← رجوع ← **«المجتمع»**، وأحمد: «المفترض يرجعني مكان ما كنت بالضبط»). الـWebView جذرُ المكدّس فلا تُرى
 * وفوقها شاشة، فالشاشاتُ تُنزَل لتظهر الصفحة — **وهذا يلتقط ما كان فوق الجذر لحظةَ الخروج**، و`goNative` يدفعه
 * ثانيةً بعد الجذر (`shell.takeResume`)، والغرفةُ تعيد موضعَ القراءة من ذاكرتها (`threadView`).
 *
 * لا مسارات تُكتب هنا: أسماءُ المسارات أسماءُ ملفّات `app/` نفسُها (`talk/[kind]/[id]`)، و`router.push` يقبلها قوالبَ
 * مع معاملاتها — فأيُّ شاشةٍ أصليّةٍ تُضاف غداً تُستعاد بلا سطرٍ هنا.
 */
export type StackEntry = { pathname: string; params: Record<string, string> };

type Route = { name: string; params?: Record<string, unknown>; state?: State };
type State = { index?: number; routes: Route[] } | undefined;

function stackWithRoots(s: State): State {
  if (!s?.routes) return undefined;
  if (s.routes.some((r) => r.name === "(tabs)")) return s;
  for (const r of s.routes) {
    const f = stackWithRoots(r.state);
    if (f) return f;
  }
  return undefined;
}

/** الشاشاتُ فوق آخر مجموعة تبويبات حتى المعروضة — فارغةٌ إن لم تكن مجموعة (الشاشةُ فوق الويب مباشرة) */
export function stackAboveRoots(root: unknown): StackEntry[] {
  const s = stackWithRoots(root as State);
  if (!s) return [];
  const top = s.index ?? s.routes.length - 1;
  const at = s.routes.slice(0, top + 1).map((r) => r.name).lastIndexOf("(tabs)");
  if (at < 0) return [];
  return s.routes.slice(at + 1, top + 1).map((r) => {
    const params: Record<string, string> = {};
    for (const [k, v] of Object.entries(r.params ?? {})) if (typeof v === "string" || typeof v === "number") params[k] = String(v);
    return { pathname: `/${r.name}`, params };
  });
}
