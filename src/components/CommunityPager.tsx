"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { PageTabs, type PageTab } from "./ui/PageTabs";

/**
 * **تبويباتُ المجتمع الثلاثة حالةُ عميلٍ لا رحلةُ خادم** (D-522).
 *
 * ================= العطلُ الذي قِيس، بالإطار =================
 *
 * **«النشاط» و«نقاش» و«الأعضاء» مركَّبةٌ كلُّها في الصفحة أصلاً** — هذا
 * ثمنُ الانزلاق الذي دُفع في D-276، **وكلُّ نداءات الصفحة مشتركةٌ
 * بينها** (`pagerTab` واحدةٌ للثلاثة). **ومع ذلك كان كلُّ سحبةٍ تدفع
 * `router.push` ورحلةَ RSC كاملة (~٢٤٥ ك.ب) لتغيّر أيَّ لوحةٍ في
 * التدفّق.**
 *
 * 📏 **والمقيسُ على المنشور بسحبٍ حقيقيّ** — وهو ما يفسّر الرمشة:
 * - **وجهةٌ غير مُسخَّنة**: الالتزام عند `0`، ووصولُ RSC وقلبُ الأصناف
 *   عند **`+993`م.ث** — **والمسارُ ما زال عند `translate3d(-1136px,
 *   -800px)`** لحظةَ الالتزام، **فالإطارُ الذي يُرسم فيه التبويبُ
 *   الجديد يُرسم خارج الشاشة** ثم يُصفَّر من أثرٍ خاملٍ **بعد الرسم**.
 * - **وجهةٌ مُسخَّنة**: القلبُ عند **`+30`م.ث** — **في منتصف الحركة
 *   (٥٩٤ من ١١٣٦)** — ثم `transition: none` **فتُقصف الرحلةُ وتقفز
 *   الصفحة.** وهي حالةُ «التبديل السريع المتكرّر» بعينها.
 *
 * 🔑 **والجذرُ واحد**: **الحالةُ البصريّة والحالةُ المنطقيّة كانتا
 * تُحدَّثان في التزامين مختلفين بمالكين مختلفين** — والرمشةُ هي ما بينهما.
 *
 * ================= والعلاج: مالكٌ واحد =================
 *
 * **الفهرسُ صار هنا**، يملكه العميل: **السحبةُ تُكمل حركتَها، ثمّ نقلب
 * نحن الفهرسَ في اللحظة التي نختارها** (نهايةَ الحركة بالضبط)، **ونصفّر
 * التحويلَ في الالتزام نفسِه قبل الرسم** — **فالإطارُ الأوّل للتبويب
 * الجديد هو الإطارُ الأخير للحركة، بكسلاً بكسل.** ثم يُكتب العنوانُ
 * بـHistory API. **صفرُ RSC · صفرُ إعادةِ تركيب · صفرُ إطارٍ فارغ.**
 *
 * ⚠️ **وما بقي على الخادم عمداً**: `?tab=news` و`?tab=all` (سطحا رابطٍ
 * بلا لوحةٍ مركَّبة)، **و`?s=` و`?all=`** — **مساراتٌ بياناتُها من
 * الخادم، وتبديلٌ محلّيٌّ لها يعرض فراغاً ويسمّيه محتوى** (D-217).
 */

type PagerState = {
  /** الفهرسُ الحيّ — `-1` حين لا لوحاتِ سحبٍ أصلاً (`news`/`all`) */
  index: number;
  keys: string[];
  hrefs: string[];
  /** هل رُكِّبت اللوحاتُ فعلاً؟ — **الشريطُ لا يبدّل ما ليس مركَّباً** */
  ready: boolean;
  /** يعلنها `TabPager` عند تركيبه */
  setReady: (v: boolean) => void;
  /** يبدّل التبويبَ محلّيّاً ويكتب العنوان */
  go: (i: number, opts?: { scroll?: boolean }) => void;
};

const Ctx = createContext<PagerState | null>(null);

/** يعود `null` خارج المزوّد — **فمن لا مزوّدَ له يسلك مسارَه القديم** */
export function useCommunityPager(): PagerState | null {
  return useContext(Ctx);
}

