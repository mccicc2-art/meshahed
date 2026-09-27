import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, { measure, scrollTo, useAnimatedRef, useAnimatedScrollHandler, useAnimatedStyle, useFrameCallback, useSharedValue, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { Image } from "expo-image";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import { Sheet } from "./Sheet";
import { posterFor } from "../poster";
import type { QueueItem } from "../contracts";

/**
 * ====== ورقةُ الترتيب — نسخةُ `ReorderSheet.tsx` (الويب، D-605/D-719) ======
 * (D-948 — البندُ الثاني: «ترتيبُ طابور «للمشاهدة» بالسحب»)
 *
 * 🔑 **المقبضُ وحدَه يمسك السحب** (حجّةُ الويب حرفاً): لو أمسكه الصفُّ كلُّه
 * لتنازع مع تمرير الورقة — فالـ`PanResponder` على زرِّ المقبض (`w-11 h-11`)،
 * والتمريرُ يُقفل ما دام السحبُ جارياً. الصفُّ `ROW` ٦٨ (`h = ROW - 8`)،
 * الملصقُ `w-9 h-[54px] rounded-md`، الاسمُ `text-14 font-semibold` بسطرين،
 * والموضعُ `text-12 text-muted` تحته. **المسحوبُ يرتفع** (`bg-surface-2` ·
 * ظلٌّ · `scale 1.02`) **والباقي ينزاح بمقدار صفٍّ** (`shift`) — الحسبةُ
 * نفسُها: `to = from + round(dy / ROW)`.
 *
 * 🔑 **والتمريرُ الذاتيُّ عند الحافّة** (٥٦ بكسل من طرفَي الجسد، ٨ بكسل كلَّ
 * إطار): بلا هذا لا يبلغ صفٌّ من آخر القائمة أوّلَها إلّا بعشر سحبات.
 * **وما تحرّك فعلاً يُضاف إلى الإزاحة** حتى لا يقفز الصفُّ المسحوب.
 *
 * «تمّ» يعيد المفاتيحَ بترتيبها، والكتابةُ (`saveHomeQueueOrder`) بيد المستدعي.
 *
 * 🆕 **K2 — السحبُ كلُّه على خيط الواجهة**. كان كلُّ إطارٍ يكتب `dy` في حالة React فيُعاد رسمُ الصفوف كلِّها
 * والإصبعُ يتحرّك، والتمريرُ الذاتيُّ مؤقّتٌ على JS. الآن **مواضعُ الصفوف نفسُها قيمٌ على خيط الواجهة**
 * (`slots`: مفتاحٌ ⇐ موضع) — الصفوفُ تُرسم بترتيبها الأوّل ولا تتحرّك إلّا بإزاحتها؛ وعند الإفلات يتبدّل
 * الموضعُ وتُصفَّر الإزاحةُ **في الإطار نفسِه** فلا يقفز صفّ، ثمّ يُبلَّغ React بالترتيب الجديد (للرقم و«تمّ»).
 * **والأرقامُ كما كانت حرفاً**: `ROW` · `EDGE` · `STEP` كلَّ إطار · `to = from + round(dy / ROW)` · والمقبضُ
 * يمسك من أوّل لمسة. React يرسم مرّتين لكلِّ سحبة (الإمساكُ والإفلات) لا في كلِّ إطار.
 */
const ROW = 68;
const EDGE = 56;
const STEP = 8;

type Slots = Record<string, number>;

export function ReorderSheet({
  items,
  onClose,
  onDone,
}: {
  items: QueueItem[];
  onClose: () => void;
  onDone: (keys: string[]) => void;
}) {
  const { t, tokens } = useApp();
  /* الترتيبُ لـReact (الرقمُ و«تمّ»)؛ والصفوفُ تُرسم بترتيبها الأوّل وتقف حيث تقول `slots` */
  const [order, setOrder] = useState<QueueItem[]>(items);
  const [dragging, setDragging] = useState<string | null>(null);
  const [rows] = useState(items);
  const slots = useSharedValue<Slots>(Object.fromEntries(items.map((x, i) => [x.key, i])));
  const dragKey = useSharedValue("");
  const dy = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const startScroll = useSharedValue(0);
  const edge = useSharedValue(0);
  const bodyTop = useSharedValue(0);
  const bodyH = useSharedValue(0);
  const count = items.length;
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
      auto.setActive(true);
    },
    [auto],
  );
  const onDrop = useCallback(
    (f: number, to: number) => {
      auto.setActive(false);
      setDragging(null);
      if (f !== to) {
        setOrder((prev) => {
          const next = [...prev];
          const [x] = next.splice(f, 1);
          next.splice(to, 0, x);
          return next;
        });
      }
    },
    [auto],
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
          /* الإزاحةُ = حركةُ الإصبع + ما مرّره الجسدُ ذاتيّاً منذ الإمساك */
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
          /* الموضعُ الجديدُ والإزاحةُ صفراً في الإطار نفسِه */
          dy.value = 0;
          dragKey.value = "";
          edge.value = 0;
          scheduleOnRN(onDrop, f, to);
        });
      cache.set(key, g);
      return g;
    };
  }, [body, bodyTop, bodyH, dragKey, dy, startScroll, scrollY, edge, slots, count, onGrab, onDrop]);

  return (
    <Sheet title={t.listReorder} onClose={onClose}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: -14 }}>
        <Text size={12} muted style={{ flex: 1 }}>{t.listReorderHint}</Text>
        <Button label={t.listDone} onPress={() => onDone(order.map((x) => x.key))} style={{ paddingVertical: 8, paddingHorizontal: 14 }} />
      </View>
      <View ref={body} collapsable={false} style={{ maxHeight: 460 }}>
        <Reanimated.ScrollView
          ref={scroll}
          scrollEnabled={dragging === null}
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ height: count * ROW, paddingHorizontal: 4 }}
        >
          {rows.map((it) => {
            const at = order.findIndex((x) => x.key === it.key);
            return (
              <ReorderRow
                key={it.key}
                item={it}
                index={at}
                dragging={dragging === it.key}
                slots={slots}
                dragKey={dragKey}
                dy={dy}
                count={count}
                gesture={gestureFor(it.key)}
                tokens={tokens}
                label={`${it.title} — ${t.listPositionOf(at + 1, order.length)}`}
              />
            );
          })}
        </Reanimated.ScrollView>
      </View>
    </Sheet>
  );
}

