import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BackHandler, Keyboard, Pressable, View, useWindowDimensions } from "react-native";
import { useNavigationContainerRef, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TOUR_STEPS, type TourScreen, type TourState } from "@/core/tour";
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
import { measureAnchor, revealAnchor, type AnchorRect } from "./anchors";

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

/** تبويبُ كلِّ خطوة — و«الملفّ» و«التخصيص» يبدآن من الرئيسيّة: الأوّلُ يضغط صورتَه هناك، والثاني يُدفع فوقها */
const TAB_OF: Record<TourScreen, "/home" | "/discover" | "/search" | "/library" | "/community"> = {
  discover: "/discover",
  search: "/search",
  library: "/library",
  home: "/home",
  profile: "/home",
  customize: "/home",
  community: "/community",
};
/** اسمُ التبويب في مجموعة `(tabs)` الذي تقف عليه الخطوة — به يُعرف «هل الزرُّ المقصودُ أمامه الآن؟» */
const TAB_NAME: Record<TourScreen, string> = {
  discover: "discover",
  search: "search",
  library: "library",
  home: "home",
  profile: "home",
  customize: "home",
  community: "community",
};

/** مهلةٌ قبل العرض والاستئناف عند الإقلاع: الرئيسيّةُ ترسم، وضغطةُ إشعارٍ تذهب لوجهتها (`PushGate`) أوّلاً */
const SETTLE_MS = 1200;
/** القياسُ يُعاد: الشاشةُ تُبحر ثمّ ترسم ثمّ يعود رأسُها — وزرٌّ يُقاس قبل أن يستقرّ يُقاس في غير مكانه */
const MEASURE_AT_MS = [120, 450, 1000];
/** ثمّ يُعاد ما دام الزرُّ أمامه: القارئُ يمرّر الشاشةَ تحت البطاقة، وحلقةٌ تبقى حيث كان الزرُّ تشير إلى فراغ */
const MEASURE_EVERY_MS = 500;

type Top = { key: string; name: string; tab: string | null };

function readTop(s: State): Top | null {
  const r = topOf(s);
  if (!r) return null;
  const inner = r.state;
  /* قبل أوّل تبديلٍ داخل المجموعة لا حالةَ لها هنا — فالتبويبُ الذي دُفعت به (`params.screen`)، وإلّا «لا أعرف» */
  const pushed = typeof r.params?.screen === "string" ? r.params.screen : null;
  const tab = r.name === "(tabs)" ? inner?.routes[inner.index ?? 0]?.name ?? pushed : null;
  return { key: r.key, name: r.name, tab };
}

/** قيمةٌ من كاش الاستعلامات بلا مراقبٍ ثانٍ — مراقبٌ بلا `queryFn` على مفتاح الرئيسيّة يسرق دالّتَها عند الإبطال */
function useCachedTour<T extends { tour?: TourState | null }>(key: readonly unknown[]): TourState | null | undefined {
  return useSyncExternalStore(
    useCallback((fn: () => void) => queryClient.getQueryCache().subscribe(fn), []),
    () => queryClient.getQueryData<T>(key)?.tour,
  );
}

