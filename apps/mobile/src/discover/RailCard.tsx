import React, { memo, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useApp } from "../state";
import { Text } from "../ui";
import { radius } from "../theme";
import { StatusThread, type CardAnchor } from "../library/PosterCard";
import { posterUrl } from "@/core/media";
import type { CuratedCard } from "../contracts";

/**
 * ====== بطاقةُ صفٍّ في «اكتشف» — نسخةُ بطاقة `RankedRail` (الويب) ======
 * (Phase 11-C · C1 — D-955)
 *
 * 📐 كما في الويب: ملصقٌ `2/3` بعرض ١١٢ (`w-[112px]`)، `rounded-poster`، حدٌّ؛
 * **الرقمُ** في القاع من جهة البداية `text-2xl font-bold` أبيضُ بظلّ (للمرتَّب
 * وحدَه)؛ **رقاقةُ IMDb** في القاع من جهة النهاية `bg-black/55 rounded-md
 * text-12 font-bold`؛ **والاسمُ تحت الملصق** `text-12 font-medium mt-1.5`
 * بسطرين — لا فوقه كما في بطاقة المكتبة (فرقٌ مقصودٌ في الويب منذ D-435).
 * **وخيطُ الحالة** (`StatusThread`) نفسُه: «عندك» سماويّ · تقدّمٌ أصفر · تمّ أخضر ·
 * موقوفٌ أحمر — من كاش `me:library` لا من نداءٍ (D-322: قراءةُ خريطةٍ لا نداء).
 */
export const RAIL_CARD_W = 112;

export type LibMark = { saved: boolean; progress: number; completed: boolean; dropped: boolean } | null;

export const RailCard = memo(function RailCard({
  card,
  rank,
  lib,
  onPress,
  note,
  onHold,
  held = false,
}: {
  card: CuratedCard;
  /** رقمُ الترتيب (١..) — للمرتَّب وحدَه */
  rank: number | null;
  lib: LibMark;
  onPress: (card: CuratedCard) => void;
  /** سطرُ السبب تحت الاسم («من «X»») — «مقترحٌ لك» وحدَه (`PickedForYou`) */
  note?: string | null;
  /** D-978 — الضغطُ المطوَّل يفتح قائمةَ `HoldMenu` مرساةً على الملصق (D-229: أيّ بوستر) */
  onHold?: (card: CuratedCard, anchor: CardAnchor) => void;
  /** البطاقةُ المضغوطةُ الآن — إطارٌ ذهبيٌّ كإطار `PosterHold` الويب */
  held?: boolean;
}) {
  const { tokens } = useApp();
  const uri = posterUrl(card.poster_path, "w342");
  const ref = useRef<View>(null);
  return (
    <Pressable
      onPress={() => onPress(card)}
      onLongPress={onHold ? () => ref.current?.measureInWindow((x, y, w, h) => onHold(card, { x, y, width: w, height: h })) : undefined}
      delayLongPress={350}
      style={{ width: RAIL_CARD_W }}
    >
      <View
        ref={ref}
        style={{
          width: RAIL_CARD_W,
          aspectRatio: 2 / 3,
          borderRadius: radius.poster,
          overflow: "hidden",
          backgroundColor: tokens.surface2,
          borderWidth: held ? 2 : 1,
          borderColor: held ? tokens.accent : tokens.border,
        }}
      >
        {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={`${card.kind}-${card.id}`} /> : null}
        {/* `h-12 bg-gradient-to-t from-black/90` — حجابُ الملصق نفسُه (`poster-veil`) */}
        {rank !== null || card.imdb_rating !== null ? (
          <Image source={VEIL} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 48 }} contentFit="fill" />
        ) : null}
        {rank !== null ? (
          <Text size={24} weight="700" color="#fff" style={[styles.rank, { position: "absolute", bottom: 4, start: 6 }]}>
            {String(rank)}
          </Text>
        ) : null}
        {card.imdb_rating !== null ? (
          <View style={{ position: "absolute", bottom: 6, end: 6, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
            <Text size={8} weight="800" color="#F5C518">IMDb</Text>
            <Text size={12} weight="700" color="#fff" style={{ fontVariant: ["tabular-nums"] }}>{card.imdb_rating.toFixed(1)}</Text>
          </View>
        ) : null}
        {lib ? <StatusThread progress={lib.progress} completed={lib.completed} dropped={lib.dropped} saved={lib.saved} /> : null}
      </View>
      <Text size={12} weight="500" numberOfLines={2} style={{ marginTop: 6, lineHeight: 16 }}>
        {card.title}
      </Text>
      {note ? (
        <Text size={11} muted numberOfLines={1} style={{ marginTop: 2 }}>
          {note}
        </Text>
      ) : null}
    </Pressable>
  );
});

const VEIL = require("../../assets/poster-veil.png");
const styles = StyleSheet.create({
  rank: { textShadowColor: "rgba(0,0,0,0.6)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3, lineHeight: 26 },
});
