import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BackHandler, I18nManager, Keyboard, Platform, Pressable, View, useWindowDimensions, type ViewInstance } from "react-native";
import { useNavigationContainerRef, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TOUR_STEPS, appBodyOf, appTitleOf, type TourScreen, type TourState } from "@/core/tour";
import { queryClient, qk } from "../api";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import { haptic } from "../haptics";
import { navHeight } from "../BottomNav";
import { rootStack, topOf, webLayer, type State } from "../webDoor";
import { HOME_KEY } from "../home/useHome";
import type { HomePayload, LibraryPayload } from "../contracts";
import { tourStore } from "./store";
import { touchTarget } from "../touchTargets";
import { measureAnchor, revealAnchor, type AnchorRect } from "./anchors";
import { drawerStore } from "../drawer/store";
import { PlusTag } from "../drawer/SideDrawer";

/* D-1477 — انظر `rx` في الرسم */
const RING_FLIP = Platform.OS === "ios" && I18nManager.isRTL;

/**
 * ====== مضيفُ الجولة — بطاقةٌ فوق الشاشات الأصليّة (🆕 D-1318 · Phase 11-T · T1) ======
 *
 * **لماذا**: العضوُ في التطبيق لم تكن تُعرَض عليه الجولةُ قطّ (عرضُها في تخطيط الويب)، ومن «المساعدة» كانت تفتح صفحةَ
 * ويبٍ وتمشي على نسخٍ ويبيّةٍ لشاشاتٍ أصليّة. الآن تُرسم هنا، فوق الشاشات نفسِها التي تشرحها.
 *
 * 🔑 **بطاقةٌ لا غشاء** (وصفةُ `TourGuide` في الويب، وحكمُ أحمد «اقتراحك»): الشاشةُ تحتها حيّةٌ تُمرَّر وتُضغط —
 * `pointerEvents="box-none"` على كلِّ ما ليس البطاقة. جولةٌ تحجب ما تشرحه تناقض غرضَها.
 *
 * 🔑 **السجلُّ سجلُّ الويب نفسُه** (`core/tour.ts`): الخطواتُ ونصوصُها وترتيبُها من هناك. هنا ما لا يعرفه إلّا
 * التطبيق — مسارُ كلِّ شاشة، وقياسُ الزرّ.
 *
 * 🔑 **ومكانُه بعد `WebLayer` في الجذر**: يُرسم فوق المكدّس وفوق الطبقة. **ولا يظهر والطبقةُ هي الشاشة** (زائرٌ ·
 * بابٌ ويبيٌّ فتحه القارئُ وسطَ الجولة): البطاقةُ تعود حين يعود، ولا تُبحر بالتبويبات تحت صفحةٍ تغطّيها.
 *
 * ⚠️ **ما لم يُجرَّب إلّا على الهاتف**: موضعُ الحلقة (قياس)، وتقاطعُ زرِّ الرجوع مع رجوع كلِّ شاشة.
 */

/**
 * تبويبُ كلِّ خطوة — و«القائمة» و«التخصيص» يبدآن من الرئيسيّة: الأوّلُ يضغط صورتَه هناك، والثاني يُدفع فوقها.
 * 🆕 T357 — و«الربط» يُدفع فوق المجتمع لا الرئيسيّة: من رجع منها بسهمها وقف على الخطوة السابقة نفسِها (`PUSHED`).
 */
const TAB_OF: Record<TourScreen, "/home" | "/discover" | "/search" | "/library" | "/community"> = {
  discover: "/discover",
  search: "/search",
  library: "/library",
  home: "/home",
  menu: "/home",
  customize: "/home",
  community: "/community",
  links: "/community",
};
/** اسمُ التبويب في مجموعة `(tabs)` الذي تقف عليه الخطوة — به يُعرف «هل الزرُّ المقصودُ أمامه الآن؟» */
const TAB_NAME: Record<TourScreen, string> = {
  discover: "discover",
  search: "search",
  library: "library",
  home: "home",
  menu: "home",
  customize: "home",
  community: "community",
  links: "community",
};
/**
 * 🆕 T357 — **خطواتٌ شاشتُها تُدفع فوق التبويبات**: اسمُ المسار في المكدّس الجذر، وكيف يُدفع. منها يُعرف «وصل إليها» و«رجع منها
 * بسهمها» (فيعود إلى الخطوة السابقة دون إبحار — هو فيها)، وأنّ الرجوعَ فيها رجوعُ الجولة.
 */
