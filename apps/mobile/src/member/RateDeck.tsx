import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { I18nManager, View, type LayoutChangeEvent } from "react-native";
import { Image } from "expo-image";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, {
  Easing,
  interpolate,
  Extrapolation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Icon } from "../icons";
import { posterFor } from "../poster";
import { haptic } from "../haptics";
import { num } from "@/core/i18n";
import { RATE_DECKS, rateKey, type RateQueueItem } from "@/core/rateQueue";

/**
 * ====== 🆕 «بانتظار تقييمك» — المروحة (أحمد ٢٦ نوفمبر، استوديو المشاركة: «ت١ب» بنجمة، «ن١أ» بلا الزرّين) ======
 *
 * **لماذا مروحةٌ لا قائمة**: طلبُ أحمد «عملٌ واحدٌ في كلِّ مرّة، يُرفع ويُسحب، ويختفي ما قُيِّم» مع صورتِه المرجعيّة: بطاقةٌ في الوسط
 * وخلفها جارتان مائلتان. **الجارتان رأسا الرزمتين المجاورتين** (الأفلام من البداية، والأنمي من النهاية) لا عملان من الرزمة نفسِها —
 * فالسحبُ جانباً يأتي بالرزمة التي تراها، لا بشيءٍ مخفيّ.
 *
 * - **التقييمُ شريطٌ لا نجوم** («ب»): الإصبعُ على الشريط يُظهر نجمةً فيها الرقمُ فوقه وعلى البطاقة، والتركُ هو الحفظ. إبعادُ الإصبع
 *   عن الشريط إلغاء (اللمسةُ الخاطئةُ لا تُحفظ).
 * - **النجمةُ لا الدائرة** («بدال الدائرة الصفراء تكون نجمة»): `star-filled` نفسُها من مجموعة الأيقونات الواحدة.
 * - **الرفُّ تحت الشريط**: آخرُ ما قيّمتَه صغيراً بنجمته — البطاقةُ المقيَّمة تهبط إليه فيرى العضوُ أين ذهبت.
 * - **بلا زرّين** («ن١أ بدون الزران»): «لاحقاً» رفعُ البطاقة، و«لم أشاهده» ضغطٌ مطوّل — والسطرُ تحت الاسم يقولهما.
 *
 * 🔑 **الحركةُ على خيط الواجهة** (`Gesture.Pan` + Reanimated، كـ`TabSlide`): البطاقاتُ مفاتيحُها مفاتيحُ الأعمال، فكلُّ تبديلٍ يحرّك
 * البطاقةَ نفسَها إلى دورها الجديد بدل هدمها ورسم أخرى. والمغادِرةُ تُرسم في طبقةٍ فوقها وتطير وحدَها، فلا ينتظر ما بعدها.
 */

export type FlyKind = "rate" | "later" | "remove";
type Role = "c0" | "c1" | "S" | "E";
const ROLE_N: Record<Role, number> = { c0: 0, c1: 1, S: 2, E: 3 };

/** الجانبُ البادئ فعليّاً: يمينٌ في العربيّة ويسارٌ في الإنجليزيّة — والتحويلاتُ لا تنقلب مع الاتّجاه فنقلبها نحن */
const START = I18nManager.isRTL ? 1 : -1;
const MS = 420;
const SPRING = { damping: 20, stiffness: 170, mass: 0.9 };
const EASE = Easing.bezier(0.2, 0.9, 0.2, 1);

type Target = { x: number; y: number; r: number; s: number; dim: number; z: number };
function target(role: Role, W: number): Target {
  "worklet";
  if (role === "c0") return { x: 0, y: 0, r: 0, s: 1, dim: 0, z: 10 };
  if (role === "c1") return { x: 0, y: -14, r: 0, s: 0.92, dim: 0.55, z: 9 };
  const side = role === "S" ? START : -START;
  return { x: side * W * 0.5, y: 24, r: side * 8, s: 0.8, dim: 0.4, z: 6 };
}

