import React from "react";
import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import Svg, { Circle, Defs, Line, RadialGradient, Stop } from "react-native-svg";
import { useApp } from "../state";
import { Icon } from "../icons";
import { Text } from "../ui";
import { radius } from "../theme";
import { DeviceLabel, DeviceMark } from "./DeviceMark";
import { deviceName } from "./api";
import type { DeviceKind, DeviceLinksState } from "@/core/contracts/deviceLinks";

const MARK = require("../../assets/loopz-mark.png");

/**
 * 🆕 **المدار** (خطّةُ Loopz+ v2 — «مدارٌ أصغر (~٨٠٪) مع العدّاد»، التصميمُ المعتمد «الربط اليوم»).
 * الشعارُ في القلب، وخمسُ خاناتٍ حوله باتّجاه الساعة من الأعلى: المربوطُ (بخطٍّ إلى القلب) ثمّ الفارغُ «+» ثمّ المقفلُ «PLUS»
 * للمجانيّ. والذهبيُّ (المرحلة ١) يكبر بخانةٍ فارغةٍ واحدة حتى ثماني.
 * ⚖️ **الأرقامُ أرقامُ التصميم مضروبةً في ٠٫٧٨**: نصفُ القطر ٩٢، والشارةُ ٤٦، والارتفاعُ ٢٥٢.
 */
export const ORBIT_H = 252;
const R = 92;
const TILE = 46;
const HUB = 64;

export type Slot =
  | { type: "device"; kind: DeviceKind; paused: boolean }
  | { type: "empty" }
  | { type: "locked" };

/** الخاناتُ بالترتيب — المربوطُ بترتيب «من أجهزتك» الثابت، ثمّ ما بقي */
export function slotsOf(d: DeviceLinksState): Slot[] {
  const linked: Slot[] = d.devices.filter((x) => x.linked && !x.stopped).map((x) => ({ type: "device", kind: x.kind, paused: false }));
  const limit = d.limit ?? Math.min(8, Math.max(5, d.used + 1));
  const total = d.limit == null ? limit : 5;
  const out: Slot[] = [...linked];
  /* الرابطُ القديمُ قبل أوّل إرسال: خانةٌ محسوبةٌ بلا جهازٍ معروف — تُرسم فارغةً مشغولة لا «+» */
  const pending = d.pending_legacy && !d.pending_legacy.stopped ? 1 : 0;
  while (out.length < total) {
    const filled = out.length + pending;
    out.push(filled < limit ? { type: "empty" } : { type: "locked" });
  }
  return out.slice(0, total);
}

