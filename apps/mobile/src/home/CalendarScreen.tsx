import React, { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Platform, Pressable, ScrollView, View, useWindowDimensions, type ScrollViewInstance } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { useApp } from "../state";
import { Button, Text, TopBar } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import { shell, type NativeRoot } from "../shell";
import { haptic } from "../haptics";
import { posterFor } from "../poster";
import { usePullRefresh } from "../pullRefresh";
import { OneTimeHint } from "../library/OneTimeHint";
import type { CalendarPayload } from "@/core/contracts/calendar";
import { useHomeDoor } from "../homeDoor";

/**
 * 🆕 **تقويمُ أعمالك شاشةً أصليّة** (D-1317، طلبُ أحمد: «حول التقويم لاصلية») — كانت بابَ ويبٍ يُفتح من عنوان
 * شريط الأسبوع في الرئيسيّة.
 *
 * 🔑 **الميزاتُ ميزاتُ الويب والمقاساتُ مقاساتُ التطبيق** (حكمُه ٢٢ سبتمبر): شبكةُ الشهر، ضغطةُ يومٍ فيه
 * شيءٌ تنزل إلى قائمته، قائمةُ الأيّام بملصقها واسمها، تقليبُ الأشهر بحدَّيه، وقاعدةُ البلس نفسُها (الشهرُ
 * الحاليُّ للجميع وما بعده باهتٌ تحت البوّابة). **والحسابُ كلُّه في الخادم** (`/api/v1/me/calendar`) من
 * `core/calendar.ts` التي تبني صفحةَ الويب — فلا يفترق يومٌ بين السطحين.
 * ⚠️ **والخانةُ خانةُ «أسبوعك» بحرفها** (D-1616: ملصقُ العمل · `+N` · المتوقَّعُ باهت): علامةٌ واحدةٌ
 * تعني الشيءَ نفسَه في الرئيسيّة وهنا (القاعدة ٣).
 * ⚠️ **والشهرُ السابقُ يبقى مرسوماً حتى يصل التالي** (`keepPreviousData`): تقليبٌ يمحو الشبكةَ ثمّ يرسمها
 * يُقرأ رمشة.
 */
const PAGE_PAD = 16;
const GAP = 4;

export const calendarKey = (month: string | null) => ["me:calendar", month ?? "now"] as const;