export type Decks = readonly (readonly RateQueueItem[])[];

export function RateDeck({
  decks,
  ci,
  onDeck,
  onRate,
  onRated,
  onLater,
  onMenu,
  onOpen,
  tray,
  metaOf,
}: {
  /** الرزمُ الثلاث بترتيب `RATE_DECKS`، كلٌّ بما بقي فيها مرتّباً */
  decks: Decks;
  ci: number;
  onDeck: (i: number) => void;
  /** يحفظ ويعود بالنجاح — والنجاحُ وحدَه يُطير البطاقةَ إلى الرفّ */
  onRate: (r: RateQueueItem, v: number) => Promise<boolean>;
  /** البطاقةُ طارت: يخرج العملُ من رزمته في اللحظة نفسِها (رسمةٌ واحدة — فلا تختفي قبل أن تظهر الطائرة) */
  onRated: (r: RateQueueItem, v: number) => void;
  onLater: (r: RateQueueItem) => void;
  onMenu: (r: RateQueueItem) => void;
  onOpen: (r: RateQueueItem) => void;
  tray: readonly { key: string; poster: string | null; v: number }[];
  metaOf: (r: RateQueueItem) => string;
}) {
  const { t, locale } = useApp();
  const reduced = useReducedMotion();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox((b) => (Math.abs(b.w - width) < 1 && Math.abs(b.h - height) < 1 ? b : { w: width, h: height }));
  }, []);
  /* البطاقةُ تملأ ما يتّسع: ٦٢٪ من العرض، أو ما يبقى بعد الاسم وسطر الإرشاد — أيّهما أصغر */
  const H = box.w ? Math.max(150, Math.min(box.w * 0.62 * 1.5, box.h - 16 - 28 - 52)) : 0;
  const W = H / 1.5;

  const cur = useMemo(() => decks[ci] ?? [], [decks, ci]);
  const top = cur[0];
  const startDeck = decks[ci - 1];
  const endDeck = decks[ci + 1];

  /* الأدوار: الوسطُ وما خلفه من الرزمة نفسِها، ورأسا الرزمتين المجاورتين على الجانبين */
  const cast = useMemo(() => {
    const out: { r: RateQueueItem; role: Role }[] = [];
    if (cur[1]) out.push({ r: cur[1], role: "c1" });
    if (startDeck?.[0]) out.push({ r: startDeck[0], role: "S" });
    if (endDeck?.[0]) out.push({ r: endDeck[0], role: "E" });
    if (cur[0]) out.push({ r: cur[0], role: "c0" });
    return out;
  }, [cur, startDeck, endDeck]);

  /* ---------- السحب ---------- */
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const dragging = useSharedValue(0);
  const canStart = useSharedValue(ci > 0 ? 1 : 0);
  const canEnd = useSharedValue(ci < RATE_DECKS.length - 1 ? 1 : 0);
  useEffect(() => {
    canStart.value = ci > 0 ? 1 : 0;
    canEnd.value = ci < RATE_DECKS.length - 1 ? 1 : 0;
    /* بعد أن قرأت البطاقاتُ الإزاحةَ في آثار أدوارها (آثارُ الأبناء تسبق الأب) */
    dx.value = 0;
    dy.value = 0;
  }, [ci, canStart, canEnd, dx, dy]);

  /** الدرجةُ الحيّة على البطاقة (أثناء الشريط وبعد الترك حتى تطير) */
  const [score, setScore] = useState(0);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [fly, setFly] = useState<{ r: RateQueueItem; kind: FlyKind; v: number; fx: number; fy: number; id: number }[]>([]);
  const flyId = useRef(0);
  const launch = useCallback((r: RateQueueItem, kind: FlyKind, v = 0, fx = 0, fy = 0) => {
    flyId.current += 1;
    const id = flyId.current;
    setFly((f) => [...f, { r, kind, v, fx, fy, id }]);
  }, []);
  const landed = useCallback((id: number) => setFly((f) => f.filter((x) => x.id !== id)), []);

  const later = useCallback(
    (fx = 0, fy = 0) => {
      if (!top || lock.current) return;
      haptic.pick();
      launch(top, "later", 0, fx, fy);
      onLater(top);
    },
    [top, launch, onLater],
  );

  const decide = useCallback(
    (x: number, y: number, cancel: boolean) => {
      const side = Math.abs(x) > Math.abs(y);
      if (!cancel && top && y < -90 && !side) {
        dx.value = 0;
        dy.value = 0;
        later(x, y);
        return;
      }
      /* 🔴 أحمد ٢٦ نوفمبر بتسجيل: «إذا حركت يمين يطلع يسار — اعكس الحركة». السحبُ يدفع البطاقةَ كصفحةٍ تُقلَّب: تدفعها نحو جانبٍ
         فتأتي الرزمةُ من الجانب الآخر (يساراً في العربيّة تأتي الأفلامُ من اليمين) — والتي دُفعت تستقرّ حيث دفعتها */
      const bringStart = Math.sign(x) === -START;
      if (!cancel && side && Math.abs(x) > 70) {
        const ni = bringStart ? ci - 1 : ci + 1;
        if (ni >= 0 && ni < RATE_DECKS.length) {
          /* الإزاحةُ لا تُصفَّر هنا: البطاقةُ التي سُحبت تنطلق إلى جانبها من حيث تركها الإصبع (أثرُ دورها في `DeckCard`)، ثمّ تُصفَّر */
          haptic.pick();
          onDeck(ni);
          return;
        }
      }
      dx.value = withSpring(0, { damping: 18, stiffness: 220 });
      dy.value = withSpring(0, { damping: 18, stiffness: 220 });
    },
    [top, ci, onDeck, later, dx, dy],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-12, 12])
        .activeOffsetY([-12, 12])
        .onStart(() => {
          dragging.value = 1;
        })
        .onUpdate((e) => {
          dx.value = e.translationX;
          dy.value = e.translationY;
        })
        .onEnd((e) => {
          dragging.value = 0;
          scheduleOnRN(decide, e.translationX, e.translationY, false);
        })
        .onFinalize((_e, ok) => {
          if (ok) return;
          dragging.value = 0;
          scheduleOnRN(decide, 0, 0, true);
        }),
    [decide, dx, dy, dragging],
  );
  const press = useMemo(() => {
    const tap = Gesture.Tap().onEnd((_e, ok) => {
      if (ok && top) scheduleOnRN(onOpen, top);
    });
    const hold = Gesture.LongPress()
      .minDuration(450)
      .onStart(() => {
        if (top) scheduleOnRN(onMenu, top);
      });
    return Gesture.Exclusive(hold, tap);
  }, [top, onOpen, onMenu]);
  const gesture = useMemo(() => Gesture.Race(pan, press), [pan, press]);

  /* ---------- التقييم ---------- */
  const commit = useCallback(
    async (v: number) => {
      if (!top || lock.current || !v) return;
      lock.current = true;
      setBusy(true);
      setScore(v);
      haptic.pick();
      const ok = await onRate(top, v);
      if (ok) {
        haptic.success();
        /* النجمةُ تُرى على البطاقة لحظةً ثمّ تهبط إلى الرفّ */
        setTimeout(
          () => {
            launch(top, "rate", v);
            onRated(top, v);
            setScore(0);
            setBusy(false);
            lock.current = false;
          },
          reduced ? 60 : 380,
        );
      } else {
        setScore(0);
        setBusy(false);
        lock.current = false;
      }
    },
    [top, onRate, onRated, launch, reduced],
  );

  const rest = RATE_DECKS.map((_, i) => i).filter((i) => i !== ci && (decks[i]?.length ?? 0) > 0);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }} onLayout={onLayout}>
        {H ? (
          <>
            <GestureDetector gesture={gesture}>
              <View style={{ height: 16 + H + 28 }} collapsable={false}>
                {cast.map(({ r, role }) => (
                  <DeckCard
                    key={rateKey(r.kind, r.id)}
                    r={r}
                    role={role}
                    W={W}
                    left={(box.w - W) / 2}
                    dx={dx}
                    dy={dy}
                    canStart={canStart}
                    canEnd={canEnd}
                    score={role === "c0" ? score : 0}
                    reduced={reduced}
                    label={role === "c0" ? r.title : undefined}
                  />
                ))}
                {fly.map((f) => (
                  <FlyCard key={f.id} f={f} W={W} left={(box.w - W) / 2} H={H} boxH={box.h} reduced={reduced} onDone={landed} />
                ))}
              </View>
            </GestureDetector>
            {top ? (
              <View style={{ alignItems: "center", paddingHorizontal: 24, gap: 2 }}>
                <Text size={19} weight="700" numberOfLines={1} style={{ textAlign: "center" }}>{top.title}</Text>
                <Text size={14} muted numberOfLines={1}>{metaOf(top)}</Text>
              </View>
            ) : (
              <View style={{ position: "absolute", top: 0, bottom: 0, start: 0, end: 0, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 24 }}>
                <Text size={21} weight="700" style={{ textAlign: "center" }}>
                  {rest.length ? t.rateQueueDeckDone(t.rateQueueDeckNames[ci]) : t.rateQueueAllDone}
                </Text>
                <Text size={15} muted style={{ textAlign: "center" }}>{rest.length ? t.rateQueueWhereNext : t.rateQueueEmpty}</Text>
                {rest.length ? (
                  <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                    {rest.map((i) => (
                      <Button key={i} label={`${t.rateQueueDeckNames[i]} · ${num(decks[i].length, locale)}`} variant="ghost" onPress={() => onDeck(i)} />
                    ))}
                  </View>
                ) : null}
              </View>
            )}
          </>
        ) : null}
      </View>
      <Scrub disabled={!top || busy} onValue={setScore} onCommit={commit} key={top ? rateKey(top.kind, top.id) : "none"} />
      <Tray tray={tray} />
    </View>
  );
}