/** صفٌّ واحد — موضعُه وإزاحتُه على خيط الواجهة؛ React يرسمه عند الإمساك والإفلات فقط */
function ReorderRow({
  item,
  index,
  dragging,
  slots,
  dragKey,
  dy,
  count,
  gesture,
  tokens,
  label,
}: {
  item: QueueItem;
  index: number;
  dragging: boolean;
  slots: SharedValue<Slots>;
  dragKey: SharedValue<string>;
  dy: SharedValue<number>;
  count: number;
  gesture: ReturnType<typeof Gesture.Pan>;
  tokens: ReturnType<typeof useApp>["tokens"];
  label: string;
}) {
  const key = item.key;
  const slide = useAnimatedStyle(() => {
    const s = slots.value[key] ?? 0;
    const dk = dragKey.value;
    let shift = 0;
    if (dk) {
      const f = slots.value[dk] ?? 0;
      const to = Math.max(0, Math.min(count - 1, f + Math.round(dy.value / ROW)));
      if (dk === key) shift = dy.value;
      else if (f < to && s > f && s <= to) shift = -ROW;
      else if (f > to && s >= to && s < f) shift = ROW;
    }
    return { transform: [{ translateY: s * ROW + shift }, { scale: dk === key ? 1.02 : 1 }] };
  });
  const url = posterFor(item.poster_path, 36);
  return (
    <Reanimated.View
      style={[
        {
          position: "absolute",
          left: 4,
          right: 4,
          top: 0,
          height: ROW - 8,
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
      <View style={{ width: 36, height: 54, borderRadius: 6, overflow: "hidden", backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.border, alignItems: "center", justifyContent: "center" }}>
        {url ? <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Icon name="card" size={14} color={tokens.muted} />}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size={14} weight="600" numberOfLines={2} style={{ lineHeight: 17 }}>{item.title}</Text>
        <Text size={12} muted style={{ marginTop: 2, fontVariant: ["tabular-nums"] }}>{String(index + 1)}</Text>
      </View>
      <GestureDetector gesture={gesture}>
        <View
          accessibilityRole="button"
          accessibilityLabel={label}
          style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: dragging ? tokens.surface : "transparent" }}
        >
          <Icon name="grip" size={18} color={dragging ? tokens.accent : tokens.muted} />
        </View>
      </GestureDetector>
    </Reanimated.View>
  );
}
