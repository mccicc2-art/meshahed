import React, { memo, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useApp } from "../state";
import { Text } from "../ui";
import { radius } from "../theme";
import { posterFor } from "../poster";
import { MarqueeText } from "./MarqueeText";

/**
 * ====== بطاقةُ الملصق — نسخةُ `PosterCard.tsx` (الويب) بالبكسل ======
 * (Phase 11 · B2، D-936 — B0 §٣.٢ G4/G6)
 *
 * 🔑 **كلُّ قيمةٍ هنا لها اسمٌ في `globals.css` أو `PosterCard.tsx`**، وهذا
 * شرطُ التكافؤ لا زينة (B0 §٤): `rounded-poster` = ١٢ · حدُّ `border` ·
 * خلفيّةُ `surface` · الاسمُ داخل الملصق على حجابٍ `from-black/90 via-black/60`
 * بحشوة `p-2 pt-7` وخطّ `text-12 font-semibold` أبيض · شارةُ العدّ `top-2 end-2
 * min-w-6 h-6 px-1.5` بلون التمييز · **وخيطُ الحالة** (`StatusThread`): `h-1.5`
 * على `black/50`، **أحمرُ بمقدار التقدّم للموقوف** (D-784)، أخضرُ للمكتمل،
 * تمييزٌ للجاري، **ولا خيطَ لِما لم يبدأ** (المكتبةُ لا تمرّر `saved`).
 *
 * الاسمُ سطرٌ يمشي (`MarqueeText` — D-486) وقائمةُ الضغط المطوَّل (G5) عبر
 * `onHold` ⇢ `HoldMenu` (B3).
 */
export type CardItem = {
  key: string;
  kind: "tv" | "movie";
  id: number;
  title: string;
  posterPath: string | null;
  /** 0..100 */
  progress: number;
  /** الحلقاتُ المتبقية — شارةُ الزاوية */
  count?: number;
  completed: boolean;
  dropped: boolean;
};

/** الحجابُ `from-black/90 via-black/60 to-transparent` صورةٌ ١×٤٨ تُمدّ — بلا حزمةِ تدرّجٍ جديدة */
const VEIL = require("../../assets/poster-veil.png");

export type CardAnchor = { x: number; y: number; width: number; height: number };

export const PosterCard = memo(function PosterCard({
  item,
  width,
  onPress,
  onHold,
  marquee = true,
}: {
  item: CardItem;
  width: number;
  onPress: (item: CardItem) => void;
  /** الضغطُ المطوَّل (`LongPressable` في الويب) — يمرّر موضعَ البطاقة في النافذة لتُرسى القائمةُ عليه */
  onHold?: (item: CardItem, anchor: CardAnchor) => void;
  /** D-1025 (F1) — الاسمُ يمشي فقط حين يُرى صفُّ البطاقة؛ الافتراضيُّ `true` لمن لا يعرف */
  marquee?: boolean;
}) {
  const { tokens } = useApp();
  /* D-1027 (F3) — كان `w185` لكلِّ عرضٍ ≤ ١٢٠: باهتٌ على شاشات ٣× */
  const uri = posterFor(item.posterPath, width);
  const ref = useRef<View>(null);
  return (
    <Pressable
      ref={ref}
      onPress={() => onPress(item)}
      onLongPress={
        onHold
          ? () => ref.current?.measureInWindow((x, y, w, h) => onHold(item, { x, y, width: w, height: h }))
          : undefined
      }
      delayLongPress={350}
      style={{ width }}
    >
      <View
        style={{
          width,
          aspectRatio: 2 / 3,
          borderRadius: radius.poster,
          overflow: "hidden",
          backgroundColor: tokens.surface,
          borderWidth: 1,
          borderColor: tokens.border,
        }}
      >
        {uri ? (
          <Image
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={150}
            cachePolicy="memory-disk"
            recyclingKey={item.key}
          />
        ) : null}
        {typeof item.count === "number" && item.count > 0 ? (
          <View
            style={{
              position: "absolute",
              top: 8,
              end: 8,
              minWidth: 24,
              height: 24,
              paddingHorizontal: 6,
              borderRadius: radius.pill,
              backgroundColor: tokens.accent,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text size={12} weight="700" color={tokens.onAccent} style={{ fontVariant: ["tabular-nums"] }}>
              {String(item.count)}
            </Text>
          </View>
        ) : null}
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 8, paddingBottom: 8, paddingTop: 28 }}>
          <Image source={VEIL} style={StyleSheet.absoluteFill} contentFit="fill" />
          <MarqueeText text={item.title} size={12} weight="600" color="#fff" style={styles.shadow} active={marquee} />
        </View>
        <StatusThread progress={item.progress} completed={item.completed} dropped={item.dropped} />
      </View>
    </Pressable>
  );
});

/** خيطُ اللون أسفلَ الملصق — وصفةُ `StatusThread.tsx` حرفاً */
/**
 * خيطُ الحالة — نسخةُ `StatusThread` الويب (D-322) بحالاتها الأربع. `export`
 * منذ Phase 11-C (D-955) لأنّ بطاقةَ «اكتشف» تقرؤه أيضاً (**استخراجٌ لا نسخ**،
 * درسُ D-289)، ومعه `saved` («عندك» ولم يبدأ — سماويٌّ `info` كاملاً).
 */
export function StatusThread({ progress, completed, dropped, saved = false }: { progress: number; completed: boolean; dropped: boolean; saved?: boolean }) {
  const { tokens } = useApp();
  const pct = Math.max(0, Math.min(100, progress));
  /* المكتبةُ لا تمرّر `saved`/`watched` للبطاقة (كما `LibraryCell`): **ما لم يبدأ
     ولم يُوقَف بلا خيطٍ أصلاً** (`hasStatus` في الويب)، والسماويُّ (`--info`)
     لِـ«عندك» في سطوحٍ أخرى — يبقى رمزاً هنا ولا يُرسم. */
  if (!dropped && !saved && pct <= 0) return null;
  /* وموقوفٌ لم يبدأ أحمرُ كامل؛ الموقوفُ الجاري أحمرُ بمقدار تقدّمه (D-784) */
  const full = completed || ((dropped || saved) && pct <= 0);
  const color = dropped ? tokens.error : completed || pct >= 100 ? tokens.success : pct > 0 ? tokens.accent : tokens.info;
  return (
    <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 6, backgroundColor: "rgba(0,0,0,0.5)" }}>
      <View style={{ height: "100%", width: full ? "100%" : `${pct}%`, backgroundColor: color }} />
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: { textShadowColor: "rgba(0,0,0,0.5)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
});