/* ---------- البطاقة ---------- */
function DeckCard({
  r,
  role,
  W,
  left,
  dx,
  dy,
  canStart,
  canEnd,
  score,
  reduced,
  label,
}: {
  r: RateQueueItem;
  role: Role;
  W: number;
  left: number;
  dx: SharedValue<number>;
  dy: SharedValue<number>;
  canStart: SharedValue<number>;
  canEnd: SharedValue<number>;
  score: number;
  reduced: boolean;
  label?: string;
}) {
  const { tokens } = useApp();
  const first = target(role, W);
  /* أوّلُ ظهور: ما خلف الوسط يكبر من خلفه، والباقي يظهر في مكانه */
  const x = useSharedValue(first.x);
  const y = useSharedValue(first.y);
  const rot = useSharedValue(first.r);
  const sc = useSharedValue(role === "c1" ? 0.8 : first.s * 0.94);
  const dim = useSharedValue(first.dim);
  const op = useSharedValue(0);
  const roleN = useSharedValue(ROLE_N[role]);
  const was = useRef(role);
  useEffect(() => {
    const to = target(role, W);
    /* كانت في الوسط وسُحبت إلى رزمةٍ أخرى: تبدأ رحلتَها من موضع الإصبع لا من الوسط */
    if (was.current === "c0" && role !== "c0") {
      x.value = x.value + dx.value;
      y.value = y.value + Math.min(dy.value, 30);
      rot.value = rot.value + dx.value * 0.05;
    }
    was.current = role;
    roleN.value = ROLE_N[role];
    /* «حسّن الموشن»: نابضٌ لا منحنى ثابت — البطاقةُ تكمل اندفاعَ الإصبع ثمّ تستقرّ بلا قفزة */
    const move = <T extends number>(sv: SharedValue<number>, v: T) => {
      sv.value = reduced ? v : withSpring(v, SPRING);
    };
    move(x, to.x);
    move(y, to.y);
    move(rot, to.r);
    move(sc, to.s);
    dim.value = withTiming(to.dim, { duration: reduced ? 0 : MS, easing: EASE });
    op.value = withTiming(1, { duration: reduced ? 0 : 300 });
  }, [role, W, reduced, x, y, rot, sc, dim, op, roleN, dx, dy]);

  /** كم اقتربت هذه الجارةُ مع الإصبع (٠..١) — صفرٌ للوسط وما خلفه، وللجانب الذي لا رزمةَ فيه */
  const near = (): number => {
    "worklet";
    const n = roleN.value;
    if (n < 2) return 0;
    /* الجارةُ القادمةُ هي التي في الجهة المقابلة لاتّجاه السحب */
    const bringStart = Math.sign(dx.value) === -START;
    const blocked = (bringStart && canStart.value === 0) || (!bringStart && canEnd.value === 0);
    const mine = (n === 2 && bringStart) || (n === 3 && !bringStart);
    if (!mine || blocked || Math.abs(dx.value) <= Math.abs(dy.value)) return 0;
    return interpolate(Math.abs(dx.value), [0, W * 0.9], [0, 1], Extrapolation.CLAMP);
  };
  const style = useAnimatedStyle(() => {
    const n = roleN.value;
    let tx = x.value;
    let ty = y.value;
    let tr = rot.value;
    let ts = sc.value;
    if (n === 0) {
      /* الوسطُ يتبع الإصبع — ونحو رزمةٍ غير موجودة بربع المسافة (مقاومةٌ تقول «لا شيء هنا») */
      const bringStart = Math.sign(dx.value) === -START;
      const blocked = (bringStart && canStart.value === 0) || (!bringStart && canEnd.value === 0);
      const rx = blocked ? dx.value * 0.25 : dx.value;
      tx += rx;
      ty += Math.min(dy.value, 30);
      tr += rx * 0.04;
      ts -= interpolate(Math.abs(rx), [0, W], [0, 0.08], Extrapolation.CLAMP);
    } else if (n >= 2) {
      /* القادمةُ تنزلق نحو الوسط مع الإصبع وتعتدل وتكبر؛ والأخرى تتراجع قليلاً — فالعينُ ترى إلى أين تذهب قبل الترك */
      const k = near();
      if (k > 0) {
        tx = tx * (1 - k * 0.85);
        ty = ty - k * 18;
        tr = tr * (1 - k);
        ts = ts + k * 0.14;
      } else if (Math.abs(dx.value) > Math.abs(dy.value)) {
        const back = interpolate(Math.abs(dx.value), [0, W], [0, 0.12], Extrapolation.CLAMP);
        tx = tx * (1 + back);
        ts = ts - back * 0.3;
      }
    }
    return {
      opacity: op.value,
      zIndex: n === 0 ? 10 : n === 1 ? 9 : 6,
      transform: [{ translateX: tx }, { translateY: ty }, { rotate: `${tr}deg` }, { scale: ts }],
    };
  });
  /* ظلُّ ما ليس في الوسط — ويضيء ما يقترب */
  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.value * (1 - near()) }));
  const uri = posterFor(r.poster_path, 342);
  return (
    <Reanimated.View
      pointerEvents="none"
      accessible={!!label}
      accessibilityLabel={label}
      style={[
        {
          position: "absolute",
          top: 16,
          left,
          width: W,
          aspectRatio: 2 / 3,
          borderRadius: 14,
          backgroundColor: tokens.surface,
          shadowColor: "#000",
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 18 },
          elevation: role === "c0" ? 14 : 6,
        },
        style,
      ]}
    >
      <View style={{ flex: 1, borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" }}>
        {uri ? (
          <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" transition={150} />
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 12 }}>
            <Icon name={r.kind === "tv" ? "tv" : "film"} size={28} color={tokens.muted} />
            <Text size={14} weight="700" numberOfLines={3} style={{ textAlign: "center", marginTop: 8 }}>{r.title}</Text>
          </View>
        )}
        <Reanimated.View pointerEvents="none" style={[{ position: "absolute", top: 0, bottom: 0, start: 0, end: 0, backgroundColor: "#000" }, dimStyle]} />
      </View>
      <StarBadge v={score} size={76} reduced={reduced} style={{ position: "absolute", bottom: 6, end: 6 }} />
    </Reanimated.View>
  );
}

