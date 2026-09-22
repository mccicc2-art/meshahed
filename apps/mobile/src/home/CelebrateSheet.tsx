import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, View } from "react-native";
import { useApp } from "../state";
import { Text } from "../ui";
import { Sheet } from "../library/Sheet";
import { StarRow } from "../title/StarRow";
import { haptic } from "../haptics";
import { write } from "../api";
import type { RateBody } from "../contracts";

/** ألوانُ الاحتفال من الهويّة — الويب: أصفرُ العلامة ودرجاته وأبيض وأخضر، لا قوسَ قزح */
const COLORS = ["#FFD200", "#FBBF24", "#F59E0B", "#FFFFFF", "#22C55E"];
const PIECES = 24;
const BAND_H = 96;

/**
 * الاحتفالُ عند إكمال مسلسل — ورقةُ `celebrate` في `ContinueCard` الويب (تقفل D-1066 §10):
 * 🎉 + `finishedShowTitle` + `finishedShowSub` + **تقييمٌ بعشر نجوم** (`track/rate`، الفعلُ `saveRating` نفسُه)،
 * وبعد التقييم تُغلق بعد ١٫١ث كالويب. **الشكلُ شكلُ التطبيق** (قاعدةُ أحمد ٢٢ سبتمبر): الورقةُ المركزيّةُ
 * الواحدة من `library/Sheet` بدل ورقةٍ عارية، والكونفيتي شريطٌ داخلَ البطاقة لا فوق الشاشة —
 * `Modal` الورقة يحجب ما تحته فلا مكانَ لطبقةٍ ثانية بلا ورقةٍ ثانية (القاعدة ٣).
 */
export function CelebrateSheet({ tmdbId, title, posterPath, aired, onClose, onError }: { tmdbId: number; title: string; posterPath: string | null; aired: number; onClose: () => void; onError: (e: unknown) => void }) {
  const { t, tokens } = useApp();
  const [stars, setStars] = useState(0);
  const [rated, setRated] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const rate = async (n: number) => {
    if (rated || n < 1) return;
    setStars(n);
    haptic.pick();
    try {
      await write<unknown>("/api/v1/track/rate", { tmdbId, mediaType: "tv", rating: n, review: "", title, posterPath } satisfies RateBody);
      setRated(true);
      haptic.success();
      setTimeout(() => closeRef.current(), 1100);
    } catch (e) {
      setStars(0);
      onError(e);
    }
  };

  return (
    <Sheet title={t.finishedShowTitle(title)} onClose={onClose} placement="center">
      <View style={{ alignItems: "center", gap: 6 }}>
        <Confetti />
        <Text size={30} style={{ lineHeight: 36 }} accessible={false}>🎉</Text>
        <Text size={12} muted style={{ textAlign: "center" }}>{t.finishedShowSub(aired)}</Text>
        <Text size={14} weight="700" color={rated ? tokens.success : tokens.fg} style={{ marginTop: 14 }} accessibilityLiveRegion="polite">
          {rated ? t.ratedThanks : t.rateQuestion}
        </Text>
        <View style={{ marginTop: 6, alignSelf: "stretch", paddingHorizontal: 8, opacity: rated ? 0.7 : 1 }} pointerEvents={rated ? "none" : "auto"}>
          <StarRow spread size={24} value={stars || null} onChange={(n) => void rate(n ?? 0)} />
        </View>
      </View>
    </Sheet>
  );
}

/** ٢٤ قطعةً تسقط عبر شريطٍ بارتفاع ٩٦ داخل البطاقة مرّةً واحدة — `confetti-fall` الويب بمدده (١٫٧–٢٫٨ث) وتأخيراته؛ تُحذف مع «تقليل الحركة» */
function Confetti() {
  const [reduce, setReduce] = useState(false);
  const anims = useRef(Array.from({ length: PIECES }, () => new Animated.Value(0))).current;
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (!live) return;
      setReduce(v);
      if (v) return;
      Animated.parallel(
        anims.map((a, i) =>
          Animated.timing(a, { toValue: 1, duration: 1700 + (i % 5) * 280, delay: (i % 7) * 130, easing: Easing.linear, useNativeDriver: true }),
        ),
      ).start();
    });
    return () => {
      live = false;
    };
  }, [anims]);
  if (reduce) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: -12, left: 0, right: 0, height: BAND_H, overflow: "hidden" }} accessible={false}>
      {anims.map((a, i) => (
        <Animated.View
          key={i}
          style={{
            position: "absolute",
            top: -20,
            left: `${(i * 37 + 11) % 100}%`,
            width: 7 + (i % 3) * 3,
            height: 11 + (i % 3) * 4,
            borderRadius: 2,
            backgroundColor: COLORS[i % COLORS.length],
            opacity: a.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
            transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, BAND_H + 24] }) }, { rotate: a.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${360 + (i % 4) * 90}deg`] }) }],
          }}
        />
      ))}
    </View>
  );
}
