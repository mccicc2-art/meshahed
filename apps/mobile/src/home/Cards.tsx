import React, { memo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon, type IconName } from "../icons";
import { radius } from "../theme";
import { posterFor } from "../poster";
import { backdropUrl } from "@/core/media";
import { BACKDROP_W } from "./Section";
import type { HomeContinueCard, HomeMixedCard } from "../contracts";

const VEIL = require("../../assets/poster-veil.png");

/**
 * بطاقاتُ الرئيسية التي لا نظيرَ لها في المكتبة (Phase 11-H · H2) — **بقيم
 * الويب حرفاً**: `ContinueCard`/`ListContinueCard` (بطاقةٌ عريضة ٢٢٠ × ملصق×١٫٥
 * بمشهدٍ وخيطِ تقدّم — D-437/D-507) و`CompactMediaRow` (صفُّ المختصر و«القادم»).
 * الملصقاتُ نفسُها في `library/PosterCard` — لا بطاقةَ ملصقٍ ثانية (القاعدة ٣).
 */

/** ارتفاعُ بطاقة «تابِع المشاهدة» = عرضُ الملصق × ١٫٣٦ — كان ×١٫٥ (`continueCardBox`) حتى D-1084؛
    المعاملُ لا الكثافة يصغر، فتبقى صفوفُ الملصقات كما هي والنسبةُ تتبع الكثافةَ كما كانت (١١٨ ⇐ ١٦٠) */
export const continueCardH = (posterW: number) => Math.round(posterW * 1.36);

