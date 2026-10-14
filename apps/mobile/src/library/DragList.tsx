import React, { useCallback, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, { measure, scrollTo, useAnimatedRef, useAnimatedScrollHandler, useAnimatedStyle, useFrameCallback, useSharedValue, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useApp } from "../state";
import { Icon } from "../icons";
import { radius } from "../theme";

/**
 * ====== قائمةُ السحب الواحدة — محرّكُ كلِّ ترتيبٍ في التطبيق ======
 *
 * 🆕 **قرارُ أحمد ١٤ أكتوبر («١أ»)**: الترتيبُ كلُّه بالسحب، بلا أسهم — طابورُ «للمشاهدة» (`ReorderBody`)،
 * وورقةُ الترتيب والإخفاء الموحّدة (`ArrangeSheet`: أقسامُ الرئيسيّة · الأرقام · التبويبات)، وأقسامُ ودجت لوبز.
 * **فالمحرّكُ هنا مرّةً واحدة** وكلٌّ منها يرسم صفَّه: محرّكان للسحب يفترقان في أوّل إصلاح (القاعدة ٣).
 *
 * الأرقامُ أرقامُ `ReorderBody` الأصليّة حرفاً (K2): المواضعُ قيمٌ على خيط الواجهة (`slots`)، **المقبضُ وحدَه يمسك**
 * (لو أمسكه الصفُّ كلُّه لتنازع مع التمرير)، التمريرُ يُقفل أثناء السحب، والتمريرُ الذاتيُّ عند الحافّة
 * (`EDGE` · `STEP` كلَّ إطار)، و`to = from + round(dy / row)`. React يرسم عند الإمساك والإفلات فقط.
 */
const EDGE = 56;
const STEP = 8;

type Slots = Record<string, number>;

export function DragList({
  keys,
  rowHeight,
  maxHeight,
  onOrder,
  renderRow,
  handleLabel,
  onDragChange,
}: {
  keys: string[];
  rowHeight: number;
  maxHeight?: number;
  /** الترتيبُ بعد كلِّ إفلاتٍ غيّر شيئاً */
  onOrder: (keys: string[]) => void;
  /** محتوى الصفّ — والمقبضُ يُرسم في طرفه بيد المحرّك */
  renderRow: (key: string, index: number, dragging: boolean) => React.ReactNode;
  handleLabel: (key: string, index: number) => string;
  /** 🆕 D-1397 — إمساكٌ وإفلات: صفحةٌ تتمرّر حول القائمة تقفل تمريرَها ما دام صفٌّ ممسوكاً */
  onDragChange?: (dragging: boolean) => void;
}) {
  const { tokens } = useApp();
  const [order, setOrder] = useState<string[]>(keys);
  /* الترتيبُ الحاليُّ للإفلات التالي — يُبلَّغ المستدعي خارجَ مُحدِّث الحالة (المُحدِّثُ قد يُنادى مرّتين) */
  const orderRef = useRef<string[]>(keys);
  const [dragging, setDragging] = useState<string | null>(null);
  const [rows] = useState(keys);
  const ROW = rowHeight;
  const slots = useSharedValue<Slots>(Object.fromEntries(keys.map((k, i) => [k, i])));
  const dragKey = useSharedValue("");
  const dy = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const startScroll = useSharedValue(0);
  const edge = useSharedValue(0);
  const bodyTop = useSharedValue(0);
  const bodyH = useSharedValue(0);
  const count = keys.length;
  const scroll = useAnimatedRef<Reanimated.ScrollView>();
  const body = useAnimatedRef<View>();

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  /* التمريرُ الذاتيّ: كلَّ إطارٍ ما دام الإصبعُ عند الحافّة — وما تحرّك يُضاف إلى الإزاحة فلا يقفز الصفّ */
  const auto = useFrameCallback(() => {
    if (!dragKey.value || !edge.value) return;
    const max = Math.max(0, count * ROW - bodyH.value);
    const next = Math.max(0, Math.min(max, scrollY.value + edge.value));
    const moved = next - scrollY.value;
    if (!moved) return;
    scrollY.value = next;
    scrollTo(scroll, 0, next, false);
    dy.value += moved;
  }, false);

  const onGrab = useCallback(
    (key: string) => {
      setDragging(key);
      onDragChange?.(true);
      auto.setActive(true);
    },
    [auto, onDragChange],
  );
  const onDrop = useCallback(
    (f: number, to: number) => {
      auto.setActive(false);
      setDragging(null);
      onDragChange?.(false);
      if (f === to) return;
      const next = [...orderRef.current];
      const [x] = next.splice(f, 1);
      next.splice(to, 0, x);
      orderRef.current = next;
      setOrder(next);
      onOrder(next);
    },
    [auto, onOrder, onDragChange],
  );

  /* إيماءةٌ واحدةٌ ثابتةٌ لكلِّ صفٍّ بمفتاحه (درسُ D-1094: مستجيبٌ يُنشأ في كلِّ رسمة يفقد ما تراكم من الإزاحة) */
  const gestureFor = useMemo(() => {
    const cache = new Map<string, ReturnType<typeof Gesture.Pan>>();
    return (key: string) => {
      const hit = cache.get(key);
      if (hit) return hit;
      const g = Gesture.Pan()
        .minDistance(0)
        .onStart(() => {
          const m = measure(body);
          if (m) {
            bodyTop.value = m.pageY;
            bodyH.value = m.height;
          }
          dragKey.value = key;
          dy.value = 0;
          startScroll.value = scrollY.value;
          edge.value = 0;
          scheduleOnRN(onGrab, key);
        })
        .onUpdate((e) => {
          if (dragKey.value !== key) return;
          dy.value = e.translationY + (scrollY.value - startScroll.value);
          const yInBody = e.absoluteY - bodyTop.value;
          edge.value = yInBody < EDGE ? -STEP : bodyH.value - yInBody < EDGE ? STEP : 0;
        })
        .onFinalize(() => {
          if (dragKey.value !== key) return;
          const cur = slots.value;
          const f = cur[key];
          const to = Math.max(0, Math.min(count - 1, f + Math.round(dy.value / ROW)));
          if (to !== f) {
            const next: Slots = {};
            for (const k of Object.keys(cur)) {
              const s = cur[k];
              next[k] = k === key ? to : f < to && s > f && s <= to ? s - 1 : f > to && s >= to && s < f ? s + 1 : s;
            }
            slots.value = next;
          }
          dy.value = 0;
          dragKey.value = "";
          edge.value = 0;
          scheduleOnRN(onDrop, f, to);
        });
      cache.set(key, g);
      return g;
    };
  }, [body, bodyTop, bodyH, dragKey, dy, startScroll, scrollY, edge, slots, count, onGrab, onDrop, ROW]);

  return (
    <View ref={body} collapsable={false} style={maxHeight ? { maxHeight } : undefined}>
      <Reanimated.ScrollView
        ref={scroll}
        scrollEnabled={dragging === null}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ height: count * ROW, paddingHorizontal: 4 }}
      >
        {rows.map((k) => {
          const at = order.indexOf(k);
          return (
            <DragRow key={k} rowKey={k} row={ROW} dragging={dragging === k} slots={slots} dragKey={dragKey} dy={dy} count={count} tokens={tokens}>
              <View style={{ flex: 1, minWidth: 0 }}>{renderRow(k, at, dragging === k)}</View>
              <GestureDetector gesture={gestureFor(k)}>
                <View
                  accessibilityRole="button"
                  accessibilityLabel={handleLabel(k, at)}
                  style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: dragging === k ? tokens.surface : "transparent" }}
                >
                  <Icon name="grip" size={18} color={dragging === k ? tokens.accent : tokens.muted} />
                </View>
              </GestureDetector>
            </DragRow>
          );
        })}
      </Reanimated.ScrollView>
    </View>
  );
}