export function CalendarScreen({ from }: { from: NativeRoot | "web" }) {
  const { t, tokens, locale } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [month, setMonth] = useState<string | null>(null);
  const key = calendarKey(month);
  const q = useQuery({
    queryKey: key,
    queryFn: async () => (await api<CalendarPayload>(month ? `/api/v1/me/calendar?m=${month}` : "/api/v1/me/calendar")).data,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
  const d = q.data ?? null;
  const refresh = usePullRefresh([key], 0);

  /* 🆕 D-1611 — ضغطةٌ مطوّلةٌ على الرجوع ترجع إلى أوّل التبويب (`useHomeDoor`) */
  const home = useHomeDoor();
  const back = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/web");
  }, [router]);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      back();
      return true;
    });
    return () => sub.remove();
  }, [back]);

  const openTitle = useCallback(
    (kind: "tv" | "movie", id: number) => router.push({ pathname: "/title/[kind]/[id]", params: { kind, id: String(id), from } }),
    [router, from],
  );
  const openWeb = useCallback((path: string) => void shell.open(path, from === "web" ? undefined : { returnTo: from }), [from]);

  const go = (m: string | null) => {
    if (!m) return;
    haptic.pick();
    setMonth(m);
  };

  /* **ضغطةُ يومٍ تنزل إلى قائمته** — مواضعُ المجموعات تُقاس عند رسمها (رابطُ `#d-…` في الويب) */
  const scroller = useRef<ScrollViewInstance>(null);
  const listTop = useRef(0);
  const groupTop = useRef(new Map<string, number>());
  const jump = (date: string) => {
    const y = groupTop.current.get(date);
    if (y == null) return;
    haptic.pick();
    scroller.current?.scrollTo({ y: Math.max(0, listTop.current + y - 8), animated: true });
  };

  const cellW = Math.floor((width - PAGE_PAD * 2 - GAP * 6) / 7);
  /* D-1616 — ملصقُ الخانة: عرضُها بلا حشوتها، ونسبةُ ٢:٣ كملصقات «أسبوعك» */
  /* D-1623 — الحاشيةُ ٤+٤ والإطارُ ١+١: البوستر كان يتجاوز إطارَ الخانة بنقطةٍ من كلِّ جانب */
  const posterW = cellW - 10;
  const posterH = Math.round(posterW * 1.5);
  const arrow = (m: string | null, glyph: string, label: string) =>
    m ? (
      <Pressable onPress={() => go(m)} accessibilityRole="button" accessibilityLabel={label} hitSlop={6} style={({ pressed }) => ({ width: 36, height: 40, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}>
        <Text size={20} muted style={{ lineHeight: 22 }}>{glyph}</Text>
      </Pressable>
    ) : (
      <View style={{ width: 36, height: 40 }} />
    );

  const body = d ? (
    <>
      <View style={{ flexDirection: "row", gap: GAP, marginBottom: 4 }}>
        {d.weekdays.map((h, i) => (
          <Text key={i} size={10} muted style={{ width: cellW, textAlign: "center", lineHeight: 14 }} numberOfLines={1}>{h}</Text>
        ))}
      </View>
      {/* 🆕 D-1616 — **الخانةُ ملصقُ عملها كـ«أسبوعك»** (أحمد ١ نوفمبر بلقطة التقويم: «التقويم عدله مثل أسبوعك» — «١أ»): كانت
         رقماً وشريطاً واسماً بخطٍّ ٩ لا يُقرأ. الآن ملصقُ أوّلِ أعمال اليوم، و«+N» شارةٌ عليه إن زاد، والمتوقَّعُ باهتٌ متقطّع (D-1614).
         ⚠️ **الصفوفُ سبعاً سبعاً** (لا لفٌّ واحد): أسبوعٌ بلا عملٍ يبقى قصيراً ولا يُمدّ لطول ملصقٍ في أسبوعٍ آخر، وأسبوعٌ فيه
         عملٌ تأخذ كلُّ خاناته طولَ الملصق فتبقى الشبكةُ مستقيمة. والاسمُ في القائمة تحت الشبكة — العرضُ نحو ٤٠ لا يتّسع لاسم. */}
      <View style={{ gap: GAP }}>
        {Array.from({ length: Math.ceil(d.cells.length / 7) }, (_, r) => d.cells.slice(r * 7, r * 7 + 7)).map((row) => {
          const tall = row.some((c) => c.count > 0);
          return (
            <View key={row[0]?.date} style={{ flexDirection: "row", gap: GAP }}>
              {row.map((c) => {
                const has = c.count > 0;
                const first = has ? d.groups.find((g) => g.date === c.date)?.items[0] : undefined;
                const url = first ? posterFor(first.poster_path, posterW) : null;
                const face = (
                  <>
                    <Text size={14} weight="700" color={c.is_today ? tokens.accent : c.in_month ? tokens.fg : tokens.muted} style={{ lineHeight: 16, opacity: c.in_month ? 1 : 0.5 }}>{c.day}</Text>
                    {tall ? (
                      has ? (
                        <View style={{ marginTop: 6, width: posterW, height: posterH, borderRadius: 6, overflow: "hidden", backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center", opacity: first?.expected ? 0.5 : 1 }}>
                          {url ? <Image source={{ uri: url }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" /> : <Icon name={first?.media === "movie" ? "film" : "tv"} size={16} color={tokens.muted} />}
                          {c.count > 1 ? (
                            <View style={{ position: "absolute", bottom: 3, end: 3, minWidth: 18, paddingHorizontal: 4, height: 16, borderRadius: 8, backgroundColor: tokens.accent2, alignItems: "center", justifyContent: "center" }}>
                              <Text size={10} weight="700" color="#fff" style={{ lineHeight: 12, fontVariant: ["tabular-nums"] }}>{`+${c.count - 1}`}</Text>
                            </View>
                          ) : null}
                        </View>
                      ) : (
                        <View style={{ marginTop: 6, width: posterW, height: posterH }} />
                      )
                    ) : (
                      <View style={{ marginTop: 6, height: 4, borderRadius: 2, alignSelf: "stretch", backgroundColor: c.in_month ? tokens.border : "transparent" }} />
                    )}
                  </>
                );
                const base = { width: cellW, borderRadius: 10, paddingHorizontal: 4, paddingVertical: 8, alignItems: "center" as const, borderWidth: 1 };
                return has ? (
                  <Pressable key={c.date} onPress={() => jump(c.date)} accessibilityRole="button" accessibilityLabel={`${c.day} · ${first?.title ?? ""}${c.count > 1 ? ` +${c.count - 1}` : ""}`} style={({ pressed }) => [base, c.expected ? { borderColor: tokens.accent2 + "4D", borderStyle: "dashed" as const, opacity: pressed ? 0.6 : 1 } : { borderColor: tokens.accent2 + "59", backgroundColor: tokens.accent2 + "0F", opacity: pressed ? 0.7 : 1 }]}>
                    {face}
                  </Pressable>
                ) : (
                  <View key={c.date} style={[base, c.in_month ? { borderColor: tokens.border, backgroundColor: tokens.surface, opacity: 0.6 } : { borderColor: "transparent" }]}>{face}</View>
                );
              })}
            </View>
          );
        })}
      </View>

      <View onLayout={(e) => (listTop.current = e.nativeEvent.layout.y)} style={{ marginTop: 24 }}>
        {d.groups.length === 0 ? (
          <Text size={14} muted style={{ textAlign: "center", paddingVertical: 24 }}>{t.calEmpty}</Text>
        ) : (
          d.groups.map((g) => (
            <View key={g.date} onLayout={(e) => groupTop.current.set(g.date, e.nativeEvent.layout.y)} style={{ marginBottom: 20 }}>
              <Text size={12} weight="600" muted style={{ marginBottom: 8 }}>
                {g.is_today ? `${locale === "en" ? "Today" : "اليوم"} · ` : ""}
                {g.label}
              </Text>
              <View style={{ gap: 8 }}>
                {g.items.map((e) => {
                  const url = posterFor(e.poster_path, 36);
                  return (
                    <Pressable
                      key={e.key}
                      onPress={() => openTitle(e.media, e.tmdb_id)}
                      accessibilityRole="link"
                      accessibilityLabel={e.title}
                      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, borderWidth: 1, borderColor: tokens.border, borderStyle: e.expected ? "dashed" : "solid", backgroundColor: tokens.surface, padding: 8, opacity: pressed ? 0.5 : e.expected ? 0.6 : 1 })}
                    >
                      <View style={{ width: 36, height: 54, borderRadius: 6, overflow: "hidden", backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
                        {url ? <Image source={{ uri: url }} style={{ width: 36, height: 54 }} contentFit="cover" /> : <Icon name={e.media === "tv" ? "tv" : "film"} size={16} color={tokens.muted} />}
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text size={14} weight="500" numberOfLines={1} autoDir>{e.title}</Text>
                        <Text size={12} muted style={{ marginTop: 2 }}>{e.expected ? (d.expected_label ?? t.calEpisode) : e.media === "tv" ? t.calEpisode : t.calRelease}</Text>
                      </View>
                      <Text size={16} muted>›</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))
        )}
      </View>
    </>
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg }}>
      {/* D-1624 — الشريطُ الواحد؛ **الشهرُ وسهماه في طرفه** كما في الويب — والسهمُ يغيب عند حدِّ المدى ويبقى مكانُه فلا يقفز الاسم */}
      <View style={{ paddingTop: insets.top }}>
        <TopBar
          title={t.calTitle}
          onBack={back}
          onBackLong={home}
          backLabel={t.closeLabel}
          end={
            d ? (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                {arrow(d.prev, "‹", locale === "en" ? "Previous month" : "الشهر السابق")}
                <Text size={13} weight="600" numberOfLines={1} style={{ minWidth: 92, textAlign: "center" }}>{d.label}</Text>
                {arrow(d.next, "›", locale === "en" ? "Next month" : "الشهر التالي")}
              </View>
            ) : undefined
          }
        />
      </View>

      {!d ? (
        q.isError ? (
          <View style={{ alignItems: "center", gap: 12, paddingTop: 48, paddingHorizontal: PAGE_PAD }}>
            <Text muted style={{ textAlign: "center" }}>{t.apiInternal}</Text>
            <Button label={t.errorRetry} variant="ghost" onPress={() => void q.refetch()} />
          </View>
        ) : (
          <View style={{ paddingHorizontal: PAGE_PAD, gap: 16 }}>
            <View style={{ height: 300, borderRadius: radius.card, backgroundColor: tokens.surface2 }} />
            <View style={{ height: 70, borderRadius: 12, backgroundColor: tokens.surface2 }} />
            <View style={{ height: 70, borderRadius: 12, backgroundColor: tokens.surface2 }} />
          </View>
        )
      ) : (
        <ScrollView ref={scroller} refreshControl={refresh} contentContainerStyle={{ paddingHorizontal: PAGE_PAD, paddingBottom: insets.bottom + 40 }}>
          {d.intro_hint ? (
            <View style={{ marginBottom: 12 }}>
              <OneTimeHint id="calendar-intro" text={t.hintCalendar} />
            </View>
          ) : null}
          <Text size={12} muted style={{ marginBottom: 16, lineHeight: 18 }}>
            {/* 🆕 D-1614 — سطرُ الأفق من الخادم (المعلنُ والمتوقَّع)؛ خادمٌ أقدمُ ⇐ السطرُ المحفوظ */}
            {t.calSub} {d.horizon ?? t.calHorizon}
          </Text>
          {d.locked ? (
            /* 🔒 بوّابةُ البلس بوصفة `StatsScreen`: المحتوى باهتٌ تحتها — لا ضبابَ في التطبيق فالخفوتُ يقوم مقامه */
            <View>
              <View pointerEvents="none" style={{ opacity: 0.18, maxHeight: 360, overflow: "hidden" }}>{body}</View>
              <View style={{ alignItems: "center", gap: 8, marginTop: 16 }}>
                <Icon name="star" size={24} color={tokens.accent} />
                <Text size={15} weight="700" style={{ textAlign: "center" }}>{t.plusGateTitle}</Text>
                <Button size="sm" label={t.plusLearnMore} onPress={() => openWeb("/plus")} />
              </View>
            </View>
          ) : (
            body
          )}
        </ScrollView>
      )}
    </View>
  );
}
