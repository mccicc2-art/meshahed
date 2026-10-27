import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Icon } from "../icons";
import { haptic } from "../haptics";
import { Chip } from "../library/Chip";
import { Sheet } from "../library/Sheet";
import { StatusPill } from "../settings/ui";
import { num } from "@/core/i18n";
import { SCOPES, clock, dayKey, dayLabel, episodeOf, groupDays, keep, label as scopeLabel, shiftDay, verbOf, watchSummary, type ActivityItem, type Scope, type WatchSource } from "@/core/activityDays";
import type { ProfileActivity } from "@/core/contracts/profile";

/**
 * 🆕 D-1213 — **قائمةُ النشاط مكوّنٌ واحدٌ لشاشتين** (القاعدة ٣): تبويبُ «النشاط» في ملفّ الشخص (N1) وشاشةُ «النشاط»
 * الأصليّة (`/activity` — سجلُّك أنت). نُقلت من `ProfileScreen` بحرفها؛ الفرقُ الوحيد نصُّ الفراغ (لكلِّ شاشةٍ جملتُها).
 */
const PAGE_PAD = 16;

/** النشاط — شاشةُ `/activity` بقواعدها (`core/activityDays` — الويبُ يقرأ الملفَّ نفسَه): الرقاقات · حصيلةُ الأسبوع · الأيّام */
/**
 * 🆕 D-1504 — **سجلُّ المشاهدة** (تصميمُ «أ»، اختيارُ أحمد ٢٧ أكتوبر). ثلاثةُ أشياءَ تُضاف ولا يتغيّر غيرُها:
 * - `initialScope` — بابُ «سجلّ المشاهدة» في القائمة الجانبيّة يفتح الشاشةَ نفسَها على رقاقة «مشاهدة» (`/activity?scope=watch`)؛
 *   لا شاشةَ ثانية لسجلٍّ واحد (القاعدة ٣).
 * - على رقاقة «مشاهدة» يصير سطرُ «هذا الأسبوع» **ثلاثةَ أرقام**: حلقات · أفلام · ساعات — والصفُّ المدموجُ يكتب عددَ حلقاته.
 * - `onRemove` — **سجلُّك وحدَه**: ضغطةٌ مطوّلةٌ على صفِّ مشاهدةٍ تفتح الورقةَ الواحدة (`Sheet`) بـ«صفحة العمل» و«ما شفتها،
 *   احذفها من السجل» بتأكيدٍ في الوسط (وصفةُ `FeedMenu`، D-1448) — **لأن التسجيلَ التلقائيّ قادم، ومن يرى خطأً لا يقدر
 *   على تصحيحه يفقد الثقةَ بالسجلّ كلِّه**. ملفُّ غيرك بلا `onRemove` فلا ضغطةَ مطوّلة.
 */