/** صفٌّ واحد — موضعُه وإزاحتُه على خيط الواجهة؛ React يرسمه عند الإمساك والإفلات فقط */
function DragRow({
  rowKey,
  row,
  dragging,
  slots,
  dragKey,
  dy,
  count,
  tokens,
  children,
}: {
  rowKey: string;
  row: number;
  dragging: boolean;
  slots: SharedValue<Slots>;
  dragKey: SharedValue<string>;
  dy: SharedValue<number>;
  count: number;
  tokens: ReturnType<typeof useApp>["tokens"];
  children: React.ReactNode;
}) {
  const slide = useAnimatedStyle(() => {
    const s = slots.value[rowKey] ?? 0;
    const dk = dragKey.value;
    let shift = 0;
    if (dk) {
      const f = slots.value[dk] ?? 0;
      const to = Math.max(0, Math.min(count - 1, f + Math.round(dy.value / row)));
      if (dk === rowKey) shift = dy.value;
      else if (f < to && s > f && s <= to) shift = -row;
      else if (f > to && s >= to && s < f) shift = row;
    }
    return { transform: [{ translateY: s * row + shift }, { scale: dk === rowKey ? 1.02 : 1 }] };
  });
  return (
    <Reanimated.View
      style={[
        {
          position: "absolute",
          left: 4,
          right: 4,
          top: 0,
          height: row - 8,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingHorizontal: 8,
          borderRadius: radius.card,
          backgroundColor: dragging ? tokens.surface2 : "transparent",
          zIndex: dragging ? 10 : 0,
          elevation: dragging ? 12 : 0,
          shadowColor: "#000",
          shadowOpacity: dragging ? 0.45 : 0,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
        },
        slide,
      ]}
    >
      {children}
    </Reanimated.View>
  );
}
