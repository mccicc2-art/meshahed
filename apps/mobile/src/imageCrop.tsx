import React, { useCallback, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StatusBar, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { useApp } from "./state";
import { Text } from "./ui";
import { haptic } from "./haptics";

/**
 * ====== قصُّ الصورة قبل رفعها — تكبيرٌ وتحريكٌ ولفٌّ حرٌّ باليد (أحمد ١٥ أكتوبر: «١ أ · ٢ أ نفذ» ثمّ «احذف اللفّ… ب نفذ») ======
 *
 * 🔑 **شاشةٌ واحدةٌ لكلِّ صورةِ هويّة**: صورةُ القروب، وصورتُك (الإعدادات والترحيب) بإطارٍ دائريّ، والغلافُ بإطارٍ عريض ٣:١.
 * صورُ الرسائل والنقاشات تُرسل كما هي.
 * 🔑 **ما في الإطار هو ما يُحفظ بالضبط**: القصُّ على الجهاز (`expo-image-manipulator`) قبل الرفع، فلا يعتمد الرسمُ بعدها على
 * موضعٍ محفوظ. الصورةُ لا تصغر عن الإطار (لا فراغَ أسود)، والسحبُ مقيّدٌ بحوافّها.
 * 🔑 **اللفُّ بإصبعين بأيّ زاوية** (نقضَ «١ أ» — أزرارُ الربع حُذفت): يوزن بها الأفقَ المائل. **بلا تثبيتٍ عند الصفر** («ب»):
 * الزاويةُ ما تتركه اليدُ بالضبط، ورقمُها والشبكةُ ظاهران أثناء اللفّ ليُعرف متى استقام.
 * 🔑 **الإطارُ مغطّى دائماً حتى مع الزاوية**: أقلُّ تكبيرٍ يُحسب من الزاوية (مستطيلُ الإطار مُدارٌ داخل الصورة)، فلا زاويةَ سوداء
 * في الناتج. والدائرةُ تُعامل كمربّعها — الناتجُ مربّعٌ وقد يُعرض مربّعاً في مكانٍ ما.
 * ⚖️ **لا قصَّ النظام** (`allowsEditing`): لا لفَّ فيه على الآيفون، وشكلُه يختلف بين المنصّتين والأجهزة.
 */
export type CropShape = "circle" | "wide";

/** أطولُ طرفٍ للصورة أثناء الضبط — تكفي لقصٍّ حادٍّ ولا تثقل الذاكرة */
const WORK_EDGE = 2400;
/** مقاسُ الناتج: الدائرةُ مربّعٌ ٦٤٠، والغلافُ ١٥٠٠ عرضاً */
const OUT = { circle: 640, wide: 1500 } as const;
const MAX_ZOOM = 6;

type Src = { uri: string; w: number; h: number };
type Job = { src: Src; shape: CropShape; resolve: (uri: string | null) => void };

async function normalize(uri: string): Promise<Src> {
  const raw = await ImageManipulator.manipulate(uri).renderAsync();
  const ctx = ImageManipulator.manipulate(raw);
  const long = Math.max(raw.width, raw.height);
  if (long > WORK_EDGE) ctx.resize(raw.width >= raw.height ? { width: WORK_EDGE } : { height: WORK_EDGE });
  const img = await (await ctx.renderAsync()).saveAsync({ compress: 0.92, format: SaveFormat.JPEG });
  return { uri: img.uri, w: img.width, h: img.height };
}

/**
 * يختار صورةً من الاستوديو ثمّ يفتح شاشةَ القصّ: يعود بمسار JPEG المقصوص، أو `null` إن ألغى. الشاشةُ تُرسم بـ`cropUi`.
 */
export function useImageCrop() {
  const [job, setJob] = useState<Job | null>(null);
  const [busy, setBusy] = useState(false);
  const pickCropped = useCallback(async (shape: CropShape): Promise<string | null> => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: false, quality: 1 });
    if (r.canceled || !r.assets[0]) return null;
    const a = r.assets[0];
    if (a.mimeType && !a.mimeType.startsWith("image/")) return null;
    setBusy(true);
    let src: Src;
    try {
      src = await normalize(a.uri);
    } finally {
      setBusy(false);
    }
    return new Promise<string | null>((resolve) => setJob({ src, shape, resolve }));
  }, []);
  const close = useCallback((uri: string | null) => {
    setJob((j) => {
      j?.resolve(uri);
      return null;
    });
  }, []);
  const cropUi = job ? <CropScreen key={job.src.uri} job={job} onClose={close} /> : busy ? <Preparing /> : null;
  return { pickCropped, cropUi };
}

function Preparing() {
  return (
    <Modal transparent animationType="fade" statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#fff" />
      </View>
    </Modal>
  );
}

