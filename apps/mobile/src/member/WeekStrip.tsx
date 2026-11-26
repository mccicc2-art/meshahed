import React, { useMemo } from "react";
import { I18nManager, Pressable, View } from "react-native";
import { Image } from "expo-image";
import Svg, { ClipPath, Defs, Image as SvgImage, Line, Polygon } from "react-native-svg";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon } from "../icons";
import { haptic } from "../haptics";
import { dayKey, shiftDay, weekRange, weekStartKey, type ActivityItem } from "@/core/activityDays";

/**
 * ====== 🆕 شريطُ الأسبوع في السجلّ (أحمد ٢٦ نوفمبر، استوديو المشاركة «ت٢ ب» و«ق٢أ» و«س٥أ») ======
 *
 * سبعةُ أيّامٍ من الأحد إلى السبت، تحت كلِّ يومٍ ما شوهد فيه ملصقاً: عملٌ واحدٌ ملصقُه كاملاً، **وعملان ملصقٌ مقسومٌ بخطٍّ مائل**،
 * وثلاثةٌ فأكثر الأوّلُ و«+العدد» (جوابُ سؤاله «لو فيه عملين في نفس اليوم كيف بتظهر؟»). **والضغطُ على يومٍ يصفّي القائمةَ تحته**
 * إلى أعماله، و«كلّ الأسبوع» يعيدها. **بلا سطر أعدادٍ ولا زرّ «شارك» تحته** («العبارة الي تحت الأسبوع احذفها … وشارك ما يحتاج
 * لأن فيه زر مشاركة بالأعلى»). يظهر في «مشاهدة» و«الكلّ» وحدَهما («س٥أ»).
 */
const AR_DAYS = ["أحد", "اثن", "ثلا", "أرب", "خمي", "جمع", "سبت"];
const EN_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CELL_GAP = 6;

type DayPosters = { key: string; posters: (string | null)[]; count: number };

export function WeekStrip({
  items,
  index,
  onIndex,
  maxIndex,
  selected,
  onSelect,
}: {
  /** صفوفُ المشاهدة وحدَها */
  items: ActivityItem[];
  /** ٠ هذا الأسبوع، ١ الماضي… */
  index: number;
  onIndex: (i: number) => void;
  /** أقدمُ أسبوعٍ فيه مشاهدة — لا سهمَ إلى فراغ */
  maxIndex: number;
  selected: string | null;
  onSelect: (key: string | null) => void;
}) {
  const { t, tokens, locale } = useApp();
  const today = dayKey(new Date().toISOString(), true);
  const start = shiftDay(weekStartKey(today), -7 * index);
  const days: DayPosters[] = useMemo(() => {
    const out: DayPosters[] = Array.from({ length: 7 }, (_, i) => ({ key: shiftDay(start, i), posters: [], count: 0 }));
    const seen = new Map<string, Set<string>>();
    /* الأحدثُ أوّلاً كما في القائمة — فأوّلُ ملصقٍ آخرُ ما شوهد في اليوم */
    for (const it of items) {
      const k = dayKey(it.at, true);
      const day = out.find((d) => d.key === k);
      if (!day) continue;
      const set = seen.get(k) ?? new Set<string>();
      const id = `${it.mediaType}-${it.tmdbId}`;
      if (set.has(id)) continue;
      set.add(id);
      seen.set(k, set);
      day.posters.push(it.poster);
      day.count += 1;
    }
    return out;
  }, [items, start]);

  const names = locale === "en" ? EN_DAYS : AR_DAYS;
  /* السهمان: «أقدم» نحو بداية السطر و«أحدث» نحو نهايته — والأيقونةُ تدور مع الاتّجاه */
  const arrow = (older: boolean) => {
    const on = older ? index < maxIndex : index > 0;
    const deg = (older ? 90 : -90) * (I18nManager.isRTL ? -1 : 1);
    return (
      <Pressable
        key={older ? "older" : "newer"}
        disabled={!on}
        onPress={() => {
          haptic.pick();
          onSelect(null);
          onIndex(older ? index + 1 : index - 1);
        }}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={older ? t.weekOlder : t.weekNewer}
        style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center", opacity: on ? 1 : 0.25 }}
      >
        <View style={{ transform: [{ rotate: `${deg}deg` }] }}>
          <Icon name="chevron-down" size={18} color={tokens.fg} />
        </View>
      </Pressable>
    );
  };

  return (
    <View style={{ marginTop: 14, gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text size={17} weight="800">{weekRange(today, index, locale)}</Text>
        <View style={{ flexDirection: "row" }}>
          {arrow(true)}
          {arrow(false)}
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: CELL_GAP }}>
        {days.map((d, i) => {
          const isToday = d.key === today;
          const isSel = selected === d.key;
          const dim = !!selected && !isSel;
          return (
            <Pressable
              key={d.key}
              disabled={!d.count}
              onPress={() => {
                haptic.pick();
                onSelect(isSel ? null : d.key);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: isSel }}
              accessibilityLabel={`${names[i]} ${Number(d.key.slice(8))}`}
              style={{ flex: 1, alignItems: "center", gap: 4, opacity: dim ? 0.4 : 1 }}
            >
              <Text size={11} muted>{names[i]}</Text>
              <Text size={14} weight="700" color={isToday ? tokens.accent : tokens.fg} style={{ fontVariant: ["tabular-nums"] }}>
                {String(Number(d.key.slice(8)))}
              </Text>
              <DayCell posters={d.posters} count={d.count} selected={isSel} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** خانةُ اليوم: فارغةٌ · ملصق · ملصقان بخطٍّ مائل · الأوّلُ و«+العدد» */
function DayCell({ posters, count, selected }: { posters: (string | null)[]; count: number; selected: boolean }) {
  const { tokens } = useApp();
  const [w, setW] = React.useState(0);
  const h = w * 1.5;
  const border = selected ? tokens.accent : tokens.border;
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={{ alignSelf: "stretch", aspectRatio: 2 / 3, borderRadius: 8, overflow: "hidden", backgroundColor: tokens.surface, borderWidth: selected ? 2 : 1, borderColor: border }}
    >
      {count === 2 && w ? (
        <Svg width={w} height={h}>
          <Defs>
            <ClipPath id="a">
              <Polygon points={`0,0 ${w},0 0,${h}`} />
            </ClipPath>
            <ClipPath id="b">
              <Polygon points={`${w},0 ${w},${h} 0,${h}`} />
            </ClipPath>
          </Defs>
          {posters[0] ? <SvgImage href={{ uri: posters[0] }} width={w} height={h} preserveAspectRatio="xMidYMid slice" clipPath="url(#a)" /> : null}
          {posters[1] ? <SvgImage href={{ uri: posters[1] }} width={w} height={h} preserveAspectRatio="xMidYMid slice" clipPath="url(#b)" /> : null}
          <Line x1={w} y1={0} x2={0} y2={h} stroke={tokens.bg} strokeWidth={2} />
        </Svg>
      ) : count >= 1 && posters[0] ? (
        <Image source={{ uri: posters[0] }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" />
      ) : null}
      {count >= 3 ? (
        <View style={{ position: "absolute", bottom: 4, alignSelf: "center", borderRadius: 999, backgroundColor: tokens.accent, paddingHorizontal: 6 }}>
          <Text size={10} weight="700" color={tokens.onAccent} style={{ writingDirection: "ltr" }}>{`+${count - 1}`}</Text>
        </View>
      ) : null}
    </View>
  );
}
