import React from "react";
import { View } from "react-native";
import { useApp } from "../state";
import { Text } from "../ui";
import { radius } from "../theme";
import {
  resolveWidgetLayout,
  smallWidgetSection,
  smallWidgetForm,
  WIDGET_HEIGHTS,
  widgetSizeHeight,
  type WidgetLayoutConfig,
  type WidgetPlatform,
  type WidgetRow,
  type WidgetSectionKey,
  type WidgetSize,
} from "@/core/widgetLayout";
import { lookFor, type WidgetLook, type WidgetLookSize } from "@/core/widgetLook";
import { V3_HEIGHTS } from "@/core/widgetSlots";
import { ANDROID_RESIZE } from "../widget/feed";

/**
 * ====== معاينةُ ودجت لوبز — ما سيرسمه الودجتُ بالضبط ======
 *
 * 🔑 **لا حسابَ هنا**: الصفوفُ وارتفاعاتُها من `resolveWidgetLayout` و`WIDGET_HEIGHTS` — المحرّكُ نفسُه الذي
 * يكتب للودجت. معاينةٌ تحسب وحدَها تكذب عند أوّل تعديل (W39: «الودجتُ يملأ نفسه» وعدٌ بالبكسل).
 * والمحتوى أشكالٌ رماديّة لا بياناتٌ: المعاينةُ تُجيب «أين وكم»، وما سيُعرض يعرفه صاحبُه.
 */
const BLACK = "#050505";
const GHOST = "#1c1c1c";
const LINE = "#1a1a1a";
/* 🆕 D-1571 — عرضُ التصميم المرجعيّ (٤×٢ = ٣٣٥؛ الصغيرُ ١٦٠) — الودجتُ يكبّر كلَّ شيءٍ بنسبة عرضه إليه، فالمعاينةُ بالمرجع تطابقه */
const WIDTH: Record<WidgetSize, number> = { small: 160, medium: 335, large: 335, xl: 335 };

export function WidgetPreview({
  config: given,
  size,
  names,
  platform,
  maxHeight = 300,
  thumb = false,
  empty = [],
  look,
}: {
  config: WidgetLayoutConfig;
  size: WidgetSize;
  names: Record<WidgetSectionKey, string>;
  platform: WidgetPlatform;
  maxHeight?: number;
  thumb?: boolean;
  /** 🆕 أقسامٌ ظاهرةٌ في الإعداد لا محتوى لها الآن — تُحسم كما يحسمها الودجت (تختفي) ويقولها سطرُ المعاينة */
  empty?: readonly WidgetSectionKey[];
  /** 🆕 شكلُ الودجت من الخلاصة — المحرّكُ يحسم به هنا كما في الودجت */
  look?: WidgetLook | null;
}) {
  /*
   * 🆕 D-1561 — في الخانات (v3) إظهارُ الإعداد القديم (`on`) لم يعد خياراً: كلُّ قسمٍ «ظاهر» إلّا الفارغ الآن — كما يحسمه
   * `resolveWidget` للودجت. كانت المعاينةُ تقرأ `on.up: false` من الإعداد القديم فتُسقط «القادم» من نصّه وتجعل أخاه كاملاً،
   * والودجتُ نفسُه يرسمهما (خالد ٢:٣٦ «حطيت قسمين وما جاء إلا واحد»).
   */
  const baseOn: WidgetLayoutConfig["on"] = given.v3 ? (Object.fromEntries(Object.keys(given.on).map((k) => [k, true])) as WidgetLayoutConfig["on"]) : given.on;
  const gone = empty.filter((k) => k !== "cont" && k !== "search" && baseOn[k]);
  const config: WidgetLayoutConfig = { ...given, on: { ...baseOn, ...Object.fromEntries(gone.map((k) => [k, false])) } };
  const { t, tokens } = useApp();
  /* مقاسُ المنصّة نفسُه الذي يُحسم به الودجت (`widgetSizeHeight`) — الآيفونُ أقصر */
  const H = widgetSizeHeight(platform, size);
  const W = WIDTH[size];
  /* 🆕 W40 — `thumb`: صورةٌ مصغّرةٌ للودجت في «على شاشتك الآن» (عرضٌ ٨٤ بلا إطارٍ ولا سطرِ «يتّسع») */
  const scale = Math.min(1, maxHeight / H, (thumb ? 84 : 320) / W);

  let body: React.ReactNode;
  let note = "";
  if (size === "small") {
    const key = smallWidgetSection(config);
    /* الصغيرُ في أغلب الأجهزة طوليّ — والمعاينةُ ترسمه بأبعاد التصميم المعتمد (W43) */
    const form = platform === "ios" ? smallWidgetForm(config, key, 170, 170) : smallWidgetForm(config, key, 160, 178);
    body = <SmallTile name={names[key]} form={form} />;
  } else {
    const l = resolveWidgetLayout(config, size, H, platform, { look, resize: platform === "ios" || ANDROID_RESIZE });
    const lk = lookFor(look, platform, size);
    /* 🆕 D-1571 — الفاصلُ ٩ بخطّ، والباقي من الارتفاع فوق الودجت وتحته لا بين القوائم (خالد ١٤:٢٤) — كالرسّامَين */
    body = (
      <View style={{ flex: 1, justifyContent: "center" }}>
        {l.rows.map((r, i) => (
          <View key={i}>
            {i ? <View style={{ height: 1, backgroundColor: LINE, marginVertical: (V3_HEIGHTS.gap - 1) / 2 }} /> : null}
            <PreviewRow row={r} names={names} look={lk} />
          </View>
        ))}
      </View>
    );
    note = l.hidden.length ? t.widgetDoesntFit(l.hidden.map((k) => names[k]).join("، ")) : t.widgetAllFit;
    if (gone.length) note = `${note}\n${t.widgetEmptyNow(gone.map((k) => names[k]).join("، "))}`;
  }
  /* الصغيرُ في أندرويد طوليٌّ (W43)، وفي الآيفون مربّع */
  const h = size === "small" ? (platform === "ios" ? 170 : 178) : H;

  const frame = (
    <View style={{ width: W * scale, height: h * scale, overflow: "hidden", borderRadius: thumb ? 10 : 0 }}>
      <View style={{ width: W, height: h, transform: [{ scale }], transformOrigin: "top left", borderRadius: 22, backgroundColor: BLACK, padding: size === "small" ? 0 : V3_HEIGHTS.pad / 2, overflow: "hidden" }}>
        {body}
      </View>
    </View>
  );
  if (thumb) return frame;
  return (
    <View style={{ borderRadius: radius.card, backgroundColor: tokens.surface2, alignItems: "center", paddingVertical: 10, gap: 6 }}>
      {frame}
      {note ? <Text size={11} muted>{note}</Text> : null}
    </View>
  );
}