function CropScreen({ job, onClose }: { job: Job; onClose: (uri: string | null) => void }) {
  const { t, tokens } = useApp();
  const insets = useSafeAreaInsets();
  const { width: sw } = useWindowDimensions();
  const src = job.src;
  const [working, setWorking] = useState(false);
  const [deg, setDeg] = useState(0);
  /* الإطار: دائرةٌ بعرض الشاشة ناقص الهامش (حتى ٣٢٠)، أو مستطيلٌ ٣:١ بعرض الشاشة */
  const fw = job.shape === "circle" ? Math.min(sw - 48, 320) : sw - 32;
  const fh = job.shape === "circle" ? fw : Math.round(fw / 3);
  const areaH = Math.max(fh + 160, 380);
  /* الصورةُ تغطّي الإطار أوّلاً (cover)، والتكبيرُ فوق ذلك */
  const base = Math.max(fw / src.w, fh / src.h);
  const dw = src.w * base;
  const dh = src.h * base;

  /* الحالةُ حول مركز الإطار: إزاحةٌ (tx, ty) ثمّ لفٌّ (r راديان، مع عقارب الساعة) ثمّ تكبير k — ترتيبُ `transform` نفسُه */
  const k = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const r = useSharedValue(0);
  const lastS = useSharedValue(1);
  const lastR = useSharedValue(0);
  const lastX = useSharedValue(0);
  const lastY = useSharedValue(0);
  const turning = useSharedValue(0);

  /** يُبقي الإطارَ كلَّه داخل الصورة: يرفع التكبيرَ لأدنى ما تسمح به الزاوية، ثمّ يحصر مركزَ الإطار في إحداثيّات الصورة */
  const fit = () => {
    "worklet";
    const cs = Math.cos(r.value);
    const sn = Math.sin(r.value);
    const ac = Math.abs(cs);
    const as = Math.abs(sn);
    /* نصفا امتداد الإطار مُداراً إلى محاور الصورة (بوحدات الشاشة) */
    const ex = (fw * ac + fh * as) / 2;
    const ey = (fw * as + fh * ac) / 2;
    const kMin = Math.max(1, (2 * ex) / dw, (2 * ey) / dh);
    if (k.value < kMin) {
      tx.value *= kMin / k.value;
      ty.value *= kMin / k.value;
      k.value = kMin;
    }
    /* مركزُ الإطار في إحداثيّات الصورة المعروضة: R(-r)·(-t)/k */
    let cx = (-tx.value * cs - ty.value * sn) / k.value;
    let cy = (tx.value * sn - ty.value * cs) / k.value;
    const mx = Math.max(0, dw / 2 - ex / k.value);
    const my = Math.max(0, dh / 2 - ey / k.value);
    cx = Math.min(mx, Math.max(-mx, cx));
    cy = Math.min(my, Math.max(-my, cy));
    tx.value = -k.value * (cx * cs - cy * sn);
    ty.value = -k.value * (cx * sn + cy * cs);
  };

  /* كلُّ إيماءةٍ تُطبَّق بفرقها عن آخر نبضة — فتجتمع الثلاثُ بلا تنازع، والتكبيرُ واللفُّ حول مركز الإطار لا مركز الصورة */
  const pinch = Gesture.Pinch()
    .onStart(() => {
      lastS.value = 1;
    })
    .onUpdate((e) => {
      const f = e.scale / lastS.value;
      lastS.value = e.scale;
      const nk = Math.min(MAX_ZOOM, k.value * f);
      tx.value *= nk / k.value;
      ty.value *= nk / k.value;
      k.value = nk;
      fit();
    });
  const rotation = Gesture.Rotation()
    .onStart(() => {
      lastR.value = 0;
      turning.value = withTiming(1, { duration: 120 });
    })
    .onUpdate((e) => {
      const d = e.rotation - lastR.value;
      lastR.value = e.rotation;
      const c = Math.cos(d);
      const s = Math.sin(d);
      const x = tx.value;
      tx.value = x * c - ty.value * s;
      ty.value = x * s + ty.value * c;
      r.value += d;
      fit();
    })
    .onFinalize(() => {
      turning.value = withTiming(0, { duration: 250 });
    });
  const pan = Gesture.Pan()
    .averageTouches(true)
    .onStart(() => {
      lastX.value = 0;
      lastY.value = 0;
    })
    .onUpdate((e) => {
      tx.value += e.translationX - lastX.value;
      ty.value += e.translationY - lastY.value;
      lastX.value = e.translationX;
      lastY.value = e.translationY;
      fit();
    });
  const gesture = Gesture.Simultaneous(pinch, rotation, pan);
  const imgStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { rotate: `${r.value}rad` }, { scale: k.value }],
  }));
  const guideStyle = useAnimatedStyle(() => ({ opacity: turning.value }));
  /* رقمُ الزاوية يتغيّر بدرجةٍ كاملة فقط — لا رسمَ للشاشة مع كلِّ نبضة */
  useAnimatedReaction(
    () => Math.round((r.value * 180) / Math.PI),
    (now, prev) => {
      if (now !== prev) scheduleOnRN(setDeg, now);
    },
  );

  const reset = () => {
    haptic.pick();
    k.value = withTiming(1);
    tx.value = withTiming(0);
    ty.value = withTiming(0);
    r.value = withTiming(0);
  };
  const done = async () => {
    if (working) return;
    setWorking(true);
    try {
      const S = base * k.value;
      const rad = r.value;
      let uri = src.uri;
      let W = src.w;
      let H = src.h;
      /* اللفُّ أوّلاً على الصورة كلِّها (لوحتُها تتّسع لمحيطها، والمركزُ ثابت)، ثمّ القصُّ بلا زاوية — نقطةُ الشاشة s تقع في
         الصورة المُدارة عند (s − t)/S من مركزها */
      if (Math.abs(rad) > 0.0005) {
        const turned = await ImageManipulator.manipulate(src.uri).rotate((rad * 180) / Math.PI).renderAsync();
        const saved = await turned.saveAsync({ compress: 0.95, format: SaveFormat.JPEG });
        uri = saved.uri;
        W = saved.width;
        H = saved.height;
      }
      const cw = Math.min(W, fw / S);
      const ch = Math.min(H, fh / S);
      const ox = Math.min(W - cw, Math.max(0, W / 2 + (-fw / 2 - tx.value) / S));
      const oy = Math.min(H - ch, Math.max(0, H / 2 + (-fh / 2 - ty.value) / S));
      const ctx = ImageManipulator.manipulate(uri).crop({ originX: Math.floor(ox), originY: Math.floor(oy), width: Math.floor(cw), height: Math.floor(ch) });
      const out = OUT[job.shape];
      if (cw > out) ctx.resize({ width: out });
      const img = await (await ctx.renderAsync()).saveAsync({ compress: 0.88, format: SaveFormat.JPEG });
      haptic.success();
      onClose(img.uri);
    } catch {
      setWorking(false);
    }
  };

  const ring = 2000;
  const round = job.shape === "circle";
  return (
    <Modal animationType="slide" statusBarTranslucent onRequestClose={() => onClose(null)}>
      <StatusBar barStyle="light-content" />
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#000", paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <View style={{ height: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 }}>
          <Pressable onPress={() => onClose(null)} hitSlop={10} accessibilityRole="button">
            <Text size={15} color="#ccc">{t.cancelLabel}</Text>
          </Pressable>
          <Text size={15} weight="700" color="#fff">{t.cropTitle}</Text>
          <Pressable onPress={() => void done()} disabled={working} hitSlop={10} accessibilityRole="button">
            {working ? <ActivityIndicator color={tokens.accent} /> : <Text size={15} weight="700" color={tokens.accent}>{t.cropDone}</Text>}
          </Pressable>
        </View>
        <View style={{ flex: 1, justifyContent: "center" }}>
          <GestureDetector gesture={gesture}>
            <View style={{ height: areaH, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
              <Animated.Image source={{ uri: src.uri }} style={[{ width: dw, height: dh }, imgStyle]} resizeMode="cover" />
              {/* القناعُ: حلقةٌ عريضةٌ داكنةٌ حول الإطار — الإطارُ وحدَه صافٍ */}
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  width: fw + ring * 2,
                  height: fh + ring * 2,
                  borderWidth: ring,
                  borderColor: "rgba(0,0,0,0.62)",
                  borderRadius: round ? fw / 2 + ring : ring,
                }}
              />
              {/* شبكةُ الأثلاث أثناء اللفّ وحدَه — بها يُرى الأفقُ أمستقيمٌ أم لا */}
              <Animated.View pointerEvents="none" style={[{ position: "absolute", width: fw, height: fh, borderRadius: round ? fw / 2 : 4, overflow: "hidden" }, guideStyle]}>
                {[1, 2].map((i) => (
                  <View key={`v${i}`} style={{ position: "absolute", top: 0, bottom: 0, left: (fw * i) / 3, width: 1, backgroundColor: "rgba(255,255,255,0.55)" }} />
                ))}
                {[1, 2].map((i) => (
                  <View key={`h${i}`} style={{ position: "absolute", left: 0, right: 0, top: (fh * i) / 3, height: 1, backgroundColor: "rgba(255,255,255,0.55)" }} />
                ))}
              </Animated.View>
              <View pointerEvents="none" style={{ position: "absolute", width: fw, height: fh, borderRadius: round ? fw / 2 : 4, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.85)" }} />
              <Animated.View pointerEvents="none" style={[{ position: "absolute", top: (areaH - fh) / 2 - 44, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.6)", borderWidth: 1, borderColor: "#444" }, guideStyle]}>
                {/* الرقمُ بإشارته يساراً في اللغتين (‎ يمنع قلبَ الإشارة في العربيّة) */}
                <Text size={14} weight="700" color="#fff">{`‎${deg > 0 ? "+" : deg < 0 ? "−" : ""}${Math.abs(deg)}°`}</Text>
              </Animated.View>
            </View>
          </GestureDetector>
          <Text size={12} color="#bbb" style={{ textAlign: "center", marginTop: 10 }}>{t.cropHint}</Text>
        </View>
        <View style={{ alignItems: "center", paddingVertical: 18 }}>
          <Pressable onPress={reset} disabled={working} accessibilityRole="button" hitSlop={6} style={{ paddingHorizontal: 22, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: "#444", opacity: working ? 0.5 : 1 }}>
            <Text size={14} color="#ddd">{t.cropReset}</Text>
          </Pressable>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