const PUSHED: Partial<Record<TourScreen, { name: string; section?: string; href: () => Parameters<ReturnType<typeof useRouter>["push"]>[0] }>> = {
  customize: { name: "settings/[section]", section: "home", href: () => ({ pathname: "/settings/[section]", params: { section: "home" } }) },
  links: { name: "links", href: () => "/links" },
};

/** مهلةٌ قبل العرض والاستئناف عند الإقلاع: الرئيسيّةُ ترسم، وضغطةُ إشعارٍ تذهب لوجهتها (`PushGate`) أوّلاً */
const SETTLE_MS = 1200;
/** القياسُ يُعاد: الشاشةُ تُبحر ثمّ ترسم ثمّ يعود رأسُها — وزرٌّ يُقاس قبل أن يستقرّ يُقاس في غير مكانه */
const MEASURE_AT_MS = [120, 450, 1000];
/** ثمّ يُعاد ما دام الزرُّ أمامه: القارئُ يمرّر الشاشةَ تحت البطاقة، وحلقةٌ تبقى حيث كان الزرُّ تشير إلى فراغ */
const MEASURE_EVERY_MS = 500;

type Top = { key: string; name: string; tab: string | null; section: string | null };

function readTop(s: State): Top | null {
  const r = topOf(s);
  if (!r) return null;
  const inner = r.state;
  /* قبل أوّل تبديلٍ داخل المجموعة لا حالةَ لها هنا — فالتبويبُ الذي دُفعت به (`params.screen`)، وإلّا «لا أعرف» */
  const pushed = typeof r.params?.screen === "string" ? r.params.screen : null;
  const tab = r.name === "(tabs)" ? inner?.routes[inner.index ?? 0]?.name ?? pushed : null;
  /* 🆕 T357 — قسمُ الإعدادات الظاهر: «التخصيص» وحدَه يُدخل خطوتَه، لا أيُّ صفحة إعدادات */
  const section = typeof r.params?.section === "string" ? r.params.section : null;
  return { key: r.key, name: r.name, tab, section };
}

/** قيمةٌ من كاش الاستعلامات بلا مراقبٍ ثانٍ — مراقبٌ بلا `queryFn` على مفتاح الرئيسيّة يسرق دالّتَها عند الإبطال */
function useCachedTour<T extends { tour?: TourState | null }>(key: readonly unknown[]): TourState | null | undefined {
  return useSyncExternalStore(
    useCallback((fn: () => void) => queryClient.getQueryCache().subscribe(fn), []),
    () => queryClient.getQueryData<T>(key)?.tour,
  );
}

