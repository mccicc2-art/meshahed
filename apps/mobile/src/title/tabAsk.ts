/**
 * ====== 🆕 T502 — «افتح صفحةَ العمل على تبويبٍ بعينه» من خارجها ======
 *
 * صفُّ «المراجعات» في غرفة النقاش يفتح تبويبَ المراجعات (أحمد ٢٢ نوفمبر: «٥ أ»). طريقان:
 * - **جاء إلى الغرفة من صفحة العمل نفسِها** ⇒ يرجع إليها ويتحوّل تبويبُها، ولا تُدفع نسخةٌ ثانية فوقها: الدفعُ كان يصنع
 *   حلقةً (عمل ← نقاش ← عمل ← نقاش…) يحتاج الخروجُ منها رجوعاً بعدد الضغطات.
 * - **جاء من مكانٍ آخر** (تبويبُ النقاشات · إشعار · الأنشطة · رابط) ⇒ تُدفع صفحةُ العمل وتُفتح على التبويب.
 *
 * ⚖️ **طلبٌ معلَّقٌ لا معاملُ مسار**: الصفحةُ التي يُرجع إليها حيّةٌ في المكدّس فلا تقرأ معاملاتٍ جديدة، فالطلبُ واحدٌ للطريقين —
 * تأخذه الصفحةُ عند تركيبها (الدفع) أو عند عودة التركيز إليها (الرجوع)، ثمّ يُمحى. ويسقط بعد ثوانٍ كي لا يفتح تبويباً
 * في زيارةٍ لاحقةٍ لا علاقة لها به.
 */
export type TitleTab = "episodes" | "info" | "community";

let pending: { kind: "tv" | "movie"; id: number; tab: TitleTab; at: number } | null = null;

export function askTitleTab(kind: "tv" | "movie", id: number, tab: TitleTab) {
  pending = { kind, id, tab, at: Date.now() };
}

export function takeTitleTab(kind: "tv" | "movie", id: number): TitleTab | null {
  const p = pending;
  if (!p || p.kind !== kind || p.id !== id) return null;
  pending = null;
  return Date.now() - p.at < 10_000 ? p.tab : null;
}

type Route = { name: string; params?: Record<string, unknown>; state?: State };
type State = { index?: number; routes: Route[] } | undefined;

/** الشاشةُ التي تحت المعروضة مباشرةً في أعمق مكدّس — `null` إن كانت المعروضةُ أوّلَه */
export function previousRoute(root: unknown): { name: string; params: Record<string, string> } | null {
  let s = root as State;
  let found: { name: string; params: Record<string, string> } | null = null;
  while (s?.routes?.length) {
    const i = s.index ?? s.routes.length - 1;
    const prev = i > 0 ? s.routes[i - 1] : null;
    if (prev) {
      const params: Record<string, string> = {};
      for (const [k, v] of Object.entries(prev.params ?? {})) if (typeof v === "string" || typeof v === "number") params[k] = String(v);
      found = { name: prev.name, params };
    } else found = null;
    s = s.routes[i]?.state;
  }
  return found;
}
