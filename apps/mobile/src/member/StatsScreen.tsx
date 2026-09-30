import React, { useCallback, useEffect, useState } from "react";
import { BackHandler, Platform, Pressable, ScrollView, Share, StyleSheet, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../api";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Icon, type IconName } from "../icons";
import { radius } from "../theme";
import { shell, type NativeRoot } from "../shell";
import { CONFIG } from "../config";
import { haptic } from "../haptics";
import { posterFor } from "../poster";
import { span, afterPaint } from "../perfMarks";
import { usePullRefresh } from "../pullRefresh";
import { IdentityBadges, identityFlags } from "../IdentityBadges";
import { Sheet } from "../library/Sheet";
import { PosterCard } from "../library/PosterCard";
import { displayNameOf } from "@/core/people";
import { num, worksParts } from "@/core/i18n";
import type { MemberStatsPayload, MemberTaste, MemberTasteEntry, MemberTasteList, MemberTasteWork, MyStatsPayload, MyStatsRange } from "@/core/contracts/memberStats";

/**
 * ====== إحصاءاتُ العضو أصليّةً — Phase 11-N · N4 (٣٠ سبتمبر ٢٠٢٦) ======
 *
 * **قرارُ أحمد (D-1192): «خلها اصلية»** — كانت آخرَ بابٍ ويبيٍّ في ملفّ الشخص (طبقةً فوقه — K3b). **الحمولةُ ما ترسمه صفحةُ
 * `/u/{username}/stats` حرفاً** (`GET /api/v1/profile/{username}/stats` فوق `lib/memberStatsCore.ts`)، **والشاشةُ ترسم ولا تصوغ**.
 *
 * 🔑 **ما في الويب كلُّه، بمقاسات التطبيق** (قاعدةُ ٢٢ سبتمبر: الميزاتُ تطابق لا البكسل):
 * - **بطاقةُ صاحبها**: ملصقاتُ ذوقه الثلاثة أرضيّةً تحت حجاب · صورتُه واسمُه وشاراتُه · متابِعوه · نبذتُه · **ووقتُ المشاهدة في
 *   الزاوية المقابلة** (D-721/D-724) · ثمّ خطُّ التمييز وشريطُ الأرقام الأربعة (مسلسلات · أفلام شوهدت · حلقات · تعليقات).
 * - **بطاقةُ الذوق** بخاناتها الستّ في عمودين: عنوانُ الخانة يفتح قائمتَها كاملةً حين تزيد على المعروض، وكلُّ صفٍّ يفتح أعمالَه
 *   (الملصقُ يفتح العملَ أصليّاً). أرضيّةُ كلِّ خانةٍ ملصقاتُها باهتة (D-649).
 * - **«أنت وهو»** (D-829) زرٌّ في طرف عنوان الذوق: النسبةُ مفتوحة، والتفصيلُ (تجتمعان · تفترقان · في مكتبته وليست عندك) للبلس
 *   (`PlusPreview`) — لغير المشترك يُرى باهتاً تحت بوّابته.
 * 🔒 الحسابُ الخاصُّ والحظرُ يقولان القفلَ صريحاً (الحارسُ SQL).
 *
 * 🆕 **D-1214 — وإحصائياتي أنا بالشاشة نفسِها** (طلبُ أحمد: «نفّذ الإحصائيات»): كانت `/stats` آخرَ بابٍ ويبيٍّ في «المكتبة»
 * والرئيسيّة وملفّي. **الوجهُ واحدٌ في الويب** (`AnalysisView` — «المختلفُ القارئُ لا الرسم»، D-145) **فهو واحدٌ هنا**: بلا
 * `username` تقرأ الشاشةُ `GET /api/v1/me/stats` وتزيد ما تزيده صفحتُها — **المدى في قائمة ⋯** (D-682: الكلّ · السنة · الشهر)
 * واسمُه تحت وقت المشاهدة، **وبابُ «تقاريرك» في الذيل** (D-796، ويفتح صفحتَه الويبيّة طبقةً)، **و«ذوقك»** بضمير صاحبها.
 */
const PAGE_PAD = 16;
const HEADER_H = 56;

export const memberStatsKey = (handle: string) => [`profile:${handle.toLowerCase()}:stats`] as const;

export const myStatsKey = (range: MyStatsRange) => ["me:stats", range] as const;

/** بلا `username` ⇐ إحصائياتي أنا (`/stats`)؛ ومعه ⇐ إحصاءاتُ العضو (`/u/{username}/stats`) */
export function StatsScreen({ username, from }: { username?: string; from: NativeRoot | "web" }) {
  const { t, tokens, locale } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mine = username == null;
  /* المدى حالةٌ في الشاشة لا في الرابط: التطبيقُ لا يشارك روابطَ شاشاته، ولكلِّ مدًى مفتاحُه فالعودةُ إليه فوريّة من الكاش */
  const [range, setRange] = useState<MyStatsRange>("all");
  const [rangeSheet, setRangeSheet] = useState(false);
  const key = mine ? myStatsKey(range) : memberStatsKey(username ?? "");
  const q = useQuery({
    queryKey: key,
    queryFn: async () =>
      (await api<MemberStatsPayload & Partial<Pick<MyStatsPayload, "range_label">>>(mine ? `/api/v1/me/stats?range=${range}` : `/api/v1/profile/${encodeURIComponent(username ?? "")}/stats`)).data,
    staleTime: 5 * 60_000,
  });
  const d = q.data ?? null;
  const refresh = usePullRefresh([key], 0);

  const qc = useQueryClient();
  const [endOpen] = useState(() => span("stats.open", { cached: qc.getQueryData(key) ? 1 : 0 }));
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    if (!d || opened) return;
    setOpened(true);
    afterPaint(() => endOpen());
  }, [d, opened, endOpen]);

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
  /* 🆕 D-1214 — مشاركتي: **رابطُ صفحة إحصاءاتي العامّة** (`/u/{username}/stats`). صورةُ البطاقة (`/api/share`) تحتاج وحدةً
     أصليّة (`expo-sharing`) لا تصل بتحديثٍ هوائيّ — تأتي مع أوّل بناءٍ أصليٍّ قادم؛ وبلا اسم مستخدمٍ لا رابطَ يُشارك فلا زرّ */
  const shareMine = useCallback(() => {
    const u = q.data?.person.username;
    if (!u) return;
    const url = `${CONFIG.apiBase}/u/${u}/stats`;
    void Share.share({ message: url, url }).catch(() => {});
  }, [q.data]);

  const [sheet, setSheet] = useState<null | { kind: "works"; title: string; works: MemberTasteWork[]; total: number } | { kind: "all"; title: string; all: MemberTasteList } | { kind: "match" }>(null);

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg }}>
      <View style={{ paddingTop: insets.top, height: insets.top + HEADER_H, flexDirection: "row", alignItems: "center", paddingHorizontal: 8, gap: 4 }}>
        <Pressable onPress={back} accessibilityRole="button" accessibilityLabel={t.closeLabel} hitSlop={4} style={({ pressed }) => ({ width: 40, height: 40, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}>
          <View style={{ width: 11, height: 11, borderStartWidth: 2, borderTopWidth: 2, borderColor: tokens.fg, transform: [{ rotate: "-45deg" }], marginStart: 4 }} />
        </Pressable>
        <Text size={17} weight="700" style={{ flex: 1 }} numberOfLines={1}>{t.statsPageTitle}</Text>
        {/* 🆕 D-1214 — ترويسةُ `/stats`: مشاركةٌ ثمّ ⋯ المدى (`StatsRangeMenu`) — لإحصاءاتي وحدَها (لا مدى للزائر) */}
        {mine && d?.person.username ? <HeadBtn icon="share" label={t.shareLinkLabel} onPress={shareMine} /> : null}
        {mine ? (
          <HeadBtn
            icon="dots"
            label={t.statsRangeMenu}
            onPress={() => {
              haptic.pick();
              setRangeSheet(true);
            }}
          />
        ) : null}
      </View>

      {!d ? (
        q.isError ? (
          <View style={{ alignItems: "center", gap: 12, paddingTop: 48, paddingHorizontal: PAGE_PAD }}>
            <Text muted style={{ textAlign: "center" }}>{q.error instanceof ApiError && q.error.status === 404 ? t.userNotFound : t.apiInternal}</Text>
            <Button label={t.errorRetry} variant="ghost" onPress={() => void q.refetch()} />
          </View>
        ) : (
          <View style={{ paddingHorizontal: PAGE_PAD, gap: 16 }}>
            <View style={{ height: 230, borderRadius: radius.card, backgroundColor: tokens.surface2 }} />
            <View style={{ height: 320, borderRadius: radius.card, backgroundColor: tokens.surface2 }} />
          </View>
        )
      ) : (
        <ScrollView refreshControl={refresh} contentContainerStyle={{ paddingHorizontal: PAGE_PAD, paddingBottom: insets.bottom + 40, gap: 20 }}>
          {d.locked ? (
            <View style={{ marginTop: 20, padding: 20, borderRadius: radius.card, borderWidth: 1, borderColor: tokens.border, alignItems: "center", gap: 8 }}>
              <Icon name="shield" size={24} color={tokens.muted} />
              <Text size={15} weight="700">{t.privateCoverTitle}</Text>
              <Text size={13} muted style={{ textAlign: "center" }}>{t.privateCoverHint}</Text>
            </View>
          ) : d.empty ? (
            <Text size={14} muted style={{ textAlign: "center", paddingVertical: 40 }}>{mine ? t.analysisEmpty : t.analysisEmptyOther}</Text>
          ) : (
            <>
              <HeroCard d={d} rangeLabel={d.range_label || t.statsAllTime} />
              {d.taste ? <TasteCard d={d} mine={mine} onMatch={() => setSheet({ kind: "match" })} onAll={(title, all) => setSheet({ kind: "all", title, all })} onWorks={(title, works, total) => setSheet({ kind: "works", title, works, total })} /> : null}
            </>
          )}
          {/* 🆕 D-1214 — بابُ «تقاريرك» صفٌّ في الذيل لا رمزٌ ثالثٌ في الترويسة (D-796)، ورقاقةُ PLUS تقول ما يقوله الويب (D-803) */}
          {mine && !d.empty ? <ReportsDoor onPress={() => openWeb("/reports")} /> : null}
        </ScrollView>
      )}

      {rangeSheet ? (
        <Sheet title={t.statsRangeMenu} onClose={() => setRangeSheet(false)}>
          {(
            [
              { key: "all", label: t.statsRangeAll },
              { key: "year", label: String(new Date().getUTCFullYear()) },
              { key: "month", label: t.statsRangeMonth },
            ] as const
          ).map((it, i) => (
            <Pressable
              key={it.key}
              onPress={() => {
                setRangeSheet(false);
                if (it.key !== range) {
                  haptic.pick();
                  setRange(it.key);
                }
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: range === it.key }}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderTopWidth: i ? 1 : 0, borderTopColor: tokens.divider, opacity: pressed ? 0.7 : 1 })}
            >
              <Text size={14} weight="600" style={{ flex: 1 }} numberOfLines={1}>{it.label}</Text>
              {range === it.key ? <Icon name="check-line" size={18} color={tokens.accent} /> : null}
            </Pressable>
          ))}
        </Sheet>
      ) : null}
      {sheet?.kind === "all" ? (
        <Sheet title={sheet.title} onClose={() => setSheet(null)}>
          <Text size={12} muted style={{ marginBottom: 10 }}>
            {sheet.all.total > sheet.all.items.length ? t.entriesShownOf(num(sheet.all.items.length, locale), num(sheet.all.total, locale)) : num(sheet.all.total, locale)}
          </Text>
          <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ gap: 10, paddingBottom: 8 }}>
            {sheet.all.items.map((e) => (
              <EntryFace key={e.name} e={e} />
            ))}
          </ScrollView>
        </Sheet>
      ) : null}
      {sheet?.kind === "works" ? (
        <WorksSheet
          title={sheet.title}
          works={sheet.works}
          total={sheet.total}
          onClose={() => setSheet(null)}
          onTitle={(k, id) => {
            setSheet(null);
            openTitle(k, id);
          }}
        />
      ) : null}
      {sheet?.kind === "match" && d?.match ? (
        <MatchSheet
          d={d}
          onClose={() => setSheet(null)}
          onPlus={() => {
            setSheet(null);
            openWeb("/plus");
          }}
          onTitle={(k, id) => {
            setSheet(null);
            openTitle(k, id);
          }}
        />
      ) : null}
    </View>
  );
}

