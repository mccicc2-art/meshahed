import React, { useEffect, useRef, useState } from "react";
import { Animated, PanResponder, ScrollView, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import { Sheet } from "./Sheet";
import { posterUrl } from "@/core/media";
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
 */
const ROW = 68;
const EDGE = 56;
const STEP = 8;

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
  const [order, setOrder] = useState<QueueItem[]>(items);
  const [from, setFrom] = useState<number | null>(null);
  const [dy, setDy] = useState(0);
  const orderRef = useRef(order);
  orderRef.current = order;
  const fromRef = useRef<number | null>(null);
  const dyRef = useRef(0);
  const scroll = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const bodyH = useRef(0);
  const edge = useRef(0);
  const startScroll = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const bodyTop = useRef(0);
  const bodyRef = useRef<View>(null);

  const to = from === null ? null : Math.max(0, Math.min(order.length - 1, from + Math.round(dy / ROW)));

  /* التمريرُ الذاتيّ: إطارٌ كلَّ ١٦ مللي ثانية ما دام الإصبعُ عند الحافّة */
  useEffect(() => {
    if (from === null) return;
    timer.current = setInterval(() => {
      if (!edge.current) return;
      const max = Math.max(0, orderRef.current.length * ROW - bodyH.current);
      const next = Math.max(0, Math.min(max, scrollY.current + edge.current));
      const moved = next - scrollY.current;
      if (!moved) return;
      scrollY.current = next;
      scroll.current?.scrollTo({ y: next, animated: false });
      dyRef.current += moved;
      setDy(dyRef.current);
    }, 16);
    return () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
  }, [from]);

  const finish = () => {
    const f = fromRef.current;
    if (f !== null) {
      const t2 = Math.max(0, Math.min(orderRef.current.length - 1, f + Math.round(dyRef.current / ROW)));
      if (t2 !== f) {
        setOrder((prev) => {
          const next = [...prev];
          const [x] = next.splice(f, 1);
          next.splice(t2, 0, x);
          return next;
        });
      }
    }
    edge.current = 0;
    fromRef.current = null;
    dyRef.current = 0;
    setFrom(null);
    setDy(0);
  };

  /** مستجيبٌ واحدٌ لكلِّ مقبض — يعرف صفَّه من `i` عند الإنشاء */
  const responderFor = (i: number) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        fromRef.current = i;
        dyRef.current = 0;
        startScroll.current = scrollY.current;
        edge.current = 0;
        setFrom(i);
        setDy(0);
      },
      onPanResponderMove: (_e, g) => {
        /* الإزاحةُ = حركةُ الإصبع + ما مرّره الجسدُ ذاتيّاً منذ الإمساك */
        dyRef.current = g.dy + (scrollY.current - startScroll.current);
        setDy(dyRef.current);
        const yInBody = g.moveY - bodyTop.current;
        edge.current = yInBody < EDGE ? -STEP : bodyH.current - yInBody < EDGE ? STEP : 0;
      },
      onPanResponderRelease: finish,
      onPanResponderTerminate: finish,
      onPanResponderTerminationRequest: () => false,
    });
  const shift = (i: number) => {
    if (from === null || to === null) return 0;
    if (i === from) return dy;
    if (from < to && i > from && i <= to) return -ROW;
    if (from > to && i >= to && i < from) return ROW;
    return 0;
  };

  return (
    <Sheet title={t.listReorder} onClose={onClose}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: -14 }}>
        <Text size={12} muted style={{ flex: 1 }}>{t.listReorderHint}</Text>
        <Button label={t.listDone} onPress={() => onDone(order.map((x) => x.key))} style={{ paddingVertical: 8, paddingHorizontal: 14 }} />
      </View>
      <View
        ref={bodyRef}
        onLayout={(e) => {
          bodyH.current = e.nativeEvent.layout.height;
          bodyRef.current?.measureInWindow((_x, y) => {
            bodyTop.current = y;
          });
        }}
        style={{ maxHeight: 460 }}
      >
        <ScrollView
          ref={scroll}
          scrollEnabled={from === null}
          onScroll={(e) => {
            scrollY.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ height: order.length * ROW, paddingHorizontal: 4 }}
        >
          {order.map((it, i) => {
            const dragging = from === i;
            const url = posterUrl(it.poster_path, "w185");
            return (
              <Animated.View
                key={it.key}
                style={{
                  position: "absolute",
                  left: 4,
                  right: 4,
                  top: i * ROW,
                  height: ROW - 8,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingHorizontal: 8,
                  borderRadius: radius.card,
                  backgroundColor: dragging ? tokens.surface2 : "transparent",
                  transform: [{ translateY: shift(i) }, { scale: dragging ? 1.02 : 1 }],
                  zIndex: dragging ? 10 : 0,
                  elevation: dragging ? 12 : 0,
                  shadowColor: "#000",
                  shadowOpacity: dragging ? 0.45 : 0,
                  shadowRadius: 16,
                  shadowOffset: { width: 0, height: 8 },
                }}
              >
                <View style={{ width: 36, height: 54, borderRadius: 6, overflow: "hidden", backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.border, alignItems: "center", justifyContent: "center" }}>
                  {url ? <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Icon name="card" size={14} color={tokens.muted} />}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text size={14} weight="600" numberOfLines={2} style={{ lineHeight: 17 }}>{it.title}</Text>
                  <Text size={12} muted style={{ marginTop: 2, fontVariant: ["tabular-nums"] }}>{String(i + 1)}</Text>
                </View>
                <View
                  {...responderFor(i).panHandlers}
                  accessibilityRole="button"
                  accessibilityLabel={`${it.title} — ${t.listPositionOf(i + 1, order.length)}`}
                  style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: dragging ? tokens.surface : "transparent" }}
                >
                  <Icon name="grip" size={18} color={dragging ? tokens.accent : tokens.muted} />
                </View>
              </Animated.View>
            );
          })}
        </ScrollView>
      </View>
    </Sheet>
  );
}
