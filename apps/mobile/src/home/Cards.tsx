import React, { memo, useEffect, useId, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import Reanimated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon, type IconName } from "../icons";
import { radius } from "../theme";
import { posterFor } from "../poster";
import { backdropUrl } from "@/core/media";
import type { HomeContinueCard, HomeMixedCard } from "../contracts";

const VEIL = require("../../assets/poster-veil.png");

/**
 * بطاقاتُ الرئيسية التي لا نظيرَ لها في المكتبة (Phase 11-H · H2) — **بقيم
 * الويب حرفاً**: `ContinueCard`/`ListContinueCard` (بطاقةٌ عريضة — مقاسُها اليوم في D-1278؛ كانت ٢٢٠ × ملصق×١٫٥
 * بمشهدٍ وخيطِ تقدّم — D-437/D-507) و`CompactMediaRow` (صفُّ المختصر و«القادم»).
 * الملصقاتُ نفسُها في `library/PosterCard` — لا بطاقةَ ملصقٍ ثانية (القاعدة ٣).
 */

/** 🆕 D-1379 — مقاسُ بطاقة «تابِع المشاهدة» يأتي من `posterSizes.ts` (الكثافةُ ونسبةُ الشاشة)؛ كان مشتقّاً من عرض الملصق هنا
    (D-1278 · D-1279 · D-1377) فكبرت مع «الكبير» حتى صارت شبهَ مربّعة. */

/** D-1278 — دائرةُ الصحّ على البطاقة ٣٦ (في الصفّ باقيةٌ ٤٤): ٤٤ فوق بطاقةٍ ارتفاعُها ١٢٢ تأكل ثلثَها.
    و`hitSlop` ٤ يُبقي هدفَ اللمس ٤٤. */
const CARD_CHECK = 36;
const ROW_CHECK = 44;

/** 🆕 D-1409 — حركةُ التأشير بأرقام `ContinueCard` الويب حرفاً (أحمد بتسجيلٍ من المتصفّح: «الإنميشن الموجود في
    المتصفّح يكون موجود في الآيفون والأندرويد»): `-translate-x-8`/`translate-x-8` = ٣٢، و`duration-200` بـ`ease-in`
    للخروج و`ease-out` للدخول. الإزاحةُ فيزيائيّةٌ يساراً في الاتّجاهين كالويب (`translate-x` ليس منطقيّاً هناك). */
const SLIDE_PX = 32;
const SLIDE_MS = 200;

