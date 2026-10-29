import React from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { useApp } from "../state";
import { Text } from "../ui";
import { radius } from "../theme";
import { type WidgetLayoutConfig, type WidgetPlatform, type WidgetSectionKey, type WidgetSize } from "@/core/widgetLayout";
import type { WidgetLook } from "@/core/widgetLook";
import { defaultV3 } from "@/core/widgetSlots";
import { defaultV4Look, layoutV4, smallV4, type V4Tile, type WidgetV4Draw, type WidgetV4Look } from "@/core/widgetTiles";
import type { WidgetFeed } from "@/core/contracts/widget";
import { backdropUrl, posterUrl } from "@/core/media";
import { writtenFeed } from "../widget/feed";

/**
 * ====== معاينةُ ودجت لوبز — ما سيرسمه الودجتُ بالضبط ======
 *
 * 🔑 **لا حسابَ هنا** (🆕 v4 — «المعمل»، ٣٠ أكتوبر): المواضعُ من `layoutV4` — المحرّكُ نفسُه الذي يكتب للودجت — وأرقامُ الرسم
 * نفسُها (`look4`)، والصورُ والأسماءُ من الخلاصة المكتوبة للودجت (`writtenFeed`). فما يُرى هنا ما يُرسم على الشاشة: الأشكالُ
 * والمطُّ والقصُّ والعنوانُ داخل الصورة. والمقاسُ مقاسُ الودجت الحقيقيُّ حين يُعرف (`designH`)، وإلّا مقاسُ الحجم المعتمد.
 */
const BLACK = "#050505";
const SURFACE = "#111111";
const ACCENT = "#FFD400";
const SUCCESS = "#22C55E";

/** مقاساتُ لوحات المعمل بنقاط التصميم — أندرويد ٣٣٥ عرضاً (جوال خالد ×١٫٣٠)، والآيفون ٣٦٤ (Pro Max) */
const DESIGN: Record<WidgetPlatform, Record<WidgetSize, [number, number]>> = {
  android: { small: [160, 231], medium: [335, 178], large: [335, 372], xl: [335, 568] },
  ios: { small: [170, 170], medium: [364, 170], large: [364, 382], xl: [364, 594] },
};

/** عنصرٌ في البطاقة كما يرسمه الودجت */
interface Item {
  poster: string | null;
  backdrop: string | null;
  name: string;
  line: string;
  avatar: string | null;
  bar?: number;
  btn?: string;
  faded?: boolean;
  line2?: string | null;
}

const art = (p: string | null | undefined) => (p ? posterUrl(p, "w342") : null);
const wide = (p: string | null | undefined) => (p ? backdropUrl(p, "w780") : null);

/** عناصرُ القسم — المصادرُ نفسُها التي يقرؤها الرسّامان (`items4` في Kotlin و`Items4` في Swift) */
function itemsOf(feed: WidgetFeed | null, key: WidgetSectionKey): Item[] {
  if (!feed) return [];
  const v2 = feed.v2;
  switch (key) {
    case "cont":
      return feed.continue.items.map((c) => ({ poster: art(c.poster_path), backdrop: wide(c.backdrop_path), name: c.title, line: c.sub ?? c.label ?? "", avatar: null, bar: c.pct, btn: "✓" }));
    case "tonight":
      return feed.tonight.map((m) => ({ poster: art(m.poster_path), backdrop: wide(m.backdrop_path), name: m.title, line: [m.rating ? `★ ${m.rating.toFixed(1)}` : null].filter(Boolean).join(" · "), avatar: null, btn: "✓" }));
    case "cine":
      return (v2?.cinema ?? []).map((x) => ({ poster: art(x.poster_path), backdrop: wide(x.backdrop_path), name: x.title, line: [x.rating ? `★ ${x.rating.toFixed(1)}` : null, x.genre].filter(Boolean).join(" · "), avatar: null, btn: x.followed ? "✓" : "+" }));
    case "tw":
      return (v2?.towatch ?? []).map((x) => ({ poster: art(x.poster_path), backdrop: null, name: x.title, line: x.type_label, avatar: null, btn: x.action === "watched" ? "✓" : "▶" }));
    case "up":
      return (v2?.upcoming.items ?? []).map((u) => ({ poster: art(u.poster_path), backdrop: null, name: u.title, line: [u.date, u.label].filter(Boolean).join(" · "), avatar: null, line2: u.label }));
    case "friends":
      return (v2?.friends ?? []).map((x) => ({ poster: art(x.title.poster_path), backdrop: null, name: x.name, line: x.line ?? `${x.action} ${x.title.title}`, avatar: x.avatar_url }));
    case "act":
      return (v2?.activity ?? []).map((x) => ({ poster: art(x.title.poster_path), backdrop: null, name: x.title.title, line: [x.line, x.sub].filter(Boolean).join(" · "), avatar: null }));
    default:
      return [];
  }
}