export function Orbit({
  d,
  width,
  onSlot,
  onHold,
  hot,
}: {
  d: DeviceLinksState;
  width: number;
  /** ضغطُ خانة: جهازٌ ⇐ صفحتُه · فارغةٌ ⇐ أوّلُ ما لم يُربط · مقفلةٌ ⇐ «اربط أجهزتك» */
  onSlot: (slot: Slot) => void;
  /** الضغطُ المطوَّل على جهازٍ مربوط — «افتح صفحته · فك الربط» */
  onHold: (kind: DeviceKind) => void;
  /** جهازٌ يُسحب فوق المدار الآن — الحلقةُ تتوهّج */
  hot?: boolean;
}) {
  const { t, tokens } = useApp();
  const slots = slotsOf(d);
  const cx = width / 2;
  const cy = R + TILE / 2 + 4;
  const pos = slots.map((_, i) => {
    const a = (i / slots.length) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  });
  const limit = d.limit ?? 0;
  return (
    <View accessible={false} style={{ height: ORBIT_H, width }}>
      <Svg width={width} height={ORBIT_H} style={{ position: "absolute" }}>
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={tokens.accent} stopOpacity={hot ? 0.22 : 0.12} />
            <Stop offset="1" stopColor={tokens.accent} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={cx} cy={cy} r={R + 30} fill="url(#glow)" />
        <Circle cx={cx} cy={cy} r={R} fill="none" stroke={hot ? tokens.accent : tokens.border} strokeOpacity={hot ? 0.7 : 1} />
        <Circle cx={cx} cy={cy} r={HUB / 2 + 12} fill="none" stroke={tokens.accent} strokeOpacity={0.25} />
        {slots.map((s, i) =>
          s.type === "device" ? (
            <Line key={i} x1={cx} y1={cy} x2={pos[i].x} y2={pos[i].y} stroke={tokens.accent} strokeOpacity={0.7} strokeWidth={1.5} />
          ) : null,
        )}
      </Svg>
      <View style={{ position: "absolute", left: cx - HUB / 2, top: cy - HUB / 2, width: HUB, height: HUB, borderRadius: HUB / 2, borderWidth: 1.5, borderColor: tokens.accent, backgroundColor: tokens.bg, alignItems: "center", justifyContent: "center" }}>
        <Image source={MARK} style={{ width: HUB * 0.62, height: HUB * 0.62 }} contentFit="contain" />
      </View>
      {slots.map((s, i) => {
        const left = pos[i].x - TILE / 2;
        const top = pos[i].y - TILE / 2;
        if (s.type === "device") {
          const name = deviceName(s.kind);
          return (
            <Pressable
              key={`d-${s.kind}`}
              onPress={() => onSlot(s)}
              onLongPress={() => onHold(s.kind)}
              delayLongPress={350}
              accessibilityRole="button"
              accessibilityLabel={`${name}، ${t.stremioLinked}`}
              accessibilityActions={[{ name: "menu", label: t.linksUnlink }]}
              onAccessibilityAction={(e) => e.nativeEvent.actionName === "menu" && onHold(s.kind)}
              style={{ position: "absolute", left, top, width: TILE, alignItems: "center" }}
            >
              <DeviceMark kind={s.kind} size={TILE} state="on" />
              <DeviceLabel name={name} />
            </Pressable>
          );
        }
        const locked = s.type === "locked";
        return (
          <Pressable
            key={`s-${i}`}
            onPress={() => onSlot(s)}
            accessibilityRole="button"
            accessibilityLabel={locked ? t.linksPlusSlot : t.linksEmptySlot}
            style={{ position: "absolute", left, top, width: TILE, alignItems: "center" }}
          >
            <View
              style={{
                width: TILE,
                height: TILE,
                borderRadius: radius.md,
                borderWidth: 1,
                borderStyle: "dashed",
                borderColor: locked ? tokens.border : tokens.accent,
                backgroundColor: locked ? tokens.surface : tokens.accent + "14",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
              }}
            >
              {locked ? (
                <>
                  <Icon name="lock" size={12} color={tokens.muted} />
                  <View style={{ borderRadius: 4, backgroundColor: tokens.accent, paddingHorizontal: 4 }}>
                    <Text size={8} weight="800" color={tokens.onAccent}>PLUS</Text>
                  </View>
                </>
              ) : (
                <Icon name="plus" size={18} color={tokens.accent} />
              )}
            </View>
            <Text size={11} weight="600" muted numberOfLines={1} style={{ marginTop: 6 }}>
              {locked ? t.linksPlusSlot : t.linksEmptySlot}
            </Text>
          </Pressable>
        );
      })}
      <View accessible accessibilityLabel={t.linksOrbitLabel(d.used, limit || d.used)} style={{ position: "absolute", left: 0, right: 0, top: 0, height: 1 }} />
    </View>
  );
}

/** العدّادُ تحت المدار: «١ من ١ · مع بلس ٥» · «٢ من ٥ في مدارك» */
export function OrbitCounter({ d }: { d: DeviceLinksState }) {
  const { t, tokens } = useApp();
  const label = d.limit == null ? t.linksCounterGold(d.used) : d.tier === "free" ? t.linksCounterFree(d.used) : t.linksCounterPlus(d.used, d.limit);
  return (
    <View style={{ alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, paddingHorizontal: 14, paddingVertical: 7 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: d.used > 0 ? tokens.success : tokens.muted }} />
      <Text size={13} weight="700">{label}</Text>
    </View>
  );
}