export function ActivityList({
  rows,
  onTitle,
  emptyText,
  initialScope = "all",
  onRemove,
  onMoveDay,
}: {
  rows: ProfileActivity[];
  onTitle: (k: "tv" | "movie", id: number) => void;
  emptyText: string;
  initialScope?: Scope;
  /** يرجع `true` إن حُذف — والفشلُ يقوله صاحبُ الشاشة بنخبه ويُبقي الورقةَ مفتوحة لمحاولةٍ ثانية */
  onRemove?: (item: ActivityItem) => Promise<boolean>;
  /** 🆕 D-1505 — «غيّر يوم المشاهدة»: إزاحةُ أيّام (سالبةٌ إلى الماضي) — سجلُّك وحدَه، كـ`onRemove` */
  onMoveDay?: (item: ActivityItem, shiftDays: number) => Promise<boolean>;
}) {
  const { t, tokens, locale } = useApp();
  const [scope, setScope] = useState<Scope>(initialScope);
  const [menu, setMenu] = useState<ActivityItem | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [moving, setMoving] = useState(false);
  const [busy, setBusy] = useState(false);
  const closeMenu = () => {
    setMenu(null);
    setConfirm(false);
    setMoving(false);
  };
  /* 🆕 D-1505 — الأيّامُ السبعة الأخيرة: يومُ الصفِّ مختارٌ، والضغطُ على غيره يزيح بالفرق */
  const moveTo = async (key: string) => {
    if (!menu || !onMoveDay || busy) return;
    const from = dayKey(menu.at, true);
    const toDate = (k: string) => {
      const [y, m, d] = k.split("-").map(Number);
      return new Date(y, (m ?? 1) - 1, d ?? 1).getTime();
    };
    const shift = Math.round((toDate(key) - toDate(from)) / 86_400_000);
    if (!shift) return;
    setBusy(true);
    try {
      if (await onMoveDay(menu, shift)) {
        haptic.pick();
        closeMenu();
      }
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!menu || !onRemove) return;
    setBusy(true);
    try {
      if (await onRemove(menu)) {
        haptic.pick();
        closeMenu();
      }
    } finally {
      setBusy(false);
    }
  };
  const items: ActivityItem[] = useMemo(
    () =>
      rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        at: r.at,
        mediaType: r.media_type,
        tmdbId: r.tmdb_id,
        title: r.title,
        poster: r.poster,
        season: r.season,
        episode: r.episode,
        rating: r.rating,
        listName: r.list_name,
        runtime: r.runtime ?? null,
        source: r.source ?? null,
      })),
    [rows],
  );
  const matching = items.filter((it) => keep(it, scope));
  const today = dayKey(new Date().toISOString(), true);
  const weekRows = matching.filter((it) => dayKey(it.at, true) >= shiftDay(today, -6));
  const weekCount = weekRows.length;
  const week = scope === "watch" ? watchSummary(weekRows) : null;
  const days = groupDays(matching, true, t, locale, today);
  return (
    <View style={{ paddingHorizontal: PAGE_PAD, paddingTop: 14 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {SCOPES.map((s) => (
          <Chip key={s} label={scopeLabel(s, t)} active={scope === s} onPress={() => (s === scope ? undefined : (haptic.pick(), setScope(s)))} />
        ))}
      </ScrollView>
      {week ? (
        /* 🆕 D-1504 — حصيلةُ المشاهدة بثلاثة أرقام؛ والساعاتُ تغيب إن لم تصل مدّة (لا صفرَ كاذب) */
        <View style={{ flexDirection: "row", marginTop: 12, borderRadius: 16, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, padding: 14, gap: 8 }}>
          {[
            { n: week.episodes, label: t.activityWeekEpisodes },
            { n: week.movies, label: t.activityWeekMovies },
            ...(week.hours != null ? [{ n: week.hours, label: t.activityWeekHours }] : []),
          ].map((x) => (
            <View key={x.label} style={{ flex: 1, gap: 2 }}>
              <Text size={20} weight="800" style={{ fontVariant: ["tabular-nums"] }}>{num(x.n, locale)}</Text>
              <Text size={12} muted numberOfLines={1}>{x.label}</Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: tokens.divider, marginTop: 10 }}>
          <Text size={13} muted>{t.activityThisWeek}</Text>
          <Text size={13} muted style={{ fontVariant: ["tabular-nums"] }}>{t.activityCount(weekCount)}</Text>
        </View>
      )}
      {days.length === 0 ? (
        <Text muted style={{ textAlign: "center", paddingVertical: 40, paddingHorizontal: PAGE_PAD }}>{emptyText}</Text>
      ) : (
        days.map((day) => (
          <View key={day.key} style={{ marginTop: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
              <Text size={15} weight="700">{day.label}</Text>
              <Text size={12} muted style={{ fontVariant: ["tabular-nums"] }}>{num(day.rows.length, locale)}</Text>
            </View>
            <View style={{ borderStartWidth: 1, borderStartColor: tokens.divider, marginStart: 6, paddingStart: 14 }}>
              {day.rows.map((r) => {
                const ep = episodeOf(r, t);
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => onTitle(r.mediaType, r.tmdbId)}
                    onLongPress={onRemove && r.kind === "watch" ? () => (haptic.pick(), setMenu(r)) : undefined}
                    accessibilityRole="link"
                    style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, opacity: pressed ? 0.7 : 1 }]}>
                    <View style={{ position: "absolute", start: -19, width: 9, height: 9, borderRadius: 5, borderWidth: 1, borderColor: tokens.divider, backgroundColor: tokens.bg }} />
                    <View style={{ width: 44, aspectRatio: 2 / 3, borderRadius: 6, overflow: "hidden", backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
                      {r.poster ? <Image source={{ uri: r.poster }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" /> : <Icon name={r.mediaType === "tv" ? "tv" : "film"} size={14} color={tokens.muted} />}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text size={14} numberOfLines={1}>
                        <Text size={14} muted>{verbOf(r, t)} </Text>
                        <Text size={14} weight="700">{r.title}</Text>
                        {ep ? <Text size={14} muted> · {ep}</Text> : null}
                        {(r.eps?.length ?? 0) > 1 ? <Text size={14} weight="700"> · {t.actEpisodesN(r.eps?.length ?? 0)}</Text> : null}
                        {r.kind === "list" && r.listName ? <Text size={14} muted> {t.actVerbTo} {r.listName}</Text> : null}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 }}>
                        {r.rating != null ? (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                            <Icon name="star" size={12} color={tokens.accent} />
                            <Text size={12} weight="700" style={{ fontVariant: ["tabular-nums"] }}>{num(r.rating, locale)}</Text>
                          </View>
                        ) : null}
                        <Text size={12} muted style={{ fontVariant: ["tabular-nums"] }}>{clock(r.at, locale, true)}</Text>
                        {r.source ? <StatusPill label={sourceLabel(r.source, t)} color={r.source === "auto" ? tokens.accent : tokens.muted} /> : null}
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))
      )}
      {menu && moving ? (
        <Sheet title={t.historyMoveDay} onClose={closeMenu} placement="center">
          <Text size={13} muted style={{ lineHeight: 20, marginBottom: 14 }}>{t.historyMoveDayHint}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, opacity: busy ? 0.6 : 1 }}>
            {Array.from({ length: 7 }, (_, i) => shiftDay(today, -i)).map((k, i) => (
              <Chip
                key={k}
                label={i === 0 ? t.diaryToday : i === 1 ? t.diaryYesterday : dayLabel(k, locale)}
                active={k === dayKey(menu.at, true)}
                onPress={() => void moveTo(k)}
              />
            ))}
          </View>
        </Sheet>
      ) : menu && confirm ? (
        <Sheet title={t.historyRemoveAction} onClose={closeMenu} placement="center">
          <Text size={13} muted style={{ lineHeight: 20, marginBottom: 16 }}>{t.historyRemoveConfirm}</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button label={t.cancelLabel} variant="ghost" onPress={closeMenu} />
            <View style={{ flex: 1 }}>
              <Button label={t.historyRemoveAction} variant="danger" busy={busy} onPress={() => void remove()} />
            </View>
          </View>
        </Sheet>
      ) : menu ? (
        <Sheet title={menu.title} onClose={closeMenu}>
          <Pressable
            onPress={() => {
              const m = menu;
              closeMenu();
              onTitle(m.mediaType, m.tmdbId);
            }}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, opacity: pressed ? 0.6 : 1 })}
          >
            <Icon name={menu.mediaType === "tv" ? "tv" : "film"} size={19} color={tokens.fg} />
            <Text size={14}>{t.postMenuOpenTitle(menu.title)}</Text>
          </Pressable>
          {onMoveDay ? (
            <Pressable onPress={() => setMoving(true)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, opacity: pressed ? 0.6 : 1 })}>
              <Icon name="calendar" size={19} color={tokens.fg} />
              <Text size={14}>{t.historyMoveDay}</Text>
            </Pressable>
          ) : null}
          <View style={{ height: 1, backgroundColor: tokens.divider, marginVertical: 4 }} />
          <Pressable onPress={() => setConfirm(true)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, opacity: pressed ? 0.6 : 1 })}>
            <Icon name="trash" size={19} color={tokens.error} />
            <Text size={14} color={tokens.error}>{t.historyRemove}</Text>
          </Pressable>
        </Sheet>
      ) : null}
    </View>
  );
}

/** 🆕 D-1505 — اسمُ المصدر في شارة الصفّ */
function sourceLabel(s: WatchSource, t: ReturnType<typeof useApp>["t"]): string {
  return s === "stremio" ? t.srcStremio : s === "widget" ? t.srcWidget : s === "import" ? t.srcImport : t.srcAuto;
}