export function TourHost() {
  const { t, tokens } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const nav = useNavigationContainerRef();

  /* أعلى المكدّس الجذر والتبويبُ الظاهر — منهما: هل تُرى البطاقة، وهل الزرُّ المقصودُ أمامه */
  const [top, setTop] = useState<Top | null>(null);
  useEffect(() => {
    const read = () => {
      const next = readTop((nav.isReady() ? nav.getRootState() : undefined) as unknown as State);
      setTop((p) => (p?.key === next?.key && p?.name === next?.name && p?.tab === next?.tab ? p : next));
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
  useEffect(() => () => tourStore.setBusy(false), []);

  /* ——— الإبحار: كلُّ تبدّلِ خطوةٍ يفتح شاشتَها ——— */
  const gone = useRef<number | null>(null);
  const booted = useRef(false);
  const go = useCallback(
    (i: number) => {
      const target = TOUR_STEPS[i];
      /* ما فوق مجموعة التبويبات يُنزَل أوّلاً (ملفٌّ فتحه، إعداداتٌ بدأ منها، عملٌ دخله وسطَ الجولة) — وصفةُ
         `goRoot` في `WebLayer` حرفاً: `dismiss` بالعدد ثمّ تبديلُ التبويب الحيّ */
      const st = rootStack((nav.isReady() ? nav.getRootState() : undefined) as unknown as State);
      if (st) {
        const at = st.index ?? st.routes.length - 1;
        const tabs = st.routes.slice(0, at + 1).map((r) => r.name).lastIndexOf("(tabs)");
        if (tabs >= 0 && at > tabs) router.dismiss(at - tabs);
      }
      router.navigate(TAB_OF[target.screen]);
      if (target.screen === "customize") router.push({ pathname: "/settings/[section]", params: { section: "home" } });
      if (target.anchor) revealAnchor(target.anchor);
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

  /* ——— خطوةُ الملفّ: يضغط صورتَه بنفسه (حكمُ أحمد) — والبطاقةُ تدعوه ثمّ تصف ما فتحه ——— */
  const onProfile = top?.name === "u/[username]";
  const lead = step.lead && !onProfile ? step.lead : null;

  /* ——— «التخصيص»: من خرج منها بسهمها عاد إلى الرئيسيّة — فالخطوةُ السابقةُ هي ما أمامه ——— */
  const arrived = useRef(false);
  useEffect(() => {
    if (!active || step.screen !== "customize") {
      arrived.current = false;
      return;
    }
    if (top?.name === "settings/[section]") arrived.current = true;
    else if (arrived.current && top?.name === "(tabs)") {
      arrived.current = false;
      gone.current = index - 1;
      move(index - 1);
    }
  }, [active, step.screen, top, index, move]);

  /* ——— الحلقة: تُقاس حين يكون الزرُّ أمامه، وتسقط حين لا يكون ——— */
  const onTab = TAB_NAME[step.screen] === "home" ? snap.home : top?.tab === TAB_NAME[step.screen];
  const facing = active && native && !!step.anchor && top?.name === "(tabs)" && onTab;
  const [ring, setRing] = useState<AnchorRect | null>(null);
  useEffect(() => {
    setRing(null);
    const anchor = step.anchor;
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
  }, [facing, step.anchor, index]);

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
  /* الشاشةُ التي تقف عليها الخطوة: جذرٌ من التبويبات، أو «التخصيص» في خطوتها */
  const atStep = top?.name === "(tabs)" || (step.screen === "customize" && top?.name === "settings/[section]");
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
        <View accessibilityRole="summary" accessibilityLabel={t.tourSuggestTitle} style={card}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            {disc}
            <Text size={14} weight="600" style={{ flex: 1, lineHeight: 21 }}>{t.tourSuggestTitle}</Text>
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
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}>
      {ring ? (
        <>
          {/* هالةٌ ثمّ حلقة — بلونِ السمة لا رقمٍ مكتوب، ولا تلتقط لمساً: الزرُّ تحتها يُضغط */}
          <View pointerEvents="none" style={{ position: "absolute", left: ring.x - PAD - 5, top: ring.y - PAD - 5, width: ring.w + (PAD + 5) * 2, height: ring.h + (PAD + 5) * 2, borderRadius: (ring.h + (PAD + 5) * 2) / 2, backgroundColor: tokens.accent + "29" }} />
          <View pointerEvents="none" style={{ position: "absolute", left: ring.x - PAD, top: ring.y - PAD, width: ring.w + PAD * 2, height: ring.h + PAD * 2, borderRadius: (ring.h + PAD * 2) / 2, borderWidth: 2.5, borderColor: tokens.accent }} />
          {lead ? (
            /* «اضغط هنا» — لهذه الخطوة وحدَها (حكمُ أحمد)، تحت الصورة ومنتصفُها منتصفُها */
            <>
              {/* السهمُ تحت منتصف الصورة، والحبّةُ تُقصّ إلى حافّتَي الشاشة — الصورةُ في الطرف، وحبّةٌ تتوسّطها تخرج منه */}
              <View pointerEvents="none" style={{ position: "absolute", left: ring.x + ring.w / 2 - 5, top: ring.y + ring.h + PAD + 8, width: 10, height: 10, backgroundColor: tokens.accent, transform: [{ rotate: "45deg" }] }} />
              <View pointerEvents="none" style={{ position: "absolute", left: Math.max(8, Math.min(ring.x + ring.w / 2 - TAP_W / 2, W - TAP_W - 8)), width: TAP_W, top: ring.y + ring.h + PAD + 13, alignItems: "center" }}>
                <View style={{ backgroundColor: tokens.accent, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 }}>
                  <Text size={13} weight="700" color={tokens.onAccent} numberOfLines={1}>{t.tourTapHere}</Text>
                </View>
              </View>
            </>
          ) : null}
        </>
      ) : null}

      <View pointerEvents="box-none" style={{ position: "absolute", left: 16, right: 16, bottom, alignItems: "center" }}>
        <View accessibilityRole="summary" accessibilityLabel={step.title(t)} style={card}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
            {disc}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text size={15} weight="700">{step.title(t)}</Text>
              <Text size={12} muted style={{ marginTop: 4, lineHeight: 19 }}>{lead ? lead(t) : step.body(t)}</Text>
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