/** «١٢ ساعة» حتى اليوم، ثمّ «٣ يوم» — `fmtWatchTime` الويب بحرفه */
function fmtWatchTime(minutes: number, t: ReturnType<typeof useApp>["t"]) {
  const h = Math.round(minutes / 60);
  return h < 24 ? t.hours(h) : t.days(Math.floor(h / 24));
}

/* ——————————————————— بطاقةُ صاحبها ——————————————————— */

/** زرٌّ في ترويسة الشاشة — مقاسُ زرِّ الرجوع نفسِه (٤٠) */
function HeadBtn({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const { tokens } = useApp();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={4} style={({ pressed }) => ({ width: 40, height: 40, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}>
      <Icon name={icon} size={20} color={tokens.fg} />
    </Pressable>
  );
}

/** بابُ «تقاريرك» — `Link` ذيل `/stats` في الويب بنصّه (D-796/D-803): أيقونةٌ · سطران · رقاقةُ PLUS */
function ReportsDoor({ onPress }: { onPress: () => void }) {
  const { tokens, locale } = useApp();
  const en = locale === "en";
  return (
    <Pressable onPress={onPress} accessibilityRole="link" style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius.card, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, opacity: pressed ? 0.7 : 1 })}>
      <Icon name="chart" size={18} color={tokens.accent} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size={14} weight="700">{en ? "Your reports" : "تقاريرك"}</Text>
        <Text size={12} muted style={{ marginTop: 2 }}>{en ? "Your week, month and year." : "أسبوعك وشهرك وسنتك."}</Text>
      </View>
      {/* `PlusPill` الويب: «PLUS» علامةٌ لا تُترجم، بلون التمييز على أرضيّته الشفيفة */}
      <View style={{ paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, backgroundColor: tokens.accent + "26" }}>
        <Text size={12} weight="700" color={tokens.accent} style={{ writingDirection: "ltr", letterSpacing: 0.5 }}>PLUS</Text>
      </View>
    </Pressable>
  );
}

