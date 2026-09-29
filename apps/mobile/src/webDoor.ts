/* 🔴 **لا استيرادَ من `shell.ts` هنا — ولا نوعاً** (٢٩ سبتمبر): اختبارُ `scripts/k6/webDoor.test.ts` يقرأ هذا الملفّ، وفحصُ أنواع
   `next build` في Vercel يتبعه — و`shell.ts` يستورد `config.ts` ⇐ `expo-constants` غيرُ المثبَّت في بناء الويب، فسقط كلُّ نشرٍ للويب
   منذ K3b (N0 وN1 لم يصلا الإنتاج) والبناءُ المحلّيُّ ناجحٌ لأنّ حزمَ التطبيق مثبّتةٌ فيه. وجهةُ العودة هنا نصٌّ يُقارن فقط. */
type ReturnTo = string;

/**
 * ====== K3b — الويبُ طبقةٌ فوق المكدّس لا جذرٌ تحته ======
 *
 * **لماذا**: كان الـWebView جذرَ المكدّس (D-922)، ولا يُرى وفوقه شاشة — فكلُّ بابٍ ويبيٍّ من شاشةٍ أصليّة يُنزل
 * الشاشاتِ كلَّها (`dismissAll`) لتنكشف الصفحة، والعودةُ تبني مجموعةَ التبويبات من الصفر: صناديقُ «Picked for you»
 * فارغةً نصفَ ثانية (ملحق 04 ب)، وترقيعتان كي يعود المستخدمُ إلى مكانه (`resume` في M3-fix · `doorBack` في K3a-fix).
 * الآن الـWebView **طبقةٌ مركَّبةٌ دائماً فوق المكدّس** (`WebLayer`)، مخفيّةٌ حتى تُطلب: البابُ يُظهرها فوق الشاشة التي
 * فتحته، والعودةُ تُخفيها — والشاشةُ تحتها لم تُمسّ (موضعُ التمرير · التبويبُ الفرعيّ · الغرفةُ المفتوحة).
 *
 * 🔑 **متى تُرى الطبقة** — قاعدةٌ واحدةٌ تُحسب من حالة المكدّس الجذر (`visibleFor`):
 *  1. أعلى المكدّس مسارُ `web` نفسُه (الزائر · شاشةُ الدخول · صفحةٌ وُلدت من الويب أو من الودجت) — الطبقةُ هي الشاشة.
 *  2. **أو بابٌ مفتوح وأعلى المكدّس هو المرساةُ التي فتحته** — شاشةٌ أصليّةٌ دُفعت من الصفحة (عملٌ `from=web`) تعلوها
 *     فتُخفيها، ورجوعُها يكشف الصفحةَ من جديد كما كانت تكشفها حين كانت الصفحةُ تحتها.
 * المرساةُ نُزعت من المكدّس (خروج · `dismissAll` قديم · رجوعٌ تجاوزها) ⇒ البابُ أُغلق (`prune`).
 *
 * 🔑 **ولماذا مرئيّةٌ بالشفافيّة لا مطويّة**: صفحةُ الباب تُحمَّل والطبقةُ مخفيّة (الشاشةُ الأصليّة تبقى حتى تصل — D-951)،
 * وطيُّها (`display: none`) يجعل عرضَ الصفحة صفراً ساعةَ تحميلها — والويبُ يحسب أعمدتَه وقوائمَه من العرض.
 * والطبقةُ لا تُنزع من النافذة أبداً (كانت `react-native-screens` تنزع شاشةَ الويب المغطّاة — D-1144)، فالحقنُ فيها يصل.
 */
type Route = { name: string; key: string; params?: Record<string, unknown>; state?: State };
export type State = { index?: number; routes: Route[] } | undefined;

type Door = { anchor: string; root: ReturnTo; path: string };

let door: Door | null = null;
let attached = false;
let topKey: string | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

/** المكدّسُ الجذر: الحالةُ التي فيها مسارُ `web` (قد تلفّها حالةٌ أعلى في expo-router) */
export function rootStack(s: State): State {
  if (!s?.routes) return undefined;
  if (s.routes.some((r) => r.name === "web")) return s;
  for (const r of s.routes) {
    const f = rootStack(r.state);
    if (f) return f;
  }
  return undefined;
}

export function topOf(s: State): Route | undefined {
  const st = rootStack(s);
  if (!st) return undefined;
  return st.routes[st.index ?? st.routes.length - 1];
}

export const webLayer = {
  subscribe(f: () => void) {
    subs.add(f);
    return () => {
      subs.delete(f);
    };
  },
  /** الطبقةُ مركَّبة (`WebLayer`) — بدونها يبقى البابُ على الطريق القديم (`dismissAll`) */
  attach(on: boolean) {
    attached = on;
    if (!on) door = null;
  },
  canLayer: () => attached && !!topKey,
  /** يُنادى من الطبقة مع كلِّ تغيّرٍ في المكدّس: أعلاه، ومرساةٌ نُزعت تُغلق بابَها */
  sync(s: State) {
    const st = rootStack(s);
    const top = topOf(s);
    topKey = top?.key ?? null;
    if (door && st && !st.routes.some((r) => r.key === door?.anchor)) {
      door = null;
      emit();
    }
  },
  /** البابُ وصلت صفحتُه: يُرسى على الشاشة المعروضة الآن — والطبقةُ تظهر فوقها */
  openDoor(root: ReturnTo, path: string) {
    if (!topKey) return false;
    door = { anchor: topKey, root, path };
    emit();
    return true;
  },
  door: (): Readonly<Door> | null => door,
  /** العودةُ من الباب: الطبقةُ تختفي والمرساةُ تحتها كما تُركت */
  closeDoor() {
    if (!door) return;
    door = null;
    emit();
  },
  /** `top` = أعلى المكدّس الجذر (`topOf`) */
  visibleFor(top: { key: string; name: string } | null | undefined): boolean {
    if (!top) return true; /* قبل أوّل حالة: الإقلاعُ يرسم الطبقة (شاشةُ التحميل) */
    if (top.name === "web") return true;
    return !!door && top.key === door.anchor;
  },
};