function Bar({ w = "60%", h = 8 }: { w?: number | `${number}%`; h?: number }) {
  return <View style={{ width: w, height: h, borderRadius: h / 2, backgroundColor: GHOST }} />;
}

/** قطعُ الخانات كما يرسمها الودجت (D-1571) — أشكالٌ رماديّة: المعاينةُ تُجيب «أين وكم»، والمحتوى يعرفه صاحبُه */
function Thumb({ w, h, r = 4 }: { w: number; h: number; r?: number }) {
  return <View style={{ width: w, height: h, borderRadius: r, backgroundColor: GHOST }} />;
}

function Compact({ label, more }: { label: string; more?: boolean }) {
  /* السطرُ المختصر ٣٤: بوستر ٢٢×٣٣ وسطران — صفُّ «القادم» تحت البطاقتين وسطرُ نشاطك تحت */
  return (
    <View style={{ height: 34, flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Thumb w={22} h={33} r={3.5} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text size={9.5} weight="700" color="#FFD400" numberOfLines={1}>{label}</Text>
        <Bar w="55%" h={7} />
      </View>
      {more ? <Text size={9.5} color="#9C9C9C">+٢ ←</Text> : null}
    </View>
  );
}

function SecTitle({ text }: { text: string }) {
  return (
    <View style={{ height: 24, justifyContent: "flex-start" }}>
      <Text size={11.5} weight="800" color="#F7F7F7" numberOfLines={1} style={{ lineHeight: 18 }}>{text}</Text>
    </View>
  );
}

function ListRows({ k, n, rowH, thumbW, thumbH }: { k: WidgetSectionKey; n: number; rowH: number; thumbW: number; thumbH: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <View key={i} style={{ height: rowH, flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Thumb w={thumbW} h={thumbH} />
          <View style={{ flex: 1, gap: 5 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              {k === "friends" ? <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: "#3a3a3a" }} /> : null}
              <Bar w="55%" h={8} />
            </View>
            <Bar w="38%" h={6} />
          </View>
        </View>
      ))}
    </>
  );
}

function PosterColumn({ h, tint }: { h: number; tint: string }) {
  /* بوسترٌ ٢:٣ بطول الجسم وعمودٌ: ↻ فوق والمعلومةُ ثمّ الفعلُ تحت (فيلمُ الليلة والسينما وكلُّ نصفٍ «بوستر») */
  return (
    <View style={{ height: h, flexDirection: "row", gap: 6 }}>
      <View style={{ width: Math.round((h * 2) / 3), height: h, borderRadius: 7, backgroundColor: tint }} />
      <View style={{ flex: 1, alignItems: "center", justifyContent: "space-between", paddingVertical: 2 }}>
        <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: "#222" }} />
        <Bar w="70%" h={6} />
        <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: "#222" }} />
      </View>
    </View>
  );
}