export function WidgetPreview({
  config,
  size,
  names,
  platform,
  maxHeight = 300,
  thumb = false,
  empty = [],
  designH,
}: {
  config: WidgetLayoutConfig;
  size: WidgetSize;
  names: Record<WidgetSectionKey, string>;
  platform: WidgetPlatform;
  maxHeight?: number;
  thumb?: boolean;
  /** أقسامٌ لا محتوى لها الآن — تُحسم كما يحسمها الودجت (تختفي) ويقولها سطرُ المعاينة */
  empty?: readonly WidgetSectionKey[];
  /** شكلُ الودجت القديم — لا يُقرأ في v4 ويبقى لمن يمرّره */
  look?: WidgetLook | null;
  /** 🆕 v4 — ارتفاعُ الودجت الحقيقيُّ بنقاط التصميم (ودجتُ أندرويد على الشاشة)، وإلّا مقاسُ الحجم المعتمد */
  designH?: number;
}) {
  const { t, tokens } = useApp();
  const feed = React.useMemo(() => writtenFeed(), []);
  const l4: WidgetV4Look = React.useMemo(() => {
    const raw = (feed as unknown as { w2?: { look4?: WidgetV4Look } } | null)?.w2?.look4;
    return raw ?? defaultV4Look();
  }, [feed]);
  const nums = l4[platform].nums;
  const draw = l4[platform].draw;
  const v3 = config.v3 ?? defaultV3();
  const gone = new Set<WidgetSectionKey>(empty.filter((k) => k !== "cont" && k !== "search"));
  const small = size === "small";
  const [, H0] = DESIGN[platform][size];
  /* العرضُ من أرقام المحرّك نفسِها (الخادمُ قد يغيّرها) — فالمعاينةُ تتبع الودجت */
  const W = small ? nums.smallW : nums.designW;
  const H = !small && designH && designH > 120 ? designH : H0;
  const scale = Math.min(1, maxHeight / H, (thumb ? 84 : 320) / W);
  const rtl = feed?.dir === "rtl";

  const cache = new Map<WidgetSectionKey, Item[]>();
  const get = (k: WidgetSectionKey) => {
    let v = cache.get(k);
    if (!v) {
      v = itemsOf(feed, k);
      cache.set(k, v);
    }
    return v;
  };

  let tiles: V4Tile[] = [];
  let note = "";
  if (small) {
    const sm = smallV4(v3);
    tiles = [{ k: "card", x: 0, y: 0, w: W, h: H, s: sm.s, i: 0, img: "p", lab: 1, ...(sm.cyc ? { cyc: 1 } : {}), bt: "b", ...(sm.s === "cont" ? { bar: 1 as const } : {}) }];
  } else {
    const l = layoutV4(v3, platform, W, H, gone, nums);
    tiles = l.tiles;
    note = l.dropped.length ? t.widgetDoesntFit(l.dropped.map((ks) => ks.map((k) => names[k]).join(" + ")).join("، ")) : t.widgetAllFit;
  }
  if (gone.size) note = [note, t.widgetEmptyNow([...gone].map((k) => names[k]).join("، "))].filter(Boolean).join("\n");

  const frame = (
    <View style={{ width: W * scale, height: H * scale, overflow: "hidden", borderRadius: (thumb ? 10 : 22) * scale }}>
      <View style={{ width: W, height: H, transform: [{ scale }], transformOrigin: "top left", backgroundColor: BLACK, overflow: "hidden", direction: "ltr" }}>
        {tiles.map((tl, n) => {
          const x = rtl ? W - tl.x - tl.w : tl.x;
          if (tl.k === "hair") return <View key={n} style={{ position: "absolute", left: x, top: tl.y, width: Math.max(1, tl.w), height: Math.max(1, tl.h), backgroundColor: "rgba(255,255,255,0.13)" }} />;
          if (tl.k === "card") {
            const list = get(tl.s);
            /* لا بوسترَ مكرّر: ما زاد على ما في القسم خانةٌ داكنة — كالرسّامَين */
            const it = tl.i < list.length ? list[tl.i] : tl.s === "cont" && tl.i === 0 && !list.length ? { poster: null, backdrop: null, name: `+  ${names.cont}`, line: "", avatar: null } : null;
            return (
              <Card key={n} it={it} x={x} y={tl.y} w={tl.w} h={tl.h} label={tl.lab ? names[tl.s] : null} cyc={!!tl.cyc} topBtn={tl.bt === "t"} bar={!!tl.bar} wide={tl.img === "b"} small={small} rtl={rtl} d={draw} zoom={small ? draw.smallZoom : 0} />
            );
          }
          const list = get(tl.s);
          const it = list[0] ?? null;
          return <UpRow key={n} it={it} x={x} y={tl.y} w={tl.w} h={tl.h} head={tl.s === "friends" ? names.friends : names.up} slim={tl.k === "slim"} friends={tl.s === "friends"} more={tl.s === "up" && list.length > 1 ? list.length - 1 : 0} rtl={rtl} d={draw} />;
        })}
      </View>
    </View>
  );
  if (thumb) return frame;
  return (
    <View style={{ borderRadius: radius.card, backgroundColor: tokens.surface2, alignItems: "center", paddingVertical: 10, gap: 6 }}>
      {frame}
      {note ? <Text size={11} muted style={{ textAlign: "center", paddingHorizontal: 12 }}>{note}</Text> : null}
    </View>
  );
}