function HeroCard({ d, rangeLabel }: { d: MemberStatsPayload; rangeLabel: string }) {
  const { t, tokens, locale } = useApp();
  const name = displayNameOf(d.person, t.anonymousUser);
  const cells: { icon: IconName; value: number; label: string }[] = [
    { icon: "tv", value: d.totals.shows, label: t.statsCellShows },
    { icon: "film", value: d.totals.movies, label: t.statsCellMoviesWatched },
    { icon: "play", value: d.totals.episodes, label: t.statsCellEpisodesWatched },
    { icon: "comment", value: d.totals.reviews, label: t.statsCellComments },
  ];
  return (
    <View style={{ borderRadius: radius.card, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, overflow: "hidden" }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 16 }}>
        {d.hero_posters.length ? (
          <>
            <View style={[StyleSheet.absoluteFill, { flexDirection: "row" }]} pointerEvents="none">
              {d.hero_posters.map((p) => {
                const uri = posterFor(p, 180);
                return uri ? <Image key={p} source={{ uri }} style={{ flex: 1 }} contentFit="cover" cachePolicy="memory-disk" /> : <View key={p} style={{ flex: 1 }} />;
              })}
            </View>
            {/* الحجابُ لونُ البطاقة نفسُه (`--art-veil`) — يصحّ في «النهاري» من الرمز */}
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: tokens.surface, opacity: 0.72 }]} />
          </>
        ) : null}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, overflow: "hidden", borderWidth: 1, borderColor: tokens.accent + "B3", backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
            {!d.person.hide_name && d.person.avatar_url ? (
              <Image source={{ uri: d.person.avatar_url }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" />
            ) : (
              <Icon name="people" size={20} color={tokens.muted} />
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Text size={17} weight="700" numberOfLines={1} style={{ flexShrink: 1 }}>{name}</Text>
              {d.person.hide_name ? null : <IdentityBadges flags={identityFlags(d.person)} nameSize={17} />}
            </View>
            {d.person.followers != null ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 }}>
                <Icon name="people" size={13} color={tokens.muted} />
                <Text size={12} muted>{t.suggestFollowers(d.person.followers)}</Text>
              </View>
            ) : null}
          </View>
        </View>
        {d.person.bio ? (
          <Text size={13} numberOfLines={2} style={{ marginTop: 8, lineHeight: 18, maxWidth: "62%" }}>{d.person.bio}</Text>
        ) : null}
        {/* وقتُ المشاهدة في الزاوية المقابلة (D-721/D-724) */}
        <View style={{ marginTop: 28, alignItems: "flex-end" }}>
          <Text size={30} weight="600" style={{ lineHeight: 34, fontVariant: ["tabular-nums"] }}>{fmtWatchTime(d.totals.minutes, t)}</Text>
          <Text size={12} muted style={{ marginTop: 4 }}>{`${t.statWatchTime} · ${rangeLabel}`}</Text>
        </View>
      </View>
      <View style={{ height: 1, backgroundColor: tokens.accent }} />
      <View style={{ flexDirection: "row" }}>
        {cells.map((c, i) => (
          <View key={c.label} style={{ flex: 1, minWidth: 0, alignItems: "center", gap: 4, paddingVertical: 10, paddingHorizontal: 4, borderStartWidth: i ? 1 : 0, borderStartColor: tokens.divider }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Icon name={c.icon} size={15} color={tokens.accent} />
              <Text size={16} weight="700" style={{ fontVariant: ["tabular-nums"] }}>{num(c.value, locale)}</Text>
            </View>
            <Text size={11} muted numberOfLines={1}>{c.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ——————————————————— بطاقةُ الذوق ——————————————————— */

type CellRow = { name: string; value: string; unit?: string; ltr?: boolean; works: MemberTasteWork[]; total: number };

function TasteCard({
  d,
  mine,
  onMatch,
  onAll,
  onWorks,
}: {
  d: MemberStatsPayload;
  /** صاحبُ الأرقام يقرؤها ⇐ «ذوقك» (ضميرُ `AnalysisView.mine` — D-649) */
  mine: boolean;
  onMatch: () => void;
  onAll: (title: string, all: MemberTasteList) => void;
  onWorks: (title: string, works: MemberTasteWork[], total: number) => void;
}) {
  const { t, tokens, locale } = useApp();
  const taste = d.taste!;
  /** «٣ أعمال» — `worksParts` الويب نفسُها: الرقمُ قيمةٌ والكلمةُ وحدتُها */
  const works = (n: number) => worksParts(n, t, locale);
  type CellKey = keyof MemberTaste["all"];
  const cells = ([
    { key: "genres", title: t.tasteGenres, rows: taste.genres.map((g) => ({ name: g.name, value: `${g.pct}%`, works: g.works, total: g.total })) },
    { key: "decades", title: t.tasteYears, rows: taste.decades.map((g) => ({ name: g.label, value: `${g.pct}%`, ltr: true, works: g.works, total: g.total })) },
    { key: "languages", title: t.tasteLanguages, rows: taste.languages.map((g) => ({ name: g.name, ...works(g.titles), works: g.works, total: g.total })) },
    { key: "countries", title: t.tasteDiversity, rows: taste.countries.map((g) => ({ name: g.name, ...works(g.titles), works: g.works, total: g.total })) },
    { key: "directors", title: t.tasteDirectors, rows: taste.directors.map((g) => ({ name: g.name, ...works(g.titles), works: g.works, total: g.total })) },
    { key: "actors", title: t.tasteActors, rows: taste.actors.map((g) => ({ name: g.name, ...works(g.titles), works: g.works, total: g.total })) },
  ] satisfies { key: CellKey; title: string; rows: CellRow[] }[]).filter((c) => c.rows.length > 0);
  return (
    <View style={{ borderRadius: radius.card, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, paddingHorizontal: 16, paddingVertical: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Icon name="sparkles" size={20} color={tokens.accent} />
        <Text size={17} weight="700" numberOfLines={1} style={{ flex: 1 }}>{mine ? t.analysisTaste : t.analysisTasteOther}</Text>
        {d.match ? (
          <Pressable onPress={onMatch} accessibilityRole="button" hitSlop={6} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 5, height: 28, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.border, opacity: pressed ? 0.7 : 1 })}>
            <Text size={12} weight="700" color={tokens.accent} style={{ fontVariant: ["tabular-nums"] }}>{`${num(d.match.pct, locale)}%`}</Text>
            <Text size={12} muted>{t.tasteMatchLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 6 }}>
        {cells.map((c, i) => {
          const all = taste.all[c.key];
          const opens = all.total > c.rows.length;
          const posters = taste.posters[c.key];
          return (
            <View key={c.key} style={{ width: "50%", paddingEnd: i % 2 === 0 ? 8 : 0, paddingStart: i % 2 === 1 ? 8 : 0, paddingVertical: 12, borderTopWidth: i >= 2 ? 1 : 0, borderTopColor: tokens.divider, overflow: "hidden" }}>
              {posters.length ? (
                <View pointerEvents="none" style={[StyleSheet.absoluteFill, { flexDirection: "row", opacity: 0.2 }]}>
                  {posters.map((p) => (
                    <Image key={p} source={{ uri: p }} style={{ flex: 1 }} contentFit="cover" cachePolicy="memory-disk" />
                  ))}
                </View>
              ) : null}
              <Pressable onPress={opens ? () => onAll(c.title, all) : undefined} disabled={!opens} style={({ pressed }) => ({ marginBottom: 6, opacity: pressed ? 0.7 : 1, flexDirection: "row", alignItems: "center", gap: 4 })}>
                <Text size={14}>{c.title}</Text>
                {opens ? <Icon name="list" size={12} color={tokens.muted} /> : null}
              </Pressable>
              <View style={{ gap: 6 }}>
                {c.rows.map((r) => (
                  <Pressable key={r.name} disabled={!r.works.length} onPress={() => onWorks(r.name, r.works, r.total)} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                    <EntryFace e={r} />
                  </Pressable>
                ))}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** صفُّ اسمٍ وقيمته — `TasteRow` الويب: الاسمُ يُقصّ والقيمةُ بلون التمييز في الطرف */
function EntryFace({ e }: { e: MemberTasteEntry }) {
  const { tokens } = useApp();
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
      <Text size={14} numberOfLines={1} style={{ flex: 1, minWidth: 0, writingDirection: e.ltr ? "ltr" : undefined }}>{e.name}</Text>
      <Text size={14} weight="600" color={tokens.accent} style={{ fontVariant: ["tabular-nums"] }}>
        {e.value}
        {e.unit ? <Text size={14} muted>{` ${e.unit}`}</Text> : null}
      </Text>
    </View>
  );
}

function WorksSheet({
  title,
  works,
  total,
  onClose,
  onTitle,
}: {
  title: string;
  works: MemberTasteWork[];
  total: number;
  onClose: () => void;
  onTitle: (k: "tv" | "movie", id: number) => void;
}) {
  const { t, locale } = useApp();
  const { width } = useWindowDimensions();
  const cols = 3;
  const gap = 10;
  const w = Math.floor((width - 40 - gap * (cols - 1)) / cols);
  return (
    <Sheet title={title} onClose={onClose}>
      <Text size={12} muted style={{ marginBottom: 10 }}>
        {total > works.length ? t.worksShownOf(num(works.length, locale), num(total, locale)) : num(total, locale)}
      </Text>
      <ScrollView style={{ maxHeight: 540 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
          {works.map((x) => (
            <PosterCard
              key={`${x.mediaType}-${x.tmdbId}`}
              item={{ key: `${x.mediaType}-${x.tmdbId}`, kind: x.mediaType, id: x.tmdbId, title: x.title, posterPath: x.poster, progress: 0, completed: false, dropped: false }}
              width={w}
              marquee={false}
              onPress={(it) => onTitle(it.kind, it.id)}
            />
          ))}
        </View>
      </ScrollView>
    </Sheet>
  );
}

/* ——————————————————— «أنت وهو» ——————————————————— */

function Bar({ pct, on }: { pct: number; on: boolean }) {
  const { tokens } = useApp();
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: tokens.surface2, overflow: "hidden" }}>
      <View style={{ width: `${Math.min(100, pct)}%`, height: "100%", borderRadius: 3, backgroundColor: on ? tokens.accent : tokens.muted }} />
    </View>
  );
}

function MatchSheet({
  d,
  onClose,
  onPlus,
  onTitle,
}: {
  d: MemberStatsPayload;
  onClose: () => void;
  onPlus: () => void;
  onTitle: (k: "tv" | "movie", id: number) => void;
}) {
  const { t, tokens, locale } = useApp();
  const m = d.match!;
  const ar = locale !== "en";
  const name = displayNameOf(d.person, t.anonymousUser);
  const locked = (
    <View>
      {m.shared.length ? (
        <View style={{ marginTop: 22 }}>
          <Text size={14} weight="700">{ar ? "تجتمعان على" : "You both watch"}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4, marginBottom: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.accent }} />
              <Text size={12} muted>{ar ? "أنت" : "You"}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.muted }} />
              <Text size={12} muted numberOfLines={1}>{name}</Text>
            </View>
          </View>
          <View style={{ gap: 10 }}>
            {m.shared.map((r) => (
              <View key={r.name} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Text size={14} numberOfLines={2} style={{ width: "30%", lineHeight: 17 }}>{r.name}</Text>
                <View style={{ flex: 1, gap: 4 }}>
                  <Bar pct={r.mine} on />
                  <Bar pct={r.theirs} on={false} />
                </View>
                <View style={{ width: 52, alignItems: "flex-end" }}>
                  <Text size={12} weight="700" color={tokens.accent} style={{ fontVariant: ["tabular-nums"] }}>{`${num(r.mine, locale)}%`}</Text>
                  <Text size={12} muted style={{ fontVariant: ["tabular-nums"] }}>{`${num(r.theirs, locale)}%`}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}
      {m.apart.length ? (
        <View style={{ marginTop: 22 }}>
          <Text size={14} weight="700" style={{ marginBottom: 10 }}>{ar ? "وتفترقان في" : "Where you differ"}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {m.apart.map((r) => (
              <View key={r.name} style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface }}>
                <Text size={12}>{r.name}</Text>
                <Text size={12} muted>{" · "}</Text>
                <Text size={12} weight="700" color={tokens.accent}>{`${num(r.mine, locale)}%`}</Text>
                <Text size={12} muted>{" / "}</Text>
                <Text size={12} muted>{`${num(r.theirs, locale)}%`}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
      {m.picks.length ? (
        <View style={{ marginTop: 24 }}>
          <Text size={14} weight="700" style={{ marginBottom: 10 }}>{ar ? "في مكتبته وليست عندك" : "In their library, not yours"}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {m.picks.map((p) => (
              <PosterCard
                key={`${p.media_type}-${p.tmdb_id}`}
                item={{ key: `${p.media_type}-${p.tmdb_id}`, kind: p.media_type, id: p.tmdb_id, title: p.title, posterPath: p.poster_path, progress: 0, completed: false, dropped: false }}
                width={104}
                marquee={false}
                onPress={(it) => onTitle(it.kind, it.id)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
  return (
    <Sheet title={ar ? `أنت و${name}` : `You and ${name}`} onClose={onClose}>
      <ScrollView style={{ maxHeight: 560 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 12 }}>
          <Text size={52} weight="700" color={tokens.accent} style={{ lineHeight: 56, fontVariant: ["tabular-nums"] }}>{`${num(m.pct, locale)}%`}</Text>
          <Text size={14} muted>{t.tasteMatchLabel}</Text>
        </View>
        <Text size={12} muted style={{ marginTop: 8, lineHeight: 18 }}>
          {ar ? "محسوبٌ من حصص الأنواع في مكتبتيكما — لا من الأعمال نفسها." : "Measured from the genre mix of both libraries — not the titles themselves."}
        </Text>
        {m.plus ? (
          locked
        ) : (
          /* 🔒 `PlusPreview`: التفصيلُ يُرى باهتاً تحت بوّابة البلس — لا ضبابيّةَ في التطبيق فالخفوتُ يقوم مقامها */
          <View style={{ marginTop: 4 }}>
            <View pointerEvents="none" style={{ opacity: 0.18, maxHeight: 300, overflow: "hidden" }}>{locked}</View>
            <View style={{ alignItems: "center", gap: 8, marginTop: 16 }}>
              <Icon name="star" size={24} color={tokens.accent} />
              <Text size={15} weight="700" style={{ textAlign: "center" }}>{t.plusGateTitle}</Text>
              <Button size="sm" label={t.plusLearnMore} onPress={onPlus} />
            </View>
          </View>
        )}
      </ScrollView>
    </Sheet>
  );
}
