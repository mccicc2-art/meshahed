import React, { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useApp } from "../state";
import { Text } from "../ui";
import { radius } from "../theme";
import { posterUrl } from "@/core/media";

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
 * ⚠️ **ما لم يُنقل يُقال**: `MarqueeText` (السطرُ الذي يمشي — D-486) ⇢ هنا
 * سطرٌ واحدٌ يُقصّ (`numberOfLines={1}`) — **KNOWN_GAP-11** حتى B4؛ وقائمةُ
 * الضغط المطوَّل (G5) في B3.
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

export const PosterCard = memo(function PosterCard({
  item,
  width,
  onPress,
}: {
  item: CardItem;
  width: number;
  onPress: (item: CardItem) => void;
}) {
  const { tokens } = useApp();
  const uri = posterUrl(item.posterPath, width > 120 ? "w342" : "w185");
  return (
    <Pressable onPress={() => onPress(item)} style={{ width }}>
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
          <Text size={12} weight="600" color="#fff" numberOfLines={1} style={styles.shadow}>
            {item.title}
          </Text>
        </View>
        <StatusThread progress={item.progress} completed={item.completed} dropped={item.dropped} />
      </View>
    </Pressable>
  );
});

/** خيطُ اللون أسفلَ الملصق — وصفةُ `StatusThread.tsx` حرفاً */
function StatusThread({ progress, completed, dropped }: { progress: number; completed: boolean; dropped: boolean }) {
  const { tokens } = useApp();
  const pct = Math.max(0, Math.min(100, progress));
  /* المكتبةُ لا تمرّر `saved`/`watched` للبطاقة (كما `LibraryCell`): **ما لم يبدأ
     ولم يُوقَف بلا خيطٍ أصلاً** (`hasStatus` في الويب)، والسماويُّ (`--info`)
     لِـ«عندك» في سطوحٍ أخرى — يبقى رمزاً هنا ولا يُرسم. */
  if (!dropped && pct <= 0) return null;
  /* وموقوفٌ لم يبدأ أحمرُ كامل؛ الموقوفُ الجاري أحمرُ بمقدار تقدّمه (D-784) */
  const full = completed || (dropped && pct <= 0);
  const color = dropped ? tokens.error : completed || pct >= 100 ? tokens.success : tokens.accent;
  return (
    <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 6, backgroundColor: "rgba(0,0,0,0.5)" }}>
      <View style={{ height: "100%", width: full ? "100%" : `${pct}%`, backgroundColor: color }} />
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: { textShadowColor: "rgba(0,0,0,0.5)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
});