/** الصورةُ تغطّي مربّعها — المطُّ حتّى `lim` ثمّ القصُّ (`cropTop` من فوق) — والرياضةُ نفسُها في الرسّامَين */
function Fit({ uri, w, h, d, zoom, faded, ratio }: { uri: string | null; w: number; h: number; d: WidgetV4Draw; zoom: number; faded?: boolean; ratio: number }) {
  if (!uri) return null;
  const b = w / h;
  const s = Math.min(Math.max(b, ratio / (1 + d.lim)), ratio * (1 + d.lim));
  let iw: number;
  let ih: number;
  let l = 0;
  if (b >= s) {
    iw = w;
    ih = w / s;
  } else {
    ih = h;
    iw = h * s;
    l = -(iw - w) / 2;
  }
  if (zoom > 0) ih = Math.max(h, ih * (1 - zoom));
  const top = -(ih - h) * d.cropTop;
  return <Image source={{ uri }} contentFit="fill" style={{ position: "absolute", left: l, top, width: iw, height: ih, opacity: faded ? 0.55 : 1 }} />;
}

function Circle({ glyph, size, style }: { glyph: string; size: number; style: object }) {
  return (
    <View style={[{ position: "absolute", width: size, height: size, borderRadius: size / 2, backgroundColor: "rgba(0,0,0,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)", alignItems: "center", justifyContent: "center" }, style]}>
      <Text size={size * 0.46} weight="700" color={glyph === "↶" ? SUCCESS : "#FFFFFF"} style={{ lineHeight: size * 0.6 }}>{glyph}</Text>
    </View>
  );
}