function PreviewRow({ row, names, look }: { row: WidgetRow; names: Record<WidgetSectionKey, string>; look: WidgetLookSize }) {
  const h = row.h;
  switch (row.type) {
    case "search":
      return <View style={{ height: h, borderRadius: 22, backgroundColor: "#161616" }} />;
    case "cont":
      return (
        <View style={{ height: h }}>
          <View style={{ height: 24 }}>
            <Text size={13} weight="800" color="#F7F7F7" numberOfLines={1} style={{ lineHeight: 18 }}>{names.cont}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8, height: row.card ?? look.contCard }}>
            {[0, 1].map((i) => (
              <View key={i} style={{ flex: 1, borderRadius: 12, backgroundColor: "#2f3b46" }}>
                <View style={{ position: "absolute", top: 6, start: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(22,22,22,0.78)" }} />
              </View>
            ))}
          </View>
          {row.upLine ? (
            <>
              <View style={{ height: 1, backgroundColor: LINE, marginVertical: (V3_HEIGHTS.upGap - 1) / 2 }} />
              <Compact label={names.up} more />
            </>
          ) : null}
        </View>
      );
    case "list":
      return (
        <View style={{ height: h }}>
          <SecTitle text={names[row.key]} />
          {row.view === "posters" ? (
            <View style={{ flexDirection: "row", justifyContent: "space-between", height: row.h - WIDGET_HEIGHTS.listHeader }}>
              {Array.from({ length: row.posters ?? 3 }, (_, i) => (
                <View key={i} style={{ width: 72, gap: 4 }}>
                  <View style={{ width: 72, height: 108, borderRadius: 7, backgroundColor: row.key === "cine" ? "#4a2626" : GHOST }} />
                  <Bar w="80%" h={7} />
                </View>
              ))}
            </View>
          ) : (
            <ListRows k={row.key} n={row.count} rowH={(row.h - WIDGET_HEIGHTS.listHeader) / row.count} thumbW={row.key === "friends" ? look.friendThumbW : look.listThumbW} thumbH={row.key === "friends" ? look.friendThumbH : look.listThumbH} />
          )}
        </View>
      );
    case "tonight":
      return (
        <View style={{ height: h }}>
          <SecTitle text={names.tonight} />
          <PosterColumn h={h - 24} tint="#3b2a2a" />
        </View>
      );
    case "pair": {
      const body = h - WIDGET_HEIGHTS.pairHead;
      return (
        <View style={{ height: h, flexDirection: "row", gap: 8 }}>
          {[0, 1].map((i) => {
            const k = row.keys[i];
            const poster = k === "tonight" || k === "cine" || (row.views?.[i] === "poster" && k !== "act");
            const n = row.rows?.[i] ?? row.count;
            return (
              <React.Fragment key={i}>
                {i ? <View style={{ width: 1, backgroundColor: LINE }} /> : null}
                <View style={{ flex: 1, overflow: "hidden" }}>
                  {k ? (
                    <>
                      <SecTitle text={names[k]} />
                      {poster ? (
                        <PosterColumn h={body} tint={k === "cine" ? "#4a2626" : k === "tonight" ? "#3b2a2a" : GHOST} />
                      ) : (
                        <ListRows k={k} n={n} rowH={body / n} thumbW={k === "friends" ? 28 : 22} thumbH={k === "friends" ? 42 : 33} />
                      )}
                    </>
                  ) : null}
                </View>
              </React.Fragment>
            );
          })}
        </View>
      );
    }
    case "line":
      return <Compact label={names[row.key]} />;
  }
  return null;
}

function SmallTile({ name, form }: { name: string; form: ReturnType<typeof smallWidgetForm> }) {
  /* 🆕 D-1571 — الصغيرُ بوسترٌ كاملٌ ١٠٨×١٦٢ وعمودُ أزرار (لوحة الخطّة ٢×٢) */
  if (form === "posterColumn") {
    return (
      <View style={{ flex: 1, backgroundColor: BLACK, padding: 8, flexDirection: "row", gap: 6, alignItems: "center" }}>
        <View style={{ width: 108, height: 162, borderRadius: 9, backgroundColor: "#2f3b46", justifyContent: "flex-end", padding: 6 }}>
          <Text size={9} weight="800" color="#FFD400" numberOfLines={1}>{name}</Text>
        </View>
        <View style={{ flex: 1, height: 162, alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: "#222" }} />
          <Bar w="70%" h={6} />
          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: "#222" }} />
        </View>
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: form === "list" ? BLACK : "#2f3b46", padding: 11, justifyContent: "space-between" }}>
      <Text size={11} weight="800" color="#FFD400">{name}</Text>
      <View style={{ gap: 10 }}>
        {[0, 1, 2].map((i) => <Bar key={i} w={i ? "60%" : "80%"} />)}
      </View>
    </View>
  );
}