export function TourHost() {
  const { t, tokens, me } = useApp();
  /* ما يُقفل على غير المشترك يُقال له وحدَه (حكمُ أحمد «٥أ») — والذهبيُّ مشتركٌ (`plus` يشمله) */
  const plus = me?.plus ?? false;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const nav = useNavigationContainerRef();

  /* أعلى المكدّس الجذر والتبويبُ الظاهر — منهما: هل تُرى البطاقة، وهل الزرُّ المقصودُ أمامه */
  const [top, setTop] = useState<Top | null>(null);
  useEffect(() => {
    const read = () => {
      const next = readTop((nav.isReady() ? nav.getRootState() : undefined) as unknown as State);
      setTop((p) => (p?.key === next?.key && p?.name === next?.name && p?.tab === next?.tab && p?.section === next?.section ? p : next));
    };
    read();
    return nav.addListener("state", read);
  }, [nav]);
  useSyncExternalStore(webLayer.subscribe, () => webLayer.door());

  const snap = useSyncExternalStore(tourStore.subscribe, tourStore.get);
  const fromHome = useCachedTour<HomePayload>(HOME_KEY);
  const fromLibrary = useCachedTour<LibraryPayload>(qk.tag("me:library"));
  const state = tourStore.resolve(fromHome !== undefined ? fromHome : fromLibrary);

  /* شاشةٌ أصليّةٌ ظاهرة — لا الطبقةُ الويبيّة ولا ما قبل الإقلاع */
  const native = !!top && top.name !== "web" && top.name !== "index" && !webLayer.visibleFor(top);
  /* الرئيسيّةُ تقول إنّها الظاهرة (`tourStore.setHome`) — أوثقُ من حالة التبويبات عند الإقلاع (انظر `store.ts`) */
  const onHome = native && top?.name === "(tabs)" && snap.home;

  /* ——— العرض: مرّةً، على الرئيسيّة، بعد أن تهدأ ——— */
  const [prompt, setPrompt] = useState(false);
  useEffect(() => {
    if (state !== null || !onHome || prompt) return;
    const id = setTimeout(() => {
      /* «يظهر مرّةً» بنصّ أحمد: يُسجَّل «اقتُرح» لحظةَ عرضه — فلا يعود ولو أُهمل بلا ضغطة (عُرفُ `TourMount`) */
      tourStore.save({ i: 0, s: "suggested" });
      setPrompt(true);
    }, SETTLE_MS);
    return () => clearTimeout(id);
  }, [state, onHome, prompt]);
  /* غادر الرئيسيّةَ والعرضُ أمامه ⇒ أهمله: لا يعود حين يرجع، ولا تبقى التلميحاتُ صامتةً بقيّةَ الجلسة لأجله */
  useEffect(() => {
    if (prompt && native && !onHome) setPrompt(false);
  }, [prompt, native, onHome]);

  const active = state?.s === "active";
  const index = active ? Math.min(state.i, TOUR_STEPS.length - 1) : 0;
  const step = TOUR_STEPS[index];
  const last = index === TOUR_STEPS.length - 1;

  useEffect(() => {
    tourStore.setBusy(active || prompt);
  }, [active, prompt]);
  useEffect(() => {
    tourStore.setStep(active ? step.id : null);
  }, [active, step.id]);
  useEffect(
    () => () => {
      tourStore.setBusy(false);
      tourStore.setStep(null);
    },
    [],
  );
  /* 🆕 T357 — القائمةُ الجانبيّة مفتوحة؟ خطوتُها بمرحلتين: قبل الفتح وبعده */
  const drawerOpen = useSyncExternalStore(drawerStore.subscribe, drawerStore.get) !== null;

  /* ——— الإبحار: كلُّ تبدّلِ خطوةٍ يفتح شاشتَها ——— */
  const gone = useRef<number | null>(null);
  const booted = useRef(false);
  /* 🆕 T357 — إبحارٌ ينتظر إغلاقَ القائمة: يجري حين تُغلق، **إن بقيت الجولةُ على خطوته** — وإلّا فقد سبقه إبحارٌ أحدث */
  const pending = useRef<{ i: number; run: () => void } | null>(null);
  const go = useCallback(
    (i: number) => {
      const target = TOUR_STEPS[i];
      const run = () => {
        /* ما فوق مجموعة التبويبات يُنزَل أوّلاً (ملفٌّ فتحه، إعداداتٌ بدأ منها، عملٌ دخله وسطَ الجولة) — وصفةُ
           `goRoot` في `WebLayer` حرفاً: `dismiss` بالعدد ثمّ تبديلُ التبويب الحيّ */
        const st = rootStack((nav.isReady() ? nav.getRootState() : undefined) as unknown as State);
        if (st) {
          const at = st.index ?? st.routes.length - 1;
          const tabs = st.routes.slice(0, at + 1).map((r) => r.name).lastIndexOf("(tabs)");
          if (tabs >= 0 && at > tabs) router.dismiss(at - tabs);
        }
        router.navigate(TAB_OF[target.screen]);
        const pushed = PUSHED[target.screen];
        if (pushed) router.push(pushed.href());
        if (target.anchor) revealAnchor(target.anchor);
      };
      /* 🆕 T357 — **القائمةُ تُغلق قبل أيِّ إبحار** («التالي» و«السابق» وهي مفتوحة): الشاشةُ تتبدّل تحت لوحٍ يغطّيها فلا يُرى
         ما تشرحه البطاقة. ⚠️ **والإبحارُ لا يُعلَّق على نداءِ `close`** (مراجعةٌ مستقلّة): القائمةُ تحفظ نداءً واحداً، وضغطةٌ على
         الحجاب أو إمساكُ اللوح في أثناء انزلاقه يمحوه — فتتقدّم البطاقةُ ولا تتبدّل الشاشة. فيُحفظ هنا، ويجري حين تُغلق فعلاً */
      if (drawerStore.get()) {
        pending.current = { i, run };
        drawerStore.close();
      } else run();
    },
    [nav, router],
  );
  useEffect(() => {
    if (!active) {
      gone.current = null;
      return;
    }
    if (!native || gone.current === index) return;
    /* أوّلُ ما يُرى بعد الإقلاع (جولةٌ قُطعت أمس) ينتظر؛ وما بعده فوريّ — ضغطةُ «التالي» لا تتأخّر */
    const wait = booted.current ? 0 : SETTLE_MS;
    const id = setTimeout(() => {
      booted.current = true;
      gone.current = index;
      go(index);
    }, wait);
    return () => clearTimeout(id);
  }, [active, native, index, go]);
  useEffect(() => {
    if (drawerOpen || !pending.current) return;
    const p = pending.current;
    pending.current = null;
    if (active && p.i === index) p.run();
  }, [drawerOpen, active, index]);
  useEffect(() => {
    /* أيُّ تفاعلٍ قبل أن تبدأ جولةٌ يعني أنّ الإقلاعَ انتهى: «ابدأ» من العرض أو من «المساعدة» لا ينتظر */
    if (prompt || (native && !active)) booted.current = true;
  }, [prompt, native, active]);

  const move = useCallback((i: number) => tourStore.save({ i, s: "active" }), []);
  const end = useCallback(
    (finished: boolean) => {
      tourStore.save({ i: index, s: "done" });
      /* من أتمّها قرأ «البحث بالوصف» و«تخصيص الرئيسيّة» في بطاقتيهما — ومن تخطّاها يجد تلميحتَيهما كما اليوم */
      if (finished) tourStore.markHints(["search-desc", "home-customize"]);
    },
    [index],
  );

  /* ——— خطوةُ القائمة: يضغط صورتَه بنفسه (حكمُ أحمد) — والبطاقةُ تدعوه، ثمّ تصف ما فتحه وتدعوه إلى «التخصيص» ——— */
  const opened = step.screen === "menu" && drawerOpen;
  const lead = step.lead && step.screen === "menu" && !opened ? step.lead : null;
  const tapLine = opened && step.tap ? step.tap(t) : null;
  const pushedNow = !!PUSHED[step.screen];
  /* هل الظاهرُ شاشةُ خطوةٍ مدفوعة؟ — «التخصيص» بقسمه لا أيُّ صفحة إعدادات */
  const onPushed = useCallback(
    (scr: TourScreen) => {
      const p = PUSHED[scr];
      return !!p && top?.name === p.name && (!p.section || top?.section === p.section);
    },
    [top],
  );

  /* ——— 🆕 T357 — ضغط «التخصيص» من القائمة في خطوتها ⇒ الخطوةُ التالية، **بلا إبحار**: هو فيها (`gone`) ———
     🔴 **والانتقالُ انتقالٌ من التبويبات إلى «التخصيص» داخلَ الخطوة** لا مجرّدُ «التخصيصُ ظاهر» (مراجعةٌ مستقلّة): «السابق»
     وزرُّ الرجوع في خطوة التخصيص يكتبان خطوةَ القائمة والتخصيصُ ما زال أعلى المكدّس — فكانت تُعيده إليها فوراً ويعلق فيها.
     فلا يُحسب وصولاً إلّا ما سبقه وقوفٌ على التبويبات في هذه الخطوة نفسِها (`menuOnTabs`). */
  const menuOnTabs = useRef(false);
  useEffect(() => {
    if (!active || step.screen !== "menu") {
      menuOnTabs.current = false;
      return;
    }
    if (top?.name === "(tabs)") {
      menuOnTabs.current = true;
      return;
    }
    if (!menuOnTabs.current || !onPushed("customize")) return;
    const next = index + 1;
    if (TOUR_STEPS[next]?.screen !== "customize") return;
    menuOnTabs.current = false;
    gone.current = next;
    move(next);
  }, [active, step.screen, top, onPushed, index, move]);

  /* ——— شاشةٌ مدفوعة («التخصيص» و«الربط»): من خرج منها بسهمها عاد إلى ما تحتها — وهو الخطوةُ السابقة ——— */
  const arrived = useRef(false);
  useEffect(() => {
    if (!active || !pushedNow) {
      arrived.current = false;
      return;
    }
    if (onPushed(step.screen)) arrived.current = true;
    else if (arrived.current && top?.name === "(tabs)") {
      arrived.current = false;
      gone.current = index - 1;
      move(index - 1);
    }
  }, [active, pushedNow, onPushed, step.screen, top, index, move]);

  /* ——— الحلقة: تُقاس حين يكون الزرُّ أمامه، وتسقط حين لا يكون ——— */
  const onTab = TAB_NAME[step.screen] === "home" ? snap.home : top?.tab === TAB_NAME[step.screen];
  /* 🆕 T357 — والقائمةُ مفتوحةً في خطوتها: الحلقةُ على صفّ «التخصيص» داخلها */
  const anchorNow = opened ? step.openAnchor : step.anchor;
  const facing = active && native && !!anchorNow && top?.name === "(tabs)" && onTab;
  const [ring, setRing] = useState<AnchorRect | null>(null);
  useEffect(() => {
    setRing(null);
    const anchor = anchorNow;
    if (!facing || !anchor) return;
    let live = true;
    const measure = () =>
      void measureAnchor(anchor).then((r) => {
        /* المرجعُ نفسُه حين لم يتحرّك الزرّ — قياسٌ كلَّ نصف ثانيةٍ لا يعيد رسمَ البطاقة */
        if (live) setRing((p) => (p && r && p.x === r.x && p.y === r.y && p.w === r.w && p.h === r.h ? p : r));
      });
    const timers = MEASURE_AT_MS.map((ms) => setTimeout(measure, ms));
    const every = setInterval(measure, MEASURE_EVERY_MS);
    return () => {
      live = false;
      timers.forEach(clearTimeout);
      clearInterval(every);
    };
  }, [facing, anchorNow, index]);

  /**
   * 🔴 D-1319 — **البطاقةُ تصعد فوق لوحة المفاتيح** (بلاغُ أحمد بتسجيل، ٨ أكتوبر: «الكيبورد يغطي عليها» — في خطوة
   * البحث ضغط النجمةَ ثمّ الحقل، فغطّت اللوحةُ البطاقةَ بزرَّيها). اللوحةُ في التطبيق تعلو المحتوى ولا تدفعه، والبطاقةُ
   * مثبّتةٌ بأسفل الشاشة. حكمُه «الحل 1»: تصعد ولا تختفي — جولةٌ تفقد «التالي» و«السابق» وهو يكتب تُقرأ منتهية.
   * الارتفاعُ من حافّة اللوحة العليا إلى أسفل النافذة، وإلّا فارتفاعُها كما يبلّغه النظام — أيُّهما أكبر.
   */
  const [keyboard, setKeyboard] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) => {
      const fromTop = e.endCoordinates.screenY > 0 ? H - e.endCoordinates.screenY : 0;
      setKeyboard(Math.max(0, Math.round(Math.max(e.endCoordinates.height, fromTop))));
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboard(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [H]);

  /* ——— زرُّ الرجوع: الخطوةُ السابقة، وفي الأولى خروجٌ من الجولة (حكمُ أحمد «اقتراحك») ——— */
  const shown = active && native;
  /* الشاشةُ التي تقف عليها الخطوة: جذرٌ من التبويبات، أو شاشتُها المدفوعة («التخصيص» أو «الربط») في خطوتها */
  const atStep = top?.name === "(tabs)" || onPushed(step.screen);
  useEffect(() => {
    if (!shown) return;
    const onBack = () => {
      /* شاشةٌ فتحها هو فوق الخطوة (ملفُّه في خطوته، عملٌ ضغطه تحت البطاقة): رجوعُها رجوعُها — يغلقها ويبقى
         في الخطوة. الشاشةُ تحت البطاقة حيّة، ورجوعٌ منها لا يُقرأ «الخطوة السابقة». */
      if (!atStep) return false;
      if (index === 0) end(false);
      else move(index - 1);
      return true;
    };
    /* 🔑 **آخرُ مسجَّلٍ أوّلُ من يُسأل**، والشاشاتُ تسجّل رجوعَها عند ظهورها — فيُعاد التسجيلُ بعد كلِّ تبدّلٍ
       في المكدّس أو التبويب، ومرّةً ثانيةً بعد أن تستقرّ آثارُ الظهور */
    let sub = BackHandler.addEventListener("hardwareBackPress", onBack);
    const id = setTimeout(() => {
      sub.remove();
      sub = BackHandler.addEventListener("hardwareBackPress", onBack);
    }, 450);
    return () => {
      clearTimeout(id);
      sub.remove();
    };
  }, [shown, index, atStep, top, end, move]);

  /* 🩺 المهمّة ٣١٩ (تقييمُ ٥ نوفمبر ٢أ) — بطاقةُ الجولة تقعد فوق الدوك: تُسجَّل هدفاً ما دامت مرسومة */
  const cardRef = useRef<ViewInstance>(null);
  /* 🆕 T357 — ارتفاعُ البطاقة (يُقاس): به يُعرف هل تغطّي الزرَّ المحاط — صفُّ «التخصيص» في القائمة يقع حيث تقف البطاقة */
  const [cardH, setCardH] = useState(0);
  useEffect(() => touchTarget("tour", (cb) => cardRef.current?.measureInWindow(cb), () => cardRef.current != null), []);

  if (!native) return null;
  if (!shown && !(prompt && onHome)) return null;

  /* فوق الشريط السفليّ في الجذور (قاعدةُ مضيف الإشعار)، وفوق منطقة الأمان في الشاشات المدفوعة — **وفوق لوحة
     المفاتيح حين تُفتح** (D-1319) */
  const bottom = keyboard > 0 ? keyboard + 12 : top?.name === "(tabs)" ? navHeight(insets.bottom) + 12 : insets.bottom + 16;
  const card = {
    width: "100%" as const,
    maxWidth: 448,
    borderRadius: radius.sheet,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.elevated,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  };
  const disc = (
    <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: tokens.accent + "1A" }}>
      <Icon name="sparkles" size={18} color={tokens.accent} />
    </View>
  );

  if (!shown) {
    return (
      <View pointerEvents="box-none" style={{ position: "absolute", left: 16, right: 16, bottom, alignItems: "center" }}>
        <View ref={cardRef} accessibilityRole="summary" accessibilityLabel={t.tourSuggestTitleApp} style={card}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            {disc}
            <Text size={14} weight="600" style={{ flex: 1, lineHeight: 21 }}>{t.tourSuggestTitleApp}</Text>
          </View>
          {/* صفٌّ ثانٍ للزرّين: الجملةُ تذكر طولَ الجولة فلا تتّسع لها ولهما في سطرِ هاتف */}
          <View style={{ marginTop: 12, flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
            <Button label={t.tourLater} variant="ghost" size="sm" onPress={() => setPrompt(false)} />
            <Button
              label={t.tourStart}
              size="sm"
              onPress={() => {
                haptic.pick();
                setPrompt(false);
                tourStore.start();
              }}
            />
          </View>
        </View>
      </View>
    );
  }

  const PAD = 6;
  const TAP_W = 120;
  const title = appTitleOf(step, t);
  /* 🆕 T357 — **البطاقةُ لا تغطّي ما تدعوه إلى ضغطه**: صفُّ «التخصيص» في القائمة المفتوحة قد يقع تحتها على هاتفٍ قصير أو
     بخطٍّ مكبَّر. فإن نزل أسفلُ الحلقة (ومعها «اضغط هنا») إلى حيث تبدأ البطاقة، صعدت البطاقةُ إلى أعلى الشاشة */
  const pill = !!(lead || tapLine);
  const below = ring ? ring.y + ring.h + PAD + (pill ? 48 : 8) : 0;
  /* ما تغطّيه البطاقةُ في كلّ موضع (بالنقاط، صفرٌ = لا شيء): أسفلُ الحلقة تحت حافّتها العليا وهي في الأسفل، أو حافّتُها
     السفلى تحت أعلى الهالة وهي في الأعلى — **فالجانبُ الأقلُّ تغطيةً**، والأسفلُ عند التعادل كما كانت دائماً (مراجعةٌ مستقلّة:
     الأعلى بلا فحصٍ كان قد يغطّي الصفَّ نفسَه على هاتفٍ قصير) */
  const overBottom = ring && cardH > 0 ? Math.max(0, below - (H - bottom - cardH)) : 0;
  const overTop = ring && cardH > 0 ? Math.max(0, insets.top + 12 + cardH - (ring.y - PAD - 5)) : 0;
  const atTop = keyboard === 0 && overBottom > 0 && overTop < overBottom;
  const place = atTop ? { top: insets.top + 12 } : { bottom };
  /* لا مكانَ بلا تغطية ⇒ تسقط «اضغط هنا» (البطاقةُ تقولها نصّاً) — حبّةٌ تحت البطاقة لا تُرى، وفوقها تغطّي أكثر */
  const showPill = pill && (atTop ? overTop === 0 : overBottom === 0);
  /* 🆕 D-1477 — **الحلقةُ في مكان زرّها على الآيفون بالعربيّ** (لقطاتُ أحمد ١٩ أكتوبر: حلقةُ «صورتك» على زرّ الإعدادات، و«النجمة»
     على أيقونة البحث، و«زرّ الفلتر» على تبويب «مسلسلات» — كلٌّ في الطرف المقابل). `measureInWindow` يعطي السينَ من يسار الشاشة
     الحقيقيّ، و`left` في واجهةٍ مقلوبةٍ يُقرأ «بداية» أي من اليمين — فتنعكس. هنا تُعكس السينُ قبل الرسم فيلتقي الاثنان.
     ⚖️ الآيفونُ وحدَه: الأندرويدُ بالعربيّ لم يُرَ بعدُ (سؤالٌ مفتوح لأحمد)، فلا نمسّه حتى يُرى. */
  const rx = ring ? (RING_FLIP ? W - ring.x - ring.w : ring.x) : 0;
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}>
      {ring ? (
        <>
          {/* هالةٌ ثمّ حلقة — بلونِ السمة لا رقمٍ مكتوب، ولا تلتقط لمساً: الزرُّ تحتها يُضغط */}
          <View pointerEvents="none" style={{ position: "absolute", left: rx - PAD - 5, top: ring.y - PAD - 5, width: ring.w + (PAD + 5) * 2, height: ring.h + (PAD + 5) * 2, borderRadius: (ring.h + (PAD + 5) * 2) / 2, backgroundColor: tokens.accent + "29" }} />
          <View pointerEvents="none" style={{ position: "absolute", left: rx - PAD, top: ring.y - PAD, width: ring.w + PAD * 2, height: ring.h + PAD * 2, borderRadius: (ring.h + PAD * 2) / 2, borderWidth: 2.5, borderColor: tokens.accent }} />
          {showPill ? (
            /* «اضغط هنا» — لخطوة القائمة وحدَها (حكمُ أحمد): تحت الصورة، ثمّ تحت صفّ «التخصيص» حين تُفتح — منتصفُها منتصفُ ما تحته */
            <>
              {/* السهمُ تحت منتصف الصورة، والحبّةُ تُقصّ إلى حافّتَي الشاشة — الصورةُ في الطرف، وحبّةٌ تتوسّطها تخرج منه */}
              <View pointerEvents="none" style={{ position: "absolute", left: rx + ring.w / 2 - 5, top: ring.y + ring.h + PAD + 8, width: 10, height: 10, backgroundColor: tokens.accent, transform: [{ rotate: "45deg" }] }} />
              <View pointerEvents="none" style={{ position: "absolute", left: Math.max(8, Math.min(rx + ring.w / 2 - TAP_W / 2, W - TAP_W - 8)), width: TAP_W, top: ring.y + ring.h + PAD + 13, alignItems: "center" }}>
                <View style={{ backgroundColor: tokens.accent, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 }}>
                  <Text size={13} weight="700" color={tokens.onAccent} numberOfLines={1}>{t.tourTapHere}</Text>
                </View>
              </View>
            </>
          ) : null}
        </>
      ) : null}

      <View pointerEvents="box-none" style={{ position: "absolute", left: 16, right: 16, ...place, alignItems: "center" }}>
        <View ref={cardRef} onLayout={(e) => setCardH(Math.round(e.nativeEvent.layout.height))} accessibilityRole="summary" accessibilityLabel={title} style={card}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
            {disc}
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text size={15} weight="700" style={{ flexShrink: 1 }}>{title}</Text>
                {/* حكمُ أحمد «٥أ»: البطاقةُ تقول إنّ ما تشرحه مقفلٌ عليه — بوسم القائمة نفسِه */}
                {step.plusTag?.(plus) ? <PlusTag /> : null}
              </View>
              <Text size={12} muted style={{ marginTop: 4, lineHeight: 19 }}>{lead ? lead(t) : appBodyOf(step, t, plus)}</Text>
              {tapLine ? (
                <Text size={12} weight="700" color={tokens.accent} style={{ marginTop: 6, lineHeight: 19 }}>{tapLine}</Text>
              ) : null}
            </View>
            <Pressable onPress={() => end(false)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t.tourSkip} style={{ width: 32, height: 32, marginTop: -4, marginEnd: -4, borderRadius: 16, alignItems: "center", justifyContent: "center" }}>
              <Icon name="close" size={15} color={tokens.muted} />
            </Pressable>
          </View>
          <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              {TOUR_STEPS.map((s, i) => (
                /* D-1319 — الخاملةُ بلون النصّ الخافت شفيفاً لا `surface2`: هو لونُ البطاقة نفسُه (`elevated`) فلم تكن تُرى */
                <View key={s.id} style={{ width: i === index ? 16 : 6, height: 6, borderRadius: 3, backgroundColor: i === index ? tokens.accent : tokens.muted + "55" }} />
              ))}
            </View>
            {/* العدُّ نصّاً — النقاطُ لا يقرؤها قارئُ الشاشة */}
            <Text size={12} muted style={{ writingDirection: "ltr" }}>{`${index + 1} / ${TOUR_STEPS.length}`}</Text>
            <View style={{ flex: 1 }} />
            {index > 0 ? <Button label={t.tourPrev} variant="ghost" size="sm" onPress={() => move(index - 1)} /> : null}
            <Button
              label={last ? t.tourFinish : t.tourNext}
              size="sm"
              onPress={() => {
                haptic.pick();
                if (last) end(true);
                else move(index + 1);
              }}
            />
          </View>
        </View>
      </View>
    </View>
  );
}
