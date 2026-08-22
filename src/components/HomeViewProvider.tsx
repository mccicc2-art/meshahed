"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { HomeView } from "@/lib/homePrefs";

/**
 * **وضعُ العرض حالةُ عميلٍ لا رحلةُ خادم** (D-434 يُنفَّذ أخيراً بحرفه).
 *
 * **التعريفُ نفسُه كان يقول الجواب**: «نفسُ البيانات ونفسُ الترتيب ونفسُ
 * النداءات، **والذي يتبدّل هو الشكل وحده**» — **ومع ذلك كان تبديلُ
 * الشكل يدفع دورةَ خادمٍ كاملة**: فعلُ خادمٍ يقرأ `home_prefs` ويكتبها
 * **ثم `revalidatePath("/")` ثم `router.refresh()`** — **رسمتان
 * كاملتان للرئيسية لتغيير شكلِ ثلاثة أقسام.**
 *
 * 📏 **والقياسُ من الإنتاج (٢٢ أغسطس، `loopztv.com` بحسابٍ حقيقيّ)**:
 * ضغطةٌ واحدة = `POST /` (٣٠٤م.ث · **٥٥ ك.ب RSC**) + `GET /?_rsc=`
 * (١٣٤م.ث · **٥٥ ك.ب أخرى — نفسُ الشجرة مرّتين**) + ثلاثةُ نداءات
 * تسخينٍ لِـ`/library`. **مئةٌ وعشرُ كيلوبايت وخمسُ رحلات لتبديل شكل.**
 *
 * **والحلُّ أن يُرسَم الشكلان معاً من البيانات نفسِها** (`ByHomeView`)
 * **ويُختار أحدُهما في العميل** — **فالتبديلُ صار إعادةَ رسمٍ محليّة**،
 * والحفظُ في `profiles.home_prefs` يمشي خلفَه لا أمامَه.
 *
 * ⚖️ **والثمنُ يُقال**: حمولةُ الصفحة تحمل رسمَ القسمين الثلاثة مرّتين
 * (نصّاً في `flight` لا صوراً — **الفرعُ غيرُ المختار لا يدخل الـDOM
 * فلا يُجلب له ملصقٌ واحد**). **وهو ثمنٌ يُدفع مرّةً عند فتح الصفحة
 * مقابل صفرِ رحلاتٍ عند كلِّ تبديل.**
 */

/**
 * **اختيارُ التبويب الحيّ** — متغيّرُ وحدةٍ عمداً، لا `sessionStorage`.
 *
 * **العلّةُ التي يعالجها**: كاشُ الراوتر يحفظ الرئيسيةَ ١٨٠ ثانية
 * (`staleTimes.dynamic`)، **فمن بدّل إلى المختصر ثم زار المكتبةَ وعاد
 * تُعاد إليه الحمولةُ المحفوظة بقيمة الخادم القديمة** — **فيرتدّ الشكلُ
 * تحت يده بلا سبب.** والمتغيّرُ هنا يعيش عمرَ الصفحة في الذاكرة فيصحّح
 * القيمةَ الابتدائية عند كلِّ تركيبٍ جديد.
 *
 * 🔑 **وعمرُه هو المقصود**: **إعادةُ فتح التطبيق تمسحه** — فتعود القيمةُ
 * من `profiles.home_prefs`، **وهي وحدَها ما يتزامن بين الأجهزة.**
 */
let tabChoice: HomeView | null = null;

/** يُخبر المخزنَ باختيارٍ جاء من بابٍ آخر (لوحُ التخصيص) */
export function rememberHomeView(view: HomeView) {
  tabChoice = view;
}

type HomeViewState = {
  view: HomeView;
  /** يبدّل فوراً ويسجّل الاختيار — الحفظُ في القاعدة مسؤوليةُ المستدعي */
  setView: (view: HomeView) => void;
};

const Ctx = createContext<HomeViewState | null>(null);

export function HomeViewProvider({
  initial,
  children,
}: {
  /** قيمةُ الخادم من `profiles.home_prefs` — الافتراضُ عند أوّل رسم */
  initial: HomeView;
  children: ReactNode;
}) {
  const [view, setLocal] = useState<HomeView>(() => tabChoice ?? initial);

  /* **قيمةُ الخادم إن تبدّلت ولم يختر صاحبُ التبويب بعد** — تبديلٌ من
     جهازٍ آخر يصل مع أوّل رسمٍ طازج. **ومن اختار في تبويبه فاختيارُه
     أحدثُ نيّةٍ معلنة** فلا تُنقض عليه. (نمطُ «تعديلُ الحالة أثناء
     الرسم» الموصى به في React — لا `useEffect` يرسم مرّتين.) */
  const [seenInitial, setSeenInitial] = useState(initial);
  if (seenInitial !== initial) {
    setSeenInitial(initial);
    if (tabChoice === null) setLocal(initial);
  }

  const setView = useCallback((next: HomeView) => {
    tabChoice = next;
    setLocal(next);
  }, []);

  return <Ctx.Provider value={{ view, setView }}>{children}</Ctx.Provider>;
}

export function useHomeView(): HomeViewState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useHomeView خارج HomeViewProvider");
  return ctx;
}

/**
 * **خانةُ الرسمين** — الخادمُ يرسم الشكلين من البيانات نفسِها، والعميلُ
 * يختار. **والفرعُ غيرُ المختار لا يُركَّب** فلا صورةَ تُجلب له.
 */
export function ByHomeView({
  visual,
  compact,
}: {
  visual: ReactNode;
  compact: ReactNode;
}) {
  const { view } = useHomeView();
  return <>{view === "compact" ? compact : visual}</>;
}