function Card(p: { it: Item | null; x: number; y: number; w: number; h: number; label: string | null; cyc: boolean; topBtn: boolean; bar: boolean; wide: boolean; small: boolean; rtl: boolean; d: WidgetV4Draw; zoom: number }) {
  const { it, x, y, w, h, d, small, rtl } = p;
  const cd = small ? d.circleSmall : d.circle;
  const pad = small ? d.textPadSmall : d.textPad;
  const start = rtl ? "right" : "left";
  const end = rtl ? "left" : "right";
  const bottomBtn = !p.topBtn && !!it?.btn;
  const uri = it ? (p.wide ? it.backdrop ?? it.poster : it.poster) : null;
  return (
    <View style={{ position: "absolute", left: x, top: y, width: w, height: h, borderRadius: small ? 0 : d.radius, overflow: "hidden", backgroundColor: SURFACE }}>
      {it ? (
        <>
          <Fit uri={uri} w={w} h={h} d={d} zoom={p.zoom} faded={it.faded} ratio={p.wide && it.backdrop ? 16 / 9 : 2 / 3} />
          <View style={{ position: "absolute", inset: 0, experimental_backgroundImage: "linear-gradient(rgba(0,0,0,0.55), transparent 28%, transparent 50%, rgba(0,0,0,0.92))" }} />
          {p.label ? (
            <Text size={small ? d.labelSmall : d.label} weight="700" color={ACCENT} numberOfLines={1}
              style={{ position: "absolute", top: small ? 9 : 7, [start]: pad, [end]: p.cyc || p.topBtn ? cd + 10 : pad, textAlign: rtl ? "right" : "left", textShadowColor: "#000", textShadowRadius: 3 }}>
              {p.label}
            </Text>
          ) : null}
          {p.cyc ? <Circle glyph="↻" size={cd} style={{ top: 4, [end]: 4 }} /> : p.topBtn && it.btn ? <Circle glyph={it.btn} size={cd} style={{ top: 4, [end]: 4 }} /> : null}
          {bottomBtn && it.btn ? <Circle glyph={it.btn} size={cd} style={{ bottom: small ? 7 : 4, [end]: small ? 7 : 4 }} /> : null}
          <View style={{ position: "absolute", [start]: pad, [end]: bottomBtn ? cd + (small ? 14 : 10) : pad, bottom: small ? d.textBottomSmall : d.textBottom, gap: 1, alignItems: rtl ? "flex-end" : "flex-start" }}>
            <View style={{ flexDirection: rtl ? "row-reverse" : "row", alignItems: "center", gap: 4, maxWidth: "100%" }}>
              {it.avatar ? <Image source={{ uri: it.avatar }} style={{ width: small ? d.avatarSmall : d.avatar, height: small ? d.avatarSmall : d.avatar, borderRadius: 999 }} /> : null}
              <Text size={small ? d.nameSmall : w > 120 ? d.nameBig : d.name} weight="700" color={it.faded ? "rgba(247,247,247,0.55)" : "#FFFFFF"} numberOfLines={1} style={{ flexShrink: 1 }}>{it.name}</Text>
            </View>
            {it.line ? <Text size={small ? d.lineSmall : d.line} color={it.faded ? ACCENT : "#DDDDDD"} numberOfLines={1}>{it.line}</Text> : null}
          </View>
          {p.bar && it.bar != null ? (
            <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: d.bar, backgroundColor: "rgba(255,255,255,0.15)", flexDirection: rtl ? "row-reverse" : "row" }}>
              <View style={{ width: `${Math.max(0, Math.min(100, it.bar))}%`, backgroundColor: it.bar >= 99 ? SUCCESS : ACCENT }} />
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function UpRow(p: { it: Item | null; x: number; y: number; w: number; h: number; head: string; slim: boolean; friends: boolean; more: number; rtl: boolean; d: WidgetV4Draw }) {
  const { it, d, rtl } = p;
  const second = !it ? "" : p.friends ? [it.name, it.line].filter(Boolean).join(" · ") : [it.name, it.line2].filter(Boolean).join(" · ");
  const dir = rtl ? "row-reverse" : "row";
  if (p.slim) {
    return (
      <View style={{ position: "absolute", left: p.x, top: p.y, width: p.w, height: p.h, flexDirection: dir, alignItems: "center", gap: 6, overflow: "hidden" }}>
        <Text size={d.slimFont} weight="700" color={ACCENT} numberOfLines={1}>{p.head}</Text>
        {p.friends && it?.avatar ? <Image source={{ uri: it.avatar }} style={{ width: d.slimAvatar, height: d.slimAvatar, borderRadius: 999 }} /> : null}
        <Text size={d.slimFont} color="#F7F7F7" numberOfLines={1} style={{ flexShrink: 1 }}>{second}</Text>
      </View>
    );
  }
  return (
    <View style={{ position: "absolute", left: p.x, top: p.y, width: p.w, height: p.h, flexDirection: dir, alignItems: "center", gap: 9 }}>
      <View style={{ width: d.upThumbW, height: d.upThumbH, borderRadius: 4, overflow: "hidden", backgroundColor: SURFACE }}>
        {it?.poster ? <Image source={{ uri: it.poster }} contentFit="cover" style={{ width: d.upThumbW, height: d.upThumbH }} /> : null}
      </View>
      <View style={{ flex: 1, alignItems: rtl ? "flex-end" : "flex-start" }}>
        <Text size={d.upTitle} weight="700" color={ACCENT} numberOfLines={1}>{p.head}</Text>
        <View style={{ flexDirection: dir, alignItems: "center", gap: 4 }}>
          {p.friends && it?.avatar ? <Image source={{ uri: it.avatar }} style={{ width: d.avatar, height: d.avatar, borderRadius: 999 }} /> : null}
          <Text size={d.upName} color="#F7F7F7" numberOfLines={1} style={{ flexShrink: 1 }}>{second}</Text>
        </View>
      </View>
      {p.more ? <Text size={d.upTail} color="#9C9C9C">{rtl ? `← +${p.more}` : `+${p.more} →`}</Text> : null}
    </View>
  );
}