export function CommunityPagerProvider({
  initialIndex,
  keys,
  hrefs,
  children,
}: {
  initialIndex: number;
  keys: string[];
  hrefs: string[];
  children: ReactNode;
}) {
  const [index, setIndex] = useState(initialIndex);
  const [ready, setReady] = useState(false);

  /* **قيمةُ الخادم إن تبدّلت** — تنقّلٌ حقيقيّ أو رابطٌ عميق. (نمطُ
     «تعديلُ الحالة أثناء الرسم» الموصى به، لا `useEffect` يرسم مرّتين.) */
  const [seen, setSeen] = useState(initialIndex);
  if (seen !== initialIndex) {
    setSeen(initialIndex);
    setIndex(initialIndex);
  }

  const hrefsKey = hrefs.join("|");
  const keysKey = keys.join("|");

  const go = useCallback(
    (i: number, opts?: { scroll?: boolean }) => {
      const list = hrefsKey.split("|");
      const href = list[i];
      if (!href) return;
      setIndex(i);
      /* **كلُّ تبويبٍ يبدأ من رأسه** (D-295 بحرفه) — والسحبةُ صفّرت
         المستندَ عند الالتزام، **فلا تُصفَّر مرّتين.** */
      if (opts?.scroll !== false) window.scrollTo(0, 0);
      window.history.pushState(null, "", href);
    },
    [hrefsKey],
  );

  /* **والرجوعُ والتقدّمُ يُقرآن من العنوان نفسِه.** أسطرُنا مكتوبةٌ
     بـ`pushState` فتُطابق `hrefs` حرفاً، **والرابطُ العميق بمعاملاتٍ
     زائدة يُقرأ من `?tab=`**، وما عداهما يعود إلى قيمة الخادم. */
  useEffect(() => {
    const onPop = () => {
      const list = hrefsKey.split("|");
      const here = window.location.pathname + window.location.search;
      let i = list.indexOf(here);
      if (i < 0) {
        const p = new URLSearchParams(window.location.search).get("tab");
        i = p ? keysKey.split("|").indexOf(p) : initialIndex;
      }
      if (i >= 0) setIndex(i);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [hrefsKey, keysKey, initialIndex]);

  const value = useMemo<PagerState>(
    () => ({
      index,
      keys: keysKey ? keysKey.split("|") : [],
      hrefs: hrefsKey ? hrefsKey.split("|") : [],
      ready,
      setReady,
      go,
    }),
    [index, keysKey, hrefsKey, ready, go],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * رأسُ تبويبات المجتمع — **`PageTabs` نفسُه بلا عائلةٍ ثانية** (القاعدة ٦).
 *
 * **والذي أضافه هذا الغلاف شيئان**: `active` يتبع الفهرسَ الحيّ لا قيمةَ
 * الخادم، **والضغطةُ على تبويبٍ مركَّبٍ تُبدّل اللوحةَ في مكانها.**
 *
 * ⚠️ **ولا يعترض إلا حين تكون اللوحاتُ مركَّبةً فعلاً** (`ready`):
 * في `?tab=news` و`?tab=all` **لا لوحاتِ سحبٍ أصلاً** — **فالروابطُ
 * تعمل كما كانت، ولا يَعِد الشريطُ بتبديلٍ لا يقع** (D-217).
 */
export function CommunityTabs({
  items,
  fallbackActive,
  ariaLabel,
  action,
}: {
  items: PageTab[];
  /** التبويبُ من الخادم — يُستعمل حين لا لوحاتِ سحب (`news`/`all`) */
  fallbackActive: string;
  ariaLabel: string;
  action?: ReactNode;
}) {
  const pager = useCommunityPager();
  const live = pager && pager.ready && pager.index >= 0;
  const active = live ? (pager.keys[pager.index] ?? fallbackActive) : fallbackActive;

  const withLocal = items.map((tb) => {
    if (!live) return tb;
    const i = pager.keys.indexOf(tb.key);
    if (i < 0) return tb;
    return {
      ...tb,
      onClick: (e: React.MouseEvent) => {
        /* **المرساةُ باقيةٌ والمعالجُ يسبقها** — ومع مفاتيح الفتح في
           تبويبٍ جديد يُترك الافتراضيُّ للمتصفّح كما هو. */
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        if (i !== pager.index) pager.go(i);
      },
    };
  });

  return (
    <PageTabs
      items={withLocal}
      active={active}
      ariaLabel={ariaLabel}
      asNav
      /* **الشريطُ يمشي مع اللوحة** (D-276) — ولا يُطلب إلا حيث تنزلق */
      swipe={!!pager && pager.index >= 0}
      action={action}
    />
  );
}