export const ContinueCard = memo(function ContinueCard({
  card,
  posterW,
  variant,
  backdropPath,
  onPress,
  onCheck,
  busy,
}: {
  card: HomeContinueCard;
  posterW: number;
  variant: "card" | "row";
  /** مشهدُ «التالي» لبطاقات القوائم — من `extras`، وبطاقةُ العمل تحمل مشهدَها */
  backdropPath: string | null;
  onPress: () => void;
  /** زرُّ «شاهدتُها» — العملُ يختم حلقتَه (D-437)، والقائمةُ تختم «التالي» فيها (D-604/D-1079) */
  onCheck?: () => void;
  busy?: boolean;
}) {
  const { t, tokens } = useApp();
  const isShow = card.type === "show";
  const title = isShow ? card.title : card.list_name;
  const poster = isShow ? card.poster_path : card.next.poster_path;
  const backdrop = isShow ? card.backdrop_path : backdropPath;
  const uri = backdropUrl(backdrop, "w780") ?? posterFor(poster, BACKDROP_W);
  const watched = card.watched;
  const total = isShow ? card.aired : card.total;
  const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((watched / total) * 100))) : 0;
  const left = total > watched ? total - watched : 0;
  /* السطرُ الثاني كالويب: «S2 E5 · باقي ٣» للعمل، وللقائمة اسمُها فوق اسم «التالي» */
  const sub = isShow ? [card.episode_label, left > 0 ? t.leftEps(left) : null].filter(Boolean).join(" · ") : (card.next.title ?? "—");
  const counter = isShow ? `${pct}%` : `${watched} / ${total}`;
  /* D-1079 — الصحُّ على البطاقات الأربع كالويب (`ListContinueCard` يرسمه لبطاقات القوائم وطابور
     «للمشاهدة» أيضاً)؛ كان للعمل وحدَه فغاب عن فيلم «للمشاهدة» — بلاغُ أحمد على 1.11.8 */
  const canCheck = !isShow || !!card.episode_label;
  /* أعلى عمود النصّ داخل الصفّ (قياسُ Yoga يشمل الإطارَ والحشوة) — تقديرُ البداية ٢٣ ثمّ القياسُ يصحّحه في الرسمة الأولى */
  const [rowTextTop, setRowTextTop] = useState(23);
  const check =
    onCheck ? (
      <Pressable
        onPress={onCheck}
        disabled={busy || !canCheck}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={t.markWatchedAria}
        style={({ pressed }) => [
          styles.check,
          /* D-1080 — في الصفّ: أعلى الدائرة على مستوى أعلى الاسم (يُقاس من عمود النصّ لا رقمٌ أصمّ —
             فيصحّ لبطاقة العمل ذات السطرين ولبطاقة القائمة ذات السطر الواحد)، وأرضيّتُها سوداءُ صلبة
             لا زجاجٌ رماديّ فوق سطح البطاقة — بلاغُ أحمد على 1.11.8: «الصحّ يلامس النسبة» */
          variant === "row" ? { top: rowTextTop, end: 12, backgroundColor: "#000" } : { top: 10, end: 10, backgroundColor: "rgba(0,0,0,0.55)" },
          { borderColor: "rgba(255,255,255,0.35)", opacity: pressed ? 0.7 : canCheck ? 1 : 0.35 },
        ]}
      >
        <Icon name="check" size={20} color="#fff" />
      </Pressable>
    ) : null;

  if (variant === "row") {
    return (
      <View>
        {/* D-1089 — الصفُّ على لون الصفحة (`bg`) لا `surface` (أحمد بلقطة: «الخلفيّة الرصاصيّة أبغاها سوداء») —
            كبطاقة القائمة والتريلر (D-1081): الحدُّ الإطارُ الرفيع وحده، و`bg` لا `#000` كي تصحّ `daylight` */}
        <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}، ${sub}`} style={({ pressed }) => [styles.row, { borderColor: tokens.border, backgroundColor: tokens.bg, opacity: pressed ? 0.85 : 1 }]}>
          <View style={{ width: 144, aspectRatio: 16 / 10, borderRadius: radius.md, overflow: "hidden", backgroundColor: tokens.surface2 }}>
            {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} cachePolicy="memory-disk" /> : <View style={styles.center}><Icon name="film" size={20} color={tokens.muted} /></View>}
          </View>
          {/* D-1080 — العمودُ يترك للصحّ مقعدَه (٤٤ + ١٢ من الطرف − حشوةُ الصفّ ٨ + فسحة ٨) فلا يلامس
              العنوانُ ولا الخيطُ ولا النسبةُ الدائرة — مثلُ `pe-16` في الويب */}
          <View
            onLayout={onCheck ? (e) => setRowTextTop(Math.round(e.nativeEvent.layout.y)) : undefined}
            style={{ flex: 1, minWidth: 0, paddingEnd: onCheck ? 56 : 0 }}
          >
            {!isShow ? <Text size={10} weight="600" color={tokens.accent} numberOfLines={1}>{title}</Text> : null}
            <Text size={15} weight="600" numberOfLines={1}>{isShow ? title : (card.next.title ?? "—")}</Text>
            {isShow ? <Text size={12} weight="500" muted numberOfLines={1} style={{ marginTop: 4 }}>{sub}</Text> : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
              <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: tokens.divider, overflow: "hidden" }}>
                <View style={{ width: `${pct}%`, height: "100%", backgroundColor: pct >= 100 ? tokens.success : tokens.accent }} />
              </View>
              <Text size={12} weight="600" muted style={{ fontVariant: ["tabular-nums"] }}>{counter}</Text>
            </View>
          </View>
        </Pressable>
        {check}
      </View>
    );
  }
  return (
    <View style={{ width: BACKDROP_W }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${title}، ${sub}`}
        style={({ pressed }) => [
          { width: BACKDROP_W, height: continueCardH(posterW), borderRadius: radius.poster, overflow: "hidden", backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.border, transform: [{ scale: pressed ? 0.98 : 1 }] },
        ]}
      >
        {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} cachePolicy="memory-disk" /> : <View style={styles.center}><Icon name="film" size={26} color={tokens.muted} /></View>}
        {/* `from-black/85 via-black/25` — حجابُ الملصق نفسُه ممدوداً على نصف البطاقة */}
        <Image source={VEIL} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "60%" }} contentFit="fill" />
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 12, paddingBottom: 14 }}>
          {!isShow ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 }}>
              <Icon name="list" size={11} color={tokens.accent} />
              <Text size={10} weight="600" color={tokens.accent} numberOfLines={1} style={{ flexShrink: 1 }}>{title}</Text>
            </View>
          ) : null}
          <Text size={14} weight="600" color="#fff" numberOfLines={1} style={[styles.shadow, { paddingEnd: 40 }]}>{isShow ? title : (card.next.title ?? "—")}</Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginTop: 4 }}>
            <Text size={12} weight="600" color="rgba(255,255,255,0.75)" numberOfLines={1} style={{ flexShrink: 1 }}>{isShow ? sub : counter}</Text>
            <Text size={12} weight="600" color="rgba(255,255,255,0.7)" style={{ fontVariant: ["tabular-nums"] }}>{isShow ? counter : `${pct}%`}</Text>
          </View>
        </View>
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 4, backgroundColor: tokens.divider }}>
          <View style={{ width: `${pct}%`, height: "100%", backgroundColor: pct >= 100 ? tokens.success : tokens.accent }} />
        </View>
      </Pressable>
      {check}
    </View>
  );
});

