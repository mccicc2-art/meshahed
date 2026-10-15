import React, { useCallback, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StatusBar, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { useApp } from "./state";
import { Text } from "./ui";
import { Icon } from "./icons";
import { haptic } from "./haptics";

/**
 * ====== قصُّ الصورة قبل رفعها — تكبيرٌ وتحريكٌ ولفٌّ ربعيّ (أحمد ١٥ أكتوبر: «١ أ · ٢ أ نفذ») ======
 *
 * 🔑 **شاشةٌ واحدةٌ لكلِّ صورةِ هويّة**: صورةُ القروب، وصورتُك (الإعدادات والترحيب) بإطارٍ دائريّ، والغلافُ بإطارٍ عريض ٣:١.
 * صورُ الرسائل والنقاشات تُرسل كما هي.
 * 🔑 **ما في الإطار هو ما يُحفظ بالضبط**: القصُّ على الجهاز (`expo-image-manipulator`) قبل الرفع، فلا يعتمد الرسمُ بعدها على
 * موضعٍ محفوظ. الصورةُ لا تصغر عن الإطار (لا فراغَ أسود)، والسحبُ مقيّدٌ بحوافّها.
 * 🔑 **اللفُّ ربعُ لفّةٍ بكلِّ ضغطة** («١ أ») — يُطبَّق على الصورة نفسها ثمّ يبدأ الضبطُ من جديد، فالحسابُ يبقى بلا زاوية.
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
  const [src, setSrc] = useState<Src>(job.src);
  const [working, setWorking] = useState(false);
  /* الإطار: دائرةٌ بعرض الشاشة ناقص الهامش (حتى ٣٢٠)، أو مستطيلٌ ٣:١ بعرض الشاشة */
  const fw = job.shape === "circle" ? Math.min(sw - 48, 320) : sw - 32;
  const fh = job.shape === "circle" ? fw : Math.round(fw / 3);
  const areaH = Math.max(fh + 120, 360);
  /* الصورةُ تغطّي الإطار أوّلاً (cover)، والتكبيرُ فوق ذلك */
  const base = Math.max(fw / src.w, fh / src.h);
  const dw = src.w * base;
  const dh = src.h * base;

  const k = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const k0 = useSharedValue(1);
  const x0 = useSharedValue(0);
  const y0 = useSharedValue(0);

  const clampAll = () => {
    "worklet";
    const mx = Math.max(0, (dw * k.value - fw) / 2);
    const my = Math.max(0, (dh * k.value - fh) / 2);
    tx.value = Math.min(mx, Math.max(-mx, tx.value));
    ty.value = Math.min(my, Math.max(-my, ty.value));
  };
  const pinch = Gesture.Pinch()
    .onStart(() => {
      k0.value = k.value;
    })
    .onUpdate((e) => {
      k.value = Math.min(MAX_ZOOM, Math.max(1, k0.value * e.scale));
      clampAll();
    });
  const pan = Gesture.Pan()
    .averageTouches(true)
    .onStart(() => {
      x0.value = tx.value;
      y0.value = ty.value;
    })
    .onUpdate((e) => {
      tx.value = x0.value + e.translationX;
      ty.value = y0.value + e.translationY;
      clampAll();
    });
  const gesture = Gesture.Simultaneous(pinch, pan);
  const imgStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: k.value }] }));

  const reset = () => {
    haptic.pick();
    k.value = withTiming(1);
    tx.value = withTiming(0);
    ty.value = withTiming(0);
  };
  const rotate = async (deg: 90 | -90) => {
    if (working) return;
    haptic.pick();
    setWorking(true);
    try {
      const img = await (await ImageManipulator.manipulate(src.uri).rotate(deg).renderAsync()).saveAsync({ compress: 0.92, format: SaveFormat.JPEG });
      k.value = 1;
      tx.value = 0;
      ty.value = 0;
      setSrc({ uri: img.uri, w: img.width, h: img.height });
    } finally {
      setWorking(false);
    }
  };
  const done = async () => {
    if (working) return;
    setWorking(true);
    try {
      /* ما يقع تحت الإطار بإحداثيّات الصورة: مركزُها مزاحٌ بـ(tx, ty) ومقاسُها المعروض (base × k) */
      const S = base * k.value;
      const cw = Math.min(src.w, fw / S);
      const ch = Math.min(src.h, fh / S);
      const ox = Math.min(src.w - cw, Math.max(0, src.w / 2 + (-fw / 2 - tx.value) / S));
      const oy = Math.min(src.h - ch, Math.max(0, src.h / 2 + (-fh / 2 - ty.value) / S));
      const ctx = ImageManipulator.manipulate(src.uri).crop({ originX: Math.round(ox), originY: Math.round(oy), width: Math.round(cw), height: Math.round(ch) });
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
  /* زرٌّ دائريٌّ تحت الإطار: لفٌّ يسار · إرجاع · لفٌّ يمين */
  const tool = (label: string, onPress: () => void, face: React.ReactNode) => (
    <Pressable onPress={onPress} disabled={working} accessibilityRole="button" accessibilityLabel={label} style={{ alignItems: "center", gap: 4, opacity: working ? 0.5 : 1 }}>
      <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: "#222", alignItems: "center", justifyContent: "center" }}>{face}</View>
      <Text size={11} color="#ccc">{label}</Text>
    </Pressable>
  );

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
                  borderRadius: job.shape === "circle" ? fw / 2 + ring : ring,
                }}
              />
              <View pointerEvents="none" style={{ position: "absolute", width: fw, height: fh, borderRadius: job.shape === "circle" ? fw / 2 : 4, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.85)" }} />
            </View>
          </GestureDetector>
          <Text size={12} color="#bbb" style={{ textAlign: "center", marginTop: 10 }}>{t.cropHint}</Text>
        </View>
        {/* يسارٌ ويمينٌ بمعناهما على الشاشة في العربيّة والإنجليزيّة — لا يُقلب الصفُّ */}
        <View style={{ direction: "ltr", flexDirection: "row", justifyContent: "center", gap: 36, paddingVertical: 18 }}>
          {tool(t.cropRotateLeft, () => void rotate(-90), <View style={{ transform: [{ scaleX: -1 }] }}><Icon name="repeat" size={20} color="#fff" /></View>)}
          {tool(t.cropReset, reset, <Text size={13} weight="700" color="#fff">1×</Text>)}
          {tool(t.cropRotateRight, () => void rotate(90), <Icon name="repeat" size={20} color="#fff" />)}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