export const ContinueCard = memo(function ContinueCard({
  card: liveCard,
  size,
  variant,
  backdropPath,
  onPress,
  onCheck,
  busy,
  onHold,
}: {
  card: HomeContinueCard;
  /** عرضُ البطاقة وارتفاعُها — `usePosterSizes` */
  size: { w: number; h: number };
  variant: "card" | "row";
  /** مشهدُ «التالي» لبطاقات القوائم — من `extras`، وبطاقةُ العمل تحمل مشهدَها */
  backdropPath: string | null;
  onPress: () => void;
  /** زرُّ «شاهدتُها» — العملُ يختم حلقتَه (D-437)، والقائمةُ تختم «التالي» فيها (D-604/D-1079) */
  onCheck?: () => void;
  busy?: boolean;
  /** 🆕 D-1280 — الضغطُ المطوّل على بطاقة مسلسل: يمرّر موضعَها لتُرسى القائمةُ عليه (وصفةُ `PosterCard`).
      «إيقاف مؤقّت» يُخرج العملَ من هذا الصفّ، فبابُه هنا لا في المكتبة وحدَها */
  onHold?: (anchor: { x: number; y: number; width: number; height: number }) => void;
}) {
  const { t, tokens } = useApp();
  /* 🆕 D-1409 — المرحلةُ كـ`slide` في الويب: الوالدُ يقدّم البطاقةَ تفاؤلاً لحظةَ الضغطة (`patchCard`)، فتُجمَّد
     الحلقةُ الحاليّة طوال الخروج كي ينزلق القديمُ لا الجديد — ثمّ تُفكّ فتدخل التالية من اليمين.
     للمسلسل وحدَه كالويب (قرار أحمد «٣ أ»): بطاقاتُ القوائم و«للمشاهدة» بلا حركة. */
  const [phase, setPhase] = useState<"idle" | "out" | "in" | "fill">("idle");
  const [frozen, setFrozen] = useState<HomeContinueCard | null>(null);
  const card = frozen ?? liveCard;
  const tx = useSharedValue(0);
  const op = useSharedValue(1);
  const slideStyle = useAnimatedStyle(() => ({ opacity: op.value, transform: [{ translateX: tx.value }] }));
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const gradId = `ck${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const filled = phase !== "idle";
  const pressCheck = () => {
    if (!onCheck) return;
    if (liveCard.type !== "show" || phase !== "idle") {
      onCheck();
      return;
    }
    /* الحلقةُ الأخيرةُ تفتح ورقةَ الاحتفال (شرطُ `finishedAll` نفسُه في `markNext`) ⇐ لا انزلاق، الدائرةُ تمتلئ وحدها
       كما تبقى ممتلئةً في الويب تحت الورقة */
    const finishedAll = liveCard.aired > 0 && liveCard.watched + 1 >= liveCard.aired;
    if (finishedAll) {
      setPhase("fill");
      onCheck();
      timers.current.push(setTimeout(() => setPhase("idle"), 600));
      return;
    }
    setFrozen(liveCard);
    setPhase("out");
    tx.value = withTiming(-SLIDE_PX, { duration: SLIDE_MS, easing: Easing.in(Easing.ease) });
    op.value = withTiming(0, { duration: SLIDE_MS, easing: Easing.in(Easing.ease) });
    onCheck();
    timers.current.push(
      setTimeout(() => {
        setFrozen(null);
        setPhase("in");
        tx.value = SLIDE_PX;
        tx.value = withTiming(0, { duration: SLIDE_MS, easing: Easing.out(Easing.ease) });
        op.value = withTiming(1, { duration: SLIDE_MS, easing: Easing.out(Easing.ease) });
        timers.current.push(setTimeout(() => setPhase("idle"), SLIDE_MS));
      }, SLIDE_MS),
    );
  };
  const holdRef = useRef<View>(null);
  const hold = onHold ? () => holdRef.current?.measureInWindow((x, y, width, height) => onHold({ x, y, width, height })) : undefined;
  const isShow = card.type === "show";
  const title = isShow ? card.title : card.list_name;
  const poster = isShow ? card.poster_path : card.next.poster_path;
  const backdrop = isShow ? card.backdrop_path : backdropPath;
  const uri = backdropUrl(backdrop, "w780") ?? posterFor(poster, size.w);
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
        onPress={pressCheck}
        disabled={busy || !canCheck || phase === "out"}
        hitSlop={variant === "row" ? 6 : 4}
        accessibilityRole="button"
        accessibilityLabel={t.markWatchedAria}
        style={({ pressed }) => [
          styles.check,
          variant === "row" ? styles.checkRow : styles.checkCard,
          /* D-1080 — في الصفّ: أعلى الدائرة على مستوى أعلى الاسم (يُقاس من عمود النصّ لا رقمٌ أصمّ —
             فيصحّ لبطاقة العمل ذات السطرين ولبطاقة القائمة ذات السطر الواحد)، وأرضيّتُها سوداءُ صلبة
             لا زجاجٌ رماديّ فوق سطح البطاقة — بلاغُ أحمد على 1.11.8: «الصحّ يلامس النسبة» */
          variant === "row" ? { top: rowTextTop, end: 12, backgroundColor: "#000" } : { top: 10, end: 10, backgroundColor: "rgba(0,0,0,0.55)" },
          { borderColor: "rgba(255,255,255,0.35)", opacity: pressed ? 0.7 : canCheck ? 1 : 0.35 },
          /* 🆕 D-1409 — تمتلئ لحظةَ التأشير بتدرّج الهويّة وتكبر قليلاً (`scale-105` و`linear-gradient(135deg, accent, accent-2)`
             في الويب)، ثمّ تعود زجاجيّةً للحلقة التالية. `busy` لا يُطفئها: الإقفالُ حتى ردّ الخادم باقٍ (قرار أحمد «٢ أ») */
          filled ? { borderColor: "transparent", opacity: 1, overflow: "hidden", transform: [{ scale: 1.05 }] } : null,
        ]}
      >
        {filled ? (
          <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100">
            <Defs>
              <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={tokens.accent} />
                <Stop offset="1" stopColor={tokens.accent2} />
              </LinearGradient>
            </Defs>
            <Circle cx="50" cy="50" r="50" fill={`url(#${gradId})`} />
          </Svg>
        ) : null}
        <Icon name="check" size={variant === "row" ? 20 : 18} color="#fff" />
      </Pressable>
    ) : null;

  if (variant === "row") {
    return (
      <Reanimated.View style={slideStyle}>
        {/* D-1089 — الصفُّ على لون الصفحة (`bg`) لا `surface` (أحمد بلقطة: «الخلفيّة الرصاصيّة أبغاها سوداء») —
            كبطاقة القائمة والتريلر (D-1081): الحدُّ الإطارُ الرفيع وحده، و`bg` لا `#000` كي تصحّ `daylight` */}
        <Pressable ref={holdRef} onPress={onPress} onLongPress={hold} delayLongPress={350} accessibilityRole="button" accessibilityLabel={`${title}، ${sub}`} style={({ pressed }) => [styles.row, { borderColor: tokens.border, backgroundColor: tokens.bg, opacity: pressed ? 0.85 : 1 }]}>
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
      </Reanimated.View>
    );
  }
  return (
    <Reanimated.View style={[{ width: size.w }, slideStyle]}>
      <Pressable
        ref={variant === "card" ? holdRef : undefined}
        onPress={onPress}
        onLongPress={hold}
        delayLongPress={350}
        accessibilityRole="button"
        accessibilityLabel={`${title}، ${sub}`}
        style={({ pressed }) => [
          { width: size.w, height: size.h, borderRadius: radius.poster, overflow: "hidden", backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.border, transform: [{ scale: pressed ? 0.98 : 1 }] },
        ]}
      >
        {/* `top`: الصورةُ الأطولُ من البطاقة تُقصّ من أسفلها تحت الحجاب، لا من رأسها */}
        {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" transition={150} cachePolicy="memory-disk" /> : <View style={styles.center}><Icon name="film" size={26} color={tokens.muted} /></View>}
        {/* `from-black/85 via-black/25` — حجابُ الملصق نفسُه ممدوداً على نصف البطاقة */}
        <Image source={VEIL} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "60%" }} contentFit="fill" />
        {/* السطرُ الثاني باقٍ (أيُّ حلقةٍ تالية لا يقولها الشريط). D-1278 — الحشوةُ ١٠ والقاعُ ١٢ (كانا ١٢ و٢٠):
            أحمد «النسبة وعدد الحلقات الباقية نزلها تحت» واختار «داخل البطاقة» — السطرُ يجاور الشريطَ الذي يشرحه.
            والخطّان ١٣ و١١ (كانا ١٤ و١٢: «صغّر الخط شوي»)؛ سطرُ القائمة باقٍ ١٠ فهو عند حدِّ القراءة. */}
        {/* 🆕 D-1279 — **ارتفاعُ السطر صريح** (١٣ · ١٧ · ١٤) والقاعُ ٨ والفواصلُ ٢: D-1278 أنزلت القاعَ وصغّرت الخطَّ،
            لكنّ `Text` بلا `lineHeight` يأخذ سطرَ Poppins الواسع (~٢٠ لخطّ ١٣) — فبقيت الأسطرُ متباعدةً والكتلةُ
            عاليةً عن الشريط، وسأل أحمد بلقطة: «نص التبويب ما عدلت فيه ونزلته؟». الصورةُ التي اعتمدها رُسمت
            بهذه الأرقام نفسِها. النسبةُ ~١٫٣ هي نسبةُ اسم الرئيسيّة (٢٢/٢٨) فلا تقصّ العربيَّ. */}
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 10, paddingBottom: 8 }}>
          {!isShow ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 2 }}>
              <Icon name="list" size={11} color={tokens.accent} />
              <Text size={10} weight="600" color={tokens.accent} numberOfLines={1} style={{ flexShrink: 1, lineHeight: 13 }}>{title}</Text>
            </View>
          ) : null}
          {/* بلا `paddingEnd`: الدائرةُ في الأعلى (قاعُها ٤٦) والعنوانُ تحتها — والمقعدُ المحجوز كان يقصّ العنوانَ بلا سبب */}
          <Text size={13} weight="600" color="#fff" numberOfLines={1} style={[styles.shadow, { lineHeight: 17 }]}>{isShow ? title : (card.next.title ?? "—")}</Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginTop: 2 }}>
            <Text size={11} weight="600" color="rgba(255,255,255,0.75)" numberOfLines={1} style={{ flexShrink: 1, lineHeight: 14 }}>{isShow ? sub : counter}</Text>
            <Text size={11} weight="600" color="rgba(255,255,255,0.7)" style={{ fontVariant: ["tabular-nums"], lineHeight: 14 }}>{isShow ? counter : `${pct}%`}</Text>
          </View>
        </View>
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 4, backgroundColor: tokens.divider }}>
          <View style={{ width: `${pct}%`, height: "100%", backgroundColor: pct >= 100 ? tokens.success : tokens.accent }} />
        </View>
      </Pressable>
      {check}
    </Reanimated.View>
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
  /* 🆕 D-1323 — صورةٌ فشلت لا تترك مربّعاً رماديّاً أخرس: رمزُ النوع يحلّ محلَّها (وهو ما يُرسم لمن لا ملصقَ له أصلاً).
     والعلمُ يُصفَّر إن تبدّل المسار — نمطُ «تعديل الحالة أثناء الرسم» لا `useEffect`. */
  const [failedPath, setFailedPath] = useState<string | null>(null);
  const uri = posterPath && failedPath !== posterPath ? posterFor(posterPath, 40) : null;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={[title, subtitle].filter(Boolean).join("، ")} style={({ pressed }) => [styles.row, { paddingEnd: 10, borderColor: tokens.border, backgroundColor: tokens.bg, opacity: pressed ? 0.85 : 1 }]}>
      {chip ? (
        <View style={{ width: 56, height: 56, borderRadius: radius.md, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}>
          <Text size={12} weight="800" color={tokens.accent} numberOfLines={2} style={{ textAlign: "center", lineHeight: 14 }}>{chip}</Text>
        </View>
      ) : (
        <View style={{ width: 40, height: 60, borderRadius: radius.sm, overflow: "hidden", backgroundColor: tokens.surface2 }}>
          {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} cachePolicy="memory-disk" onError={() => setFailedPath(posterPath ?? null)} /> : <View style={styles.center}><Icon name={fallbackIcon} size={16} color={tokens.muted} /></View>}
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
  check: { position: "absolute", borderWidth: 1, alignItems: "center", justifyContent: "center" },
  checkRow: { width: ROW_CHECK, height: ROW_CHECK, borderRadius: ROW_CHECK / 2 },
  checkCard: { width: CARD_CHECK, height: CARD_CHECK, borderRadius: CARD_CHECK / 2 },
});
