import React, { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { posterFor } from "./poster";
import { useApp } from "./state";
import { radius } from "./theme";

/**
 * 🆕 **جدارُ الملصقات — خرج من شاشة الدخول** (خطّةُ Loopz+ v2، المرحلة ٠): صار له قارئٌ ثانٍ، صفحةُ «اربط أجهزتك» قبل
 * الاشتراك («والجدارُ خلفها») — فهو هنا مرّةً واحدة (D-145)، بطلبه وحركته وستارته، لا نسخةً ثانية.
 * `height` جزءٌ من ارتفاع الشاشة (الدخول ٠٫٧٢ من أسفل)، و`top` يرفعه إلى أعلاها (صفحةُ الربط: الجدارُ خلف المدار).
 */
/* ===== جدارُ الملصقات =====
   أربعةُ صفوفٍ تنزلق أفقيّاً ببطء، صفٌّ يميناً وصفٌّ يساراً، مائلةً خلف المحتوى. كلُّ صفٍّ يُرسم مرّتين متتاليتين
   وينزلق بمقدار نسخةٍ واحدة ثمّ يعود — فالحلقةُ بلا قفزة. الحركةُ على الخيط الأصليّ (`useNativeDriver`) فلا
   تمسّ JS. ومن أطفأ الحركةَ في جهازه يراه ثابتاً. `direction: ltr` للجدار وحدَه: زينةٌ لا نصَّ فيها، وحسابُ
   الانزلاق لا يُقلب مع اتّجاه الواجهة. */
const TILE_W = 92;
const TILE_H = 138;
const TILE_GAP = 10;
const ROWS = 4;
const LOOP_MS = 70_000;

function WallRow({ posters, reverse, still }: { posters: string[]; reverse: boolean; still: boolean }) {
  const x = useRef(new Animated.Value(0)).current;
  const span = posters.length * (TILE_W + TILE_GAP);
  useEffect(() => {
    if (still || span === 0) return;
    x.setValue(0);
    const loop = Animated.loop(Animated.timing(x, { toValue: 1, duration: LOOP_MS, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [x, span, still]);
  const translateX = x.interpolate({ inputRange: [0, 1], outputRange: reverse ? [-span, 0] : [0, -span] });
  return (
    <Animated.View style={{ flexDirection: "row", marginBottom: TILE_GAP, transform: [{ translateX }] }}>
      {[...posters, ...posters].map((p, i) => (
        <Image
          key={`${p}-${i}`}
          source={{ uri: posterFor(p, TILE_W) ?? undefined }}
          style={{ width: TILE_W, height: TILE_H, borderRadius: radius.poster, marginRight: TILE_GAP }}
          contentFit="cover"
          transition={400}
        />
      ))}
    </Animated.View>
  );
}

/** `#rrggbb` ⇒ `rgba()` — لستارة الجدار بلون خلفيّة الثيم نفسِه (لا قيمةَ مكتوبةً بيد) */
export function withAlpha(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function PosterWall({ posters, height: part = 0.72, top = false }: { posters: string[]; height?: number; top?: boolean }) {
  const { tokens } = useApp();
  const { height } = useWindowDimensions();
  const [still, setStill] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => setStill(!!v));
  }, []);
  const rows = useMemo(() => {
    const per = Math.max(1, Math.ceil(posters.length / ROWS));
    return Array.from({ length: ROWS }, (_, r) => {
      const slice = posters.slice(r * per, r * per + per);
      return slice.length >= 3 ? slice : posters.slice(0, per);
    });
  }, [posters]);
  /* ستارةٌ من شرائحَ متدرّجة (لا مكتبةَ تدرّجٍ في التطبيق): شفّافةٌ أعلى الجدار حيث يذوب في الخلفيّة، وأكثفُ أسفلَه
     حيث النقاطُ والزرّ — فالنصُّ يُقرأ والملصقاتُ تُرى. */
  const BANDS = 10;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, ...(top ? { top: 0 } : { bottom: 0 }), height: height * part, overflow: "hidden" }}>
      <View style={{ position: "absolute", left: -60, right: -60, bottom: -40, opacity: 0.55, transform: [{ rotate: "-6deg" }], direction: "ltr" }}>
        {rows.map((r, i) => (
          <WallRow key={i} posters={r} reverse={i % 2 === 1} still={still} />
        ))}
      </View>
      <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}>
        {Array.from({ length: BANDS }, (_, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: withAlpha(tokens.bg, i === 0 ? 1 : Math.max(0.5, 0.95 - i * 0.07)) }} />
        ))}
      </View>
    </View>
  );
}


/** ملصقاتُ الجدار — عامّةٌ بلا رمز، مخبّأةٌ ساعة، ولا إعادة (زينةٌ لا تستحقّ انتظاراً) */
export function useWallPosters() {
  return useQuery({
    queryKey: ["welcome:posters"],
    queryFn: async () => (await api<{ posters: string[] }>("/api/v1/welcome/posters", { auth: false })).data.posters,
    staleTime: 60 * 60_000,
    retry: 0,
  });
}
