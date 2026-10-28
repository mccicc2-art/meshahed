import React from "react";
import { View } from "react-native";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon } from "../icons";
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
const WIDTH: Record<WidgetSize, number> = { small: 172, medium: 358, large: 358, xl: 358 };

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
  const gone = empty.filter((k) => k !== "cont" && k !== "search" && given.on[k]);
  const config: WidgetLayoutConfig = gone.length ? { ...given, on: { ...given.on, ...Object.fromEntries(gone.map((k) => [k, false])) } } : given;
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
    const form = platform === "ios" ? smallWidgetForm(config, key, 170, 170) : smallWidgetForm(config, key, 173, 246);
    body = <SmallTile name={names[key]} form={form} />;
  } else {
    const l = resolveWidgetLayout(config, size, H, platform, { look, resize: platform === "ios" || ANDROID_RESIZE });
    const lk = lookFor(look, platform, size);
    body = l.rows.map((r, i) => (
      <View key={i}>
        {i ? <View style={{ height: 1, backgroundColor: LINE, marginVertical: (WIDGET_HEIGHTS.gap - 1) / 2 }} /> : null}
        <PreviewRow row={r} names={names} contImage={config.opts.cont.small !== "list"} look={lk} posters={(k) => config.opts[k].view === "posters"} />
      </View>
    ));
    note = l.hidden.length ? t.widgetDoesntFit(l.hidden.map((k) => names[k]).join("، ")) : t.widgetAllFit;
    if (gone.length) note = `${note}\n${t.widgetEmptyNow(gone.map((k) => names[k]).join("، "))}`;
  }
  /* الصغيرُ في أندرويد طوليٌّ (W43)، وفي الآيفون مربّع */
  const h = size === "small" ? (platform === "ios" ? 170 : 246) : H;

  const frame = (
    <View style={{ width: W * scale, height: h * scale, overflow: "hidden", borderRadius: thumb ? 10 : 0 }}>
      <View style={{ width: W, height: h, transform: [{ scale }], transformOrigin: "top left", borderRadius: 22, backgroundColor: BLACK, padding: size === "small" ? 0 : WIDGET_HEIGHTS.pad / 2, overflow: "hidden" }}>
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

function Title({ text }: { text: string }) {
  return <Text size={13} weight="700" color="#F7F7F7" numberOfLines={1}>{text}</Text>;
}

function PreviewRow({ row, names, contImage, look, posters }: { row: WidgetRow; names: Record<WidgetSectionKey, string>; contImage: boolean; look: WidgetLookSize; posters: (k: WidgetSectionKey) => boolean }) {
  const { t } = useApp();
  const h = row.h;
  switch (row.type) {
    case "search":
      return (
        <View style={{ height: h, gap: 8 }}>
          <View style={{ height: 44, borderRadius: 22, backgroundColor: "#161616", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14 }}>
            <Icon name="search" size={16} color="#FFD400" />
            <Text size={12} color="#B5B5B5" numberOfLines={1}>{t.widgetSearchPlaceholder}</Text>
          </View>
          {row.full ? (
            <>
              <Text size={12} weight="600" color="#B5B5B5" style={{ height: 16 }}>{t.widgetTrendingToday}</Text>
              {/* W31 — قائمةٌ مرقّمةٌ بعمودين، أو بوستراتٌ مرقّمةٌ بارتفاع شبكة البوسترات */}
              {row.trend === "posters" ? (
                <View style={{ flexDirection: "row", gap: 8, height: look.posterGrid }}>
                  {[1, 2, 3].map((n) => (
                    <View key={n} style={{ flex: 1, borderRadius: 10, backgroundColor: GHOST }}>
                      <Text size={18} weight="800" color={n === 1 ? "#FFD400" : "#F7F7F7"} style={{ position: "absolute", bottom: 4, start: 8 }}>{n}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={{ flexDirection: "row", gap: 12, height: 40 }}>
                  {[1, 2].map((n) => (
                    <View key={n} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text size={15} weight="800" color={n === 1 ? "#FFD400" : "#B5B5B5"}>{n}</Text>
                      <View style={{ width: 28, height: 40, borderRadius: 5, backgroundColor: GHOST }} />
                      <Bar w="45%" />
                    </View>
                  ))}
                </View>
              )}
            </>
          ) : null}
        </View>
      );
    case "cont":
      return (
        <View style={{ height: h, gap: 8 }}>
          <Title text={names.cont} />
          {/* 🆕 W50 — البطاقتان بالمقاس الذي حسمه المحرّك (٤×٢ في الكبير) لا تتمدّدان */}
          <View style={{ flexDirection: "row", gap: 8, height: row.card ?? (row.tall ? look.contCardTall : look.contCard) }}>
            {/* بطاقتا ١٦:٩ — والعلامةُ رصاصيّة (W36)؛ وفي المتوسط وحدَه أطول (`tall`) */}
            {[0, 1].map((i) => (
              <View key={i} style={{ flex: 1, borderRadius: 12, backgroundColor: "#2f3b46" }}>
                <View style={{ position: "absolute", top: 6, start: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(22,22,22,0.78)" }} />
              </View>
            ))}
          </View>
          {row.upLine ? (
            <>
              <View style={{ height: 1, backgroundColor: LINE }} />
              <Text size={11} color="#B5B5B5" numberOfLines={1}>{t.widgetUpLine} —</Text>
            </>
          ) : null}
        </View>
      );
    case "list":
      return (
        <View style={{ height: h, gap: 4 }}>
          <Title text={names[row.key]} />
          {row.view === "posters" ? (
            /* 🆕 W54 — ثلاثةٌ أو أربعةٌ تملأ العرض بارتفاع شبكتها */
            <View style={{ flexDirection: "row", gap: look.posterGap, height: row.h - WIDGET_HEIGHTS.listHeader }}>
              {Array.from({ length: row.posters ?? 3 }, (_, i) => <View key={i} style={{ flex: 1, borderRadius: 10, backgroundColor: GHOST }} />)}
            </View>
          ) : (
            Array.from({ length: row.count }, (_, i) => (
              /* 🆕 W50 — السطرُ وصورتُه يكبران بالقدر نفسِه (`grow`) */
              <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 10, height: (row.h - WIDGET_HEIGHTS.listHeader) / row.count }}>
                <View style={{ width: ((row.key === "friends" ? look.friendThumbH : look.listThumbH) + (row.grow ?? 0)) * (2 / 3), height: (row.key === "friends" ? look.friendThumbH : look.listThumbH) + (row.grow ?? 0), borderRadius: 6, backgroundColor: GHOST }} />
                <View style={{ flex: 1, gap: 6 }}>
                  <Bar w="55%" />
                  <Bar w="35%" h={6} />
                </View>
              </View>
            ))
          )}
        </View>
      );
    case "tonight":
      return row.view === "wide" ? (
        <View style={{ height: h, borderRadius: 12, backgroundColor: "#2b3a4a", justifyContent: "flex-end", padding: 10 }}>
          <Text size={10} weight="800" color="#FFD400" style={{ position: "absolute", top: 9, start: 10 }}>{names.tonight}</Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <Chip label={`✓ ${t.widgetWatched}`} />
            <Chip label={t.widgetAnother} />
          </View>
        </View>
      ) : (
        <View style={{ height: h, flexDirection: "row", gap: 12 }}>
          <View style={{ width: Math.round((h * 2) / 3), borderRadius: 12, backgroundColor: "#3b2a2a" }} />
          <View style={{ flex: 1, justifyContent: "space-between", paddingVertical: 4 }}>
            <View style={{ gap: 6 }}>
              <Text size={10} weight="800" color="#FFD400">{names.tonight}</Text>
              <Bar w="70%" h={10} />
              <Bar w="50%" />
            </View>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <Chip label={`✓ ${t.widgetWatched}`} />
              <Chip label={t.widgetAnother} />
            </View>
          </View>
        </View>
      );
    case "pair":
      return (
        <View style={{ height: h, flexDirection: "row", gap: 17 }}>
          {[0, 1].map((i) => {
            const k = row.keys[i];
            return (
              <View key={i} style={{ flex: 1, gap: 4, overflow: "hidden" }}>
                {k ? (
                  <>
                    <Title text={names[k]} />
                    {k === "tonight" || (k === "cont" && contImage) ? (
                      /* 🆕 فيلمُ الليلة (ومعه أكملُ المشاهدة «صورة»، W45) في النصف: الصورةُ العريضة تذوب في الأسود و✓ في طرفها */
                      <View style={{ flex: 1, borderRadius: 10, overflow: "hidden", backgroundColor: BLACK }}>
                        <View style={{ width: "100%", aspectRatio: 16 / 9, backgroundColor: k === "cont" ? "#2f3b46" : "#3b2a2a" }} />
                        <View style={{ position: "absolute", left: 8, right: 40, bottom: 9, gap: 5 }}>
                          <Bar w="75%" h={9} />
                          <Bar w="45%" h={6} />
                        </View>
                        <View style={{ position: "absolute", right: 7, bottom: 7, width: 26, height: 26, borderRadius: 13, backgroundColor: "rgba(22,22,22,0.78)" }} />
                      </View>
                    ) : (row.views ? row.views[i] === "poster" : posters(k)) && k !== "act" ? (
                      /* 🆕 W55 — القسمُ الصغيرُ بوسترين */
                      <View style={{ flex: 1, flexDirection: "row", gap: 8 }}>
                        {[0, 1].map((j) => <View key={j} style={{ flex: 1, borderRadius: 8, backgroundColor: GHOST }} />)}
                      </View>
                    ) : (
                      Array.from({ length: row.count ?? 3 }, (_, j) => (
                        <View key={j} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <View style={{ width: 30, height: 45, borderRadius: 5, backgroundColor: GHOST }} />
                          <Bar w="60%" />
                        </View>
                      ))
                    )}
                  </>
                ) : null}
              </View>
            );
          })}
        </View>
      );
    case "line":
      /* W39 — السطرُ المختصرُ لقسمٍ لا يتّسع */
      return (
        <View style={{ height: h, flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ width: 28, height: 42, borderRadius: 6, backgroundColor: GHOST }} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text size={10} weight="800" color="#FFD400">{names[row.key]}</Text>
            <Bar w="55%" />
          </View>
        </View>
      );
  }
}

function Chip({ label }: { label: string }) {
  return (
    <View style={{ height: 24, paddingHorizontal: 9, borderRadius: 999, backgroundColor: "rgba(22,22,22,0.78)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", justifyContent: "center" }}>
      <Text size={10} weight="600" color="#F7F7F7">{label}</Text>
    </View>
  );
}

function SmallTile({ name, form }: { name: string; form: ReturnType<typeof smallWidgetForm> }) {
  return (
    <View style={{ flex: 1, backgroundColor: form === "list" ? BLACK : "#2f3b46", padding: 11, justifyContent: "space-between" }}>
      <Text size={11} weight="800" color="#FFD400">{name}</Text>
      {form === "list" ? (
        <View style={{ gap: 10 }}>
          {[0, 1, 2].map((i) => <Bar key={i} w={i ? "60%" : "80%"} />)}
        </View>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
          <View style={{ gap: 6, flex: 1 }}>
            <Bar w="70%" h={10} />
            <Bar w="45%" h={6} />
          </View>
          <View style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.85)", backgroundColor: "rgba(5,5,5,0.45)" }} />
        </View>
      )}
    </View>
  );
}