/** النجمةُ وفيها الرقم — تنبثق حين يظهر رقمٌ وتنطوي حين يزول */
function StarBadge({ v, size, reduced, style }: { v: number; size: number; reduced: boolean; style?: object }) {
  const { tokens } = useApp();
  const s = useSharedValue(v ? 1 : 0);
  const last = useRef(v);
  if (v) last.current = v;
  useEffect(() => {
    s.value = reduced ? (v ? 1 : 0) : withSpring(v ? 1 : 0, { damping: 11, stiffness: 260 });
  }, [v, reduced, s]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }, { rotate: `${(1 - s.value) * -30}deg` }], opacity: s.value > 0.02 ? 1 : 0 }));
  return (
    <Reanimated.View pointerEvents="none" style={[{ width: size, height: size, alignItems: "center", justifyContent: "center" }, style, a]}>
      <View style={{ position: "absolute" }}>
        <Icon name="star-filled" size={size} color={tokens.accent} />
      </View>
      <Text size={Math.round(size * 0.32)} weight="700" color={tokens.onAccent} style={{ marginTop: size * 0.08, writingDirection: "ltr" }}>
        {String(last.current || "")}
      </Text>
    </Reanimated.View>
  );
}

/** البطاقةُ المغادِرة — تبدأ من الوسط (ومن حيث تركها الإصبع) وتطير وحدَها ثمّ تُرفع */
function FlyCard({
  f,
  W,
  left,
  H,
  boxH,
  reduced,
  onDone,
}: {
  f: { r: RateQueueItem; kind: FlyKind; v: number; fx: number; fy: number; id: number };
  W: number;
  left: number;
  H: number;
  boxH: number;
  reduced: boolean;
  onDone: (id: number) => void;
}) {
  const { tokens } = useApp();
  const x = useSharedValue(f.fx);
  const y = useSharedValue(Math.min(f.fy, 30));
  const s = useSharedValue(1);
  const o = useSharedValue(1);
  const r = useSharedValue(f.fx * 0.05);
  useEffect(() => {
    const cfg = { duration: reduced ? 0 : MS, easing: EASE };
    if (f.kind === "later") {
      y.value = withTiming(-H * 1.15, cfg);
      s.value = withTiming(0.85, cfg);
      r.value = withTiming(-3, cfg);
      o.value = withTiming(0, cfg);
    } else if (f.kind === "rate") {
      /* تهبط إلى الرفّ تحت الشريط وتصغر حتى حجمِ ملصقه */
      /* مركزُ الرفّ: تحت مساحة البطاقة (`boxH`) بالشريط (~١٠٠) ونصفِ الرفّ */
      y.value = withTiming(boxH + 130 - 16 - H / 2, cfg);
      s.value = withTiming(34 / W, cfg);
      o.value = withSequence(withTiming(1, { duration: reduced ? 0 : MS - 80 }), withTiming(0, { duration: reduced ? 0 : 80 }));
    } else {
      s.value = withTiming(0.6, cfg);
      o.value = withTiming(0, cfg);
    }
    const id = setTimeout(() => onDone(f.id), (reduced ? 0 : MS) + 40);
    return () => clearTimeout(id);
  }, [f, H, W, boxH, reduced, x, y, s, o, r, onDone]);
  const a = useAnimatedStyle(() => ({
    opacity: o.value,
    transform: [{ translateX: x.value }, { translateY: y.value }, { rotate: `${r.value}deg` }, { scale: s.value }],
  }));
  const uri = posterFor(f.r.poster_path, 342);
  return (
    <Reanimated.View pointerEvents="none" style={[{ position: "absolute", zIndex: 30, top: 16, left, width: W, aspectRatio: 2 / 3, borderRadius: 14, overflow: "hidden", backgroundColor: tokens.surface }, a]}>
      {uri ? <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" /> : null}
      {f.kind === "rate" ? <StarBadge v={f.v} size={76} reduced style={{ position: "absolute", bottom: 6, end: 6 }} /> : null}
    </Reanimated.View>
  );
}

/* ---------- الشريط ---------- */
const PAD = 8;
function Scrub({ disabled, onValue, onCommit }: { disabled: boolean; onValue: (v: number) => void; onCommit: (v: number) => void }) {
  const { t, tokens } = useApp();
  const [w, setW] = useState(0);
  const [v, setV] = useState(0);
  const [off, setOff] = useState(false);
  const val = useRef(0);
  const width = useSharedValue(0);
  const y0 = useSharedValue(0);
  const last = useSharedValue(0);
  const away = useSharedValue(0);

  const show = useCallback(
    (n: number, isAway: boolean) => {
      setOff(isAway);
      const k = isAway ? 0 : n;
      if (k && k !== val.current) haptic.pick();
      val.current = k;
      setV(k);
      onValue(k);
    },
    [onValue],
  );
  const end = useCallback(
    (cancel: boolean) => {
      const k = val.current;
      setOff(false);
      /* 🔴 تسجيلُ أحمد ٢٦ نوفمبر: «بعد ما أحدد كم نجمة يختفي الشريط وكأني ما حددت ثم اتسجل تحت» — كان الشريطُ يُفرَّغ لحظةَ الترك
         والحفظُ ما زال في الطريق. الآن يبقى على ما اخترتَ (رقمُه وكلمتُه) حتى تطير البطاقة، فيُركَّب شريطٌ جديدٌ للتي بعدها
         (`key` بالعمل)؛ وإن فشل الحفظ عاد فارغاً (`disabled` يعود فيُفرَّغ أدناه) */
      if (!cancel && k) {
        onCommit(k);
        return;
      }
      val.current = 0;
      setV(0);
      onValue(0);
    },
    [onCommit, onValue],
  );

  const g = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!disabled)
        .minDistance(0)
        .onBegin((e) => {
          y0.value = e.y;
          away.value = 0;
          const f = Math.min(1, Math.max(0, START === 1 ? (width.value - PAD - e.x) / (width.value - PAD * 2) : (e.x - PAD) / (width.value - PAD * 2)));
          const n = Math.max(1, Math.ceil(f * 10));
          last.value = n;
          scheduleOnRN(show, n, false);
        })
        .onUpdate((e) => {
          /* الإصبعُ بعيداً عن الشريط = إلغاء */
          const a = Math.abs(e.y - y0.value) > 50 ? 1 : 0;
          const f = Math.min(1, Math.max(0, START === 1 ? (width.value - PAD - e.x) / (width.value - PAD * 2) : (e.x - PAD) / (width.value - PAD * 2)));
          const n = Math.max(1, Math.ceil(f * 10));
          if (n !== last.value || a !== away.value) {
            last.value = n;
            away.value = a;
            scheduleOnRN(show, n, a === 1);
          }
        })
        .onFinalize(() => {
          /* الإلغاءُ بالإبعاد وحدَه: لمسةٌ واحدةٌ بلا حركةٍ تقييمٌ أيضاً (لا تصل «نشطةً» فلا يُعتدّ بـ`ok`) */
          scheduleOnRN(end, away.value === 1);
        }),
    [disabled, show, end, width, y0, last, away],
  );

  /* فشلُ الحفظ: الشريطُ يعود فارغاً (القفلُ رُفع والعملُ نفسُه ما زال في الوسط) */
  const wasDisabled = useRef(disabled);
  useEffect(() => {
    if (wasDisabled.current && !disabled && val.current) {
      val.current = 0;
      setV(0);
    }
    wasDisabled.current = disabled;
  }, [disabled]);

  /* 🆕 أحمد ٢٦ نوفمبر («الكلام زحمة، الغير مهم احذفه وبسّطه»): لا سطرَ تعليماتٍ دائماً فوق الشريط — الأرقامُ تحته تقول ما يُفعل،
     والكلمةُ تظهر وأنت تسحب وحدَه (والسطرُ بارتفاعه الثابت فلا يقفز الشريط) */
  const word = off ? t.rateQueueLetGo : v ? t.rateQueueWords[v] : "";
  const inner = Math.max(0, w - PAD * 2);
  return (
    <View style={{ paddingHorizontal: 14, paddingTop: 4, opacity: disabled && !v ? 0.6 : 1 }}>
      <Text size={15} weight="600" color={v ? tokens.accent : tokens.muted} style={{ textAlign: "center", height: 22 }}>{word}</Text>
      <GestureDetector gesture={g}>
        <View
          collapsable={false}
          onLayout={(e) => {
            setW(e.nativeEvent.layout.width);
            width.value = e.nativeEvent.layout.width;
          }}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={t.rateQuestion}
          accessibilityValue={{ min: 1, max: 10, now: v || undefined }}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }, { name: "activate" }]}
          onAccessibilityAction={(e) => {
            const n = e.nativeEvent.actionName;
            if (n === "increment") show(Math.min(10, (val.current || 0) + 1), false);
            else if (n === "decrement") show(Math.max(1, (val.current || 2) - 1), false);
            else if (n === "activate" && val.current) end(false);
          }}
          style={{ height: 72, marginTop: 6 }}
        >
          <View style={{ position: "absolute", start: PAD, end: PAD, top: 28, height: 10, borderRadius: 999, backgroundColor: tokens.surface2, overflow: "hidden" }}>
            <View style={{ position: "absolute", start: 0, top: 0, bottom: 0, width: `${v * 10}%`, borderRadius: 999, backgroundColor: tokens.accent }} />
          </View>
          <View style={{ position: "absolute", start: PAD, end: PAD, top: 46, flexDirection: "row", justifyContent: "space-between" }}>
            {Array.from({ length: 10 }, (_, i) => (
              <Text key={i} size={11} style={{ color: tokens.disabled, width: 16, textAlign: "center", writingDirection: "ltr" }}>{String(i + 1)}</Text>
            ))}
          </View>
          {v ? (
            <StarBadge v={v} size={46} reduced style={{ position: "absolute", top: -22, start: PAD + ((v - 0.5) / 10) * inner - 23 }} />
          ) : null}
        </View>
      </GestureDetector>
    </View>
  );
}

/** الرفّ: آخرُ ستّة قيّمتَها صغاراً بنجومها — أحدثُها في البداية */
function Tray({ tray }: { tray: readonly { key: string; poster: string | null; v: number }[] }) {
  const { tokens } = useApp();
  return (
    <View style={{ flexDirection: "row", gap: 6, justifyContent: "center", height: 64, paddingTop: 2 }}>
      {tray.map((x) => {
        const uri = posterFor(x.poster, 92);
        return (
          <View key={x.key} style={{ width: 34, height: 51 }}>
            <View style={{ flex: 1, borderRadius: 8, overflow: "hidden", backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.border }}>
              {uri ? <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" /> : null}
            </View>
            <View style={{ position: "absolute", bottom: -10, alignSelf: "center" }}>
              <StarBadge v={x.v} size={24} reduced />
            </View>
          </View>
        );
      })}
    </View>
  );
}