/**
 * `CompactMediaRow` — صفُّ المختصر و«القادم»: ملصقٌ صغير (أو رقاقةُ التاريخ)،
 * عنوانٌ ١٥/٦٠٠، سطرٌ ثانٍ ١٢ باهت، خيطُ تقدّمٍ اختياريّ، سهمٌ في الطرف.
 * D-1089 — على لون الصفحة كأخته صفُّ «أكمل المشاهدة»: عائلةُ الصفوف واحدة (القاعدة ٣).
 */
export const MediaRow = memo(function MediaRow({
  title,
  subtitle,
  chip,
  posterPath,
  progress,
  fallbackIcon = "film",
  onPress,
}: {
  title: string;
  subtitle?: string | null;
  /** رقاقةٌ نصّيّة في صدر الصفّ بدل الملصق («بعد ٣ أيام») */
  chip?: string | null;
  posterPath?: string | null;
  progress?: number | null;
  fallbackIcon?: IconName;
  onPress: () => void;
}) {
  const { tokens } = useApp();
  const uri = posterPath ? posterFor(posterPath, 40) : null;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={[title, subtitle].filter(Boolean).join("، ")} style={({ pressed }) => [styles.row, { paddingEnd: 10, borderColor: tokens.border, backgroundColor: tokens.bg, opacity: pressed ? 0.85 : 1 }]}>
      {chip ? (
        <View style={{ width: 56, height: 56, borderRadius: radius.md, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}>
          <Text size={12} weight="800" color={tokens.accent} numberOfLines={2} style={{ textAlign: "center", lineHeight: 14 }}>{chip}</Text>
        </View>
      ) : (
        <View style={{ width: 40, height: 60, borderRadius: radius.sm, overflow: "hidden", backgroundColor: tokens.surface2 }}>
          {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} cachePolicy="memory-disk" /> : <View style={styles.center}><Icon name={fallbackIcon} size={16} color={tokens.muted} /></View>}
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size={15} weight="600" numberOfLines={1}>{title}</Text>
        {subtitle ? <Text size={12} weight="500" muted numberOfLines={1} style={{ marginTop: 4 }}>{subtitle}</Text> : null}
        {typeof progress === "number" && progress > 0 ? (
          <View style={{ marginTop: 8, height: 4, borderRadius: 2, backgroundColor: tokens.divider, overflow: "hidden" }}>
            <View style={{ width: `${Math.min(100, progress)}%`, height: "100%", backgroundColor: progress >= 100 ? tokens.success : tokens.accent }} />
          </View>
        ) : null}
      </View>
      <View style={{ transform: [{ rotate: "-90deg" }] }}>
        <Icon name="chevron-down" size={16} color={tokens.muted} />
      </View>
    </Pressable>
  );
});

export function mixedRowSubtitle(x: HomeMixedCard): string | null {
  return x.ep ?? x.subtitle;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, borderWidth: 1, padding: 8 },
  center: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  shadow: { textShadowColor: "rgba(0,0,0,0.6)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  check: { position: "absolute", width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
