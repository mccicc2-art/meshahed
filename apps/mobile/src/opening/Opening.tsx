import React, { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, StyleSheet, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import Reanimated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { mark } from "../perfMarks";
import { opening } from "./opening";

/**
 * ====== 🆕 D-1350 — أنميشنُ فتح التطبيق ======
 *
 * فكرةُ أحمد وتصميمُه (١١ أكتوبر، بمقطعَين ثمّ معاينتَين): «انميشن لوبز ثم يكبر ويختفي، مثل نظام دخول اكس و شاهد» —
 * «نستفيد ويتحمل التطبيق قبل الشخص لا يدخل». قراراتُه: في كلِّ فتحةٍ جديدة · ثانيتان · خلفيّةٌ سوداءُ وشعارٌ أبيضُ
 * دائماً (لا نسخةَ نهاريّة) · إن تأخّر التجهيزُ يثبت الشعارُ حتى يجهز بسقف خمس ثوانٍ · وصورةُ النظام عند الفتح
 * سوداءُ فارغة (`app.json`) كي لا يظهر الشعارُ ثمّ يختفي ثمّ يُرسم.
 *
 * **المراحل** (أزمنةُ المعاينة المعتمدة): سوادٌ ٠٫١ث ← الشعارُ يُرسم على مساره ٠٫٨٦ث ← يثبت ثلثَ ثانيةٍ على الأقلّ وحتى
 * تقول الشاشةُ تحته إنّها جاهزة (`opening.ready`) ← ينكمش إلى ٠٫٩ في ٠٫١٦ث ← يكبر إلى ١١ ضعفاً في ٠٫٤٢ث والستارُ كلُّه
 * يبهت فتنكشف الشاشة.
 *
 * 🔑 **طبقتان لا رسمٌ حيّ**: الرسمُ صورةٌ متحرّكةٌ جاهزة (`loopz-open-draw.webp` — وصفةُ شاشة التجهيز D-1348 التي
 * ثبتت على الجهاز)، والتكبيرُ تحريكُ صورةٍ ثابتةٍ بضعف الدقّة (`loopz-mark-xl.png`) على خيط الواجهة. الطبقةُ الثابتةُ
 * تحلّ محلَّ المتحرّكة والشعارُ كاملٌ في الاثنتين (الملفّان من كِفافٍ واحد — `scripts/logo-draw/open.py`)، فلا يُرى
 * التبديل. ⚖️ بضعف الدقّة لا أكثر: تصغيرُ ٢:١ بالعتاد نظيفٌ والشعارُ ثابت، وما فوق الضعفين يلين وقد بهت الستارُ إلى
 * أقلَّ من ثلثه — ورسمُه متّجهاً في كلِّ إطار (`react-native-svg`) غيرُ مجرَّبٍ على المنصّتين.
 *
 * 🔑 **الساعةُ تبدأ من ظهور الصورة المتحرّكة لا من تركيبها** (`onDisplay`): تفكيكُها قد يتأخّر، ومؤقّتٌ يسبقها
 * يقطع الرسمَ قبل أن يكتمل. لم تُعلن ظهورَها في ٠٫٧ث (مفكِّكٌ تعثّر) ⇒ الشعارُ الثابتُ مباشرةً ويمضي.
 *
 * ⚖️ **لا يحبس أحداً**: السقفُ خمسُ ثوانٍ من بدء العرض مهما قالت الشاشات، ومن أطفأ الحركةَ يرى الشعارَ ثابتاً ثمّ
 * يبهت. وإعادةُ تحميلٍ طلبها التطبيقُ (قلبُ اللغة) ليست فتحةً جديدة (`opening.skipped`).
 */
const BG = "#050505"; /* `backgroundColor` في `app.json` — لونُ صورة النظام عند الفتح */
const DRAW = require("../../assets/loopz-open-draw.webp");
const XL = require("../../assets/loopz-mark-xl.png");

const LEAD_MS = 100;
const DRAW_MS = 860;
/** التبديلُ إلى الطبقة الثابتة بعد اكتمال الرسم بهذا الهامش (المتحرّكةُ ثابتةٌ على إطارها الأخير منذ اكتماله) */
const SWAP_AFTER_MS = 140;
const HOLD_MS = 190;
const DIP_MS = 160;
const ZOOM_MS = 420;
const CAP_MS = 5000;
const DISPLAY_WAIT_MS = 700;
const DIP = 0.9;
const GROW = Math.log(11 / DIP);
/** حبرُ الشعار ٤٣١ من لوحةٍ ٥١٢، ويُعرض بثلث عرض الشاشة (كما في المعاينة) */
const INK = 431 / 512;

type Phase = "lead" | "draw" | "still" | "gone";

export function Opening({ start }: { start: boolean }) {
  const { width, height } = useWindowDimensions();
  const [phase, setPhase] = useState<Phase>(() => (opening.skipped() ? "gone" : "lead"));
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const [reduced, setReduced] = useState(false);
  const reducedRef = useRef(false);
  /** لحظةُ بدء العرض (بعد زوال صورة النظام) — منها السقفُ والقياس */
  const t0 = useRef(0);
  const leaving = useRef(false);
  const drawing = useRef(false);
  /* المتحرّكةُ تبقى لحظةً تحت الثابتة ثمّ تُنزع: بقاؤها حتى التكبير يترك شعاراً صغيراً ثابتاً تحت الذي يكبر */
  const [drawUp, setDrawUp] = useState(true);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);
  useEffect(
    () => () => {
      for (const t of timers.current) clearTimeout(t);
    },
    [],
  );

  const dip = useSharedValue(1);
  const zoom = useSharedValue(0);
  const fade = useSharedValue(1);

  const gone = useCallback((why: string) => {
    mark("open.hide", Date.now() - t0.current, { why });
    setPhase("gone");
  }, []);

  /** الخروج: مرّةً واحدة، والشعارُ كاملٌ على الشاشة */
  const leave = useCallback(
    (why: string) => {
      if (leaving.current || phaseRef.current === "gone") return;
      leaving.current = true;
      if (reducedRef.current) {
        fade.value = withTiming(0, { duration: 200 }, (done) => {
          if (done) runOnJS(gone)(why);
        });
        return;
      }
      dip.value = withTiming(DIP, { duration: DIP_MS, easing: Easing.inOut(Easing.quad) });
      zoom.value = withDelay(
        DIP_MS,
        withTiming(1, { duration: ZOOM_MS, easing: Easing.linear }, (done) => {
          if (done) runOnJS(gone)(why);
        }),
      );
      /* حزام: إن لم يُبلَّغ انتهاءُ الحركة (التطبيقُ ذهب للخلفيّة في أثنائها) لا يبقى الستار */
      later(() => {
        if (phaseRef.current !== "gone") gone(why);
      }, DIP_MS + ZOOM_MS + 400);
    },
    [dip, zoom, fade, gone, later],
  );

  /** الشعارُ كاملٌ وثابت ⇒ يُنتظر الحدُّ الأدنى للثبات ثمّ جاهزيّةُ الشاشة (أو السقف) */
  const settle = useCallback(() => {
    if (phaseRef.current !== "draw" && phaseRef.current !== "lead") return;
    setPhase("still");
    later(() => setDrawUp(false), 100);
    later(() => {
      const off = opening.onReady(() => leave("ready"));
      const left = CAP_MS - (Date.now() - t0.current);
      later(() => {
        off();
        leave("cap");
      }, Math.max(0, left));
    }, reducedRef.current ? 400 : HOLD_MS);
  }, [later, leave]);

  /* بدءُ العرض: بعد أن تزول صورةُ النظام */
  useEffect(() => {
    if (!start || phaseRef.current !== "lead" || t0.current) return;
    t0.current = Date.now();
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((on) => {
        if (!alive) return;
        if (on) {
          reducedRef.current = true;
          setReduced(true);
          settle();
          return;
        }
        later(() => {
          if (phaseRef.current !== "lead") return;
          setPhase("draw");
          /* الصورةُ المتحرّكةُ لم تُعلن ظهورَها ⇒ الثابتةُ ويمضي */
          later(() => {
            if (phaseRef.current === "draw" && !drawing.current) settle();
          }, DISPLAY_WAIT_MS);
        }, LEAD_MS);
      });
    return () => {
      alive = false;
    };
  }, [start, later, settle]);

  /** الصورةُ المتحرّكةُ ظهرت: رسمُها يأخذ `DRAW_MS`، ثمّ إطارُها الأخير (الشعارُ كاملاً) ثابتٌ ثانيةً ونصفاً */
  const onDrawShown = useCallback(() => {
    if (drawing.current) return;
    drawing.current = true;
    later(settle, DRAW_MS + SWAP_AFTER_MS);
  }, [later, settle]);

  const sheet = useAnimatedStyle(() => {
    const p = zoom.value;
    return { opacity: fade.value * (p < 0.22 ? 1 : Math.pow(Math.max(0, 1 - (p - 0.22) / 0.78), 1.6)) };
  });
  const big = useAnimatedStyle(() => ({
    transform: [{ scale: 0.5 * dip.value * Math.exp(GROW * Math.pow(zoom.value, 2.4)) }],
  }));

  if (phase === "gone") return null;
  /* صندوقُ اللوحة: حبرُ الشعار بثلث العرض؛ والطبقةُ الثابتةُ ضعفُه مصغَّرةً إلى النصف */
  const box = Math.round(width / 3 / INK);
  const still = phase === "still";
  return (
    <Reanimated.View style={[StyleSheet.absoluteFill, { backgroundColor: BG, alignItems: "center", justifyContent: "center" }, sheet]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <StatusBar style="light" />
      {(phase === "draw" || still) && drawUp && !reduced ? (
        <Image source={DRAW} style={{ position: "absolute", width: box, height: box, left: (width - box) / 2, top: (height - box) / 2 }} contentFit="contain" autoplay cachePolicy="memory" onDisplay={onDrawShown} onError={() => settle()} />
      ) : null}
      {/* الثابتةُ تُركَّب مع الرسم (تُفكَّك صورتُها في أثنائه) وتُرى حين يكتمل */}
      {phase === "draw" || still ? (
        <Reanimated.View style={[{ position: "absolute", width: box * 2, height: box * 2, left: (width - box * 2) / 2, top: (height - box * 2) / 2, opacity: still ? 1 : 0 }, big]}>
          <Image source={XL} style={{ width: box * 2, height: box * 2 }} contentFit="contain" />
        </Reanimated.View>
      ) : null}
    </Reanimated.View>
  );
}
