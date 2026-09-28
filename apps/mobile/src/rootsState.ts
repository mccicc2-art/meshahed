/**
 * ====== حالةُ مجموعة الجذور — ملفٌّ بلا اعتماديّات كي يُختبر في `npm test` ======
 *
 * `bootRoot.ts` يستورد `BackHandler` و`expo-router` فلا يُقرأ في Node؛ فالحالةُ وقواعدُها هنا، وهو يغلّفها.
 *
 * - `boot`: المجموعةُ وُلدت من الإقلاع ⇐ رجوعُ الرئيسيّة خروجٌ من التطبيق، ورجوعُ أخواتها إلى الرئيسيّة.
 * - `homeSeen`: زار المستخدمُ الرئيسيّةَ في هذه المجموعة ⇐ لأخواتها رئيسيّةٌ يرجعن إليها.
 *
 * 🆕 **K3a-fix — العودةُ من بابٍ ويبيّ ترثُ حالةَ المجموعة التي فتحته** (تسجيلُ خالد ٢٨ سبتمبر وعلاماتُه):
 * «اكتشف» ← «المجتمع» ← رجوع عادت إلى «اكتشف» سليمة، لكنّ المجموعةَ الجديدة وُلدت «من الويب» (`boot=0`
 * و`homeSeen=0`)، فرجوعٌ ثانٍ منها (`nav.back why=pass`) نزعها وكشف صفحةَ «المجتمع» الميّتة تحتها، ورجوعٌ ثالثٌ
 * عليها لم يجد تاريخاً ولا وجهة (`nav.back why=exit`) فخرج من التطبيق. **البابُ رحلةٌ ذهاباً وإياباً لا مولدُ
 * مجموعةٍ جديدة**: فيُحفظ ما كانت عليه المجموعةُ لحظةَ فتحه (`doorLeft`) ويُستعاد عند العودة منه (`doorBack`)،
 * والصفحةُ الويبيّةُ تحت المجموعة لا يكشفها رجوعٌ بعد ذلك.
 */
export type Roots = { boot: boolean; homeSeen: boolean };

const roots: Roots = { boot: false, homeSeen: false };
/* ما كانت عليه المجموعةُ حين فُتح آخرُ باب — يُستهلك مرّةً عند العودة */
let door: Roots | null = null;
/* ما تبدأ به المجموعةُ القادمة من `homeSeen` (تركيبُها يصفّره إلّا إن كانت عودةً من باب) */
let nextSeen = false;

export function rootsState(): Readonly<Roots> {
  return roots;
}
/** مجموعةٌ تُدفع من الإقلاع (`true`) أو من صفحةٍ ويبيّةٍ لم تُفتح من جذر (`false`) */
export function rootsBorn(boot: boolean) {
  roots.boot = boot;
  nextSeen = false;
  door = null;
}
/** جذرٌ يفتح صفحةً ويبيّة (`shell.open` بوجهة عودة): تُحفظ حالةُ مجموعته */
export function doorLeft() {
  door = { boot: roots.boot, homeSeen: roots.homeSeen };
}
/**
 * عودةٌ من الباب (رجوعُ النظام، أو رسالةُ `native`، أو ضغطةُ الشريط على صفحته): المجموعةُ الجديدة تُكمل القديمة.
 * بلا بابٍ محفوظ (صفحةٌ لم تُفتح من جذر) ⇐ مولودةٌ من الويب كما كانت.
 */
export function doorBack() {
  if (!door) return rootsBorn(false);
  roots.boot = door.boot;
  nextSeen = door.homeSeen;
  door = null;
}
/** `(tabs)/_layout` عند التركيب */
export function rootsMounted() {
  roots.homeSeen = nextSeen;
  nextSeen = false;
}
/** الرئيسيّةُ ظهرت في هذه المجموعة */
export function homeSeen() {
  roots.homeSeen = true;
}

export type BackDecision = "exit" | "home" | "pass";
/** قرارُ رجوع النظام في جذر: `exit` خروج · `home` إلى الرئيسيّة · `pass` نزعُ المجموعة إلى ما تحتها */
export function backFrom(self: "/home" | "/library" | "/discover" | "/search"): BackDecision {
  if (self === "/home") return roots.boot ? "exit" : "pass";
  return roots.boot || roots.homeSeen ? "home" : "pass";
}

/** للاختبار وحدَه */
export function resetRootsForTest() {
  roots.boot = false;
  roots.homeSeen = false;
  door = null;
  nextSeen = false;
}
