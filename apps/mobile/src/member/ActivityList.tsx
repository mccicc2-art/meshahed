import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon } from "../icons";
import { haptic } from "../haptics";
import { Chip } from "../library/Chip";
import { num } from "@/core/i18n";
import { SCOPES, clock, dayKey, episodeOf, groupDays, keep, label as scopeLabel, shiftDay, verbOf, type ActivityItem, type Scope } from "@/core/activityDays";
import type { ProfileActivity } from "@/core/contracts/profile";

/**
 * 🆕 D-1213 — **قائمةُ النشاط مكوّنٌ واحدٌ لشاشتين** (القاعدة ٣): تبويبُ «النشاط» في ملفّ الشخص (N1) وشاشةُ «النشاط»
 * الأصليّة (`/activity` — سجلُّك أنت). نُقلت من `ProfileScreen` بحرفها؛ الفرقُ الوحيد نصُّ الفراغ (لكلِّ شاشةٍ جملتُها).
 */
const PAGE_PAD = 16;

/** النشاط — شاشةُ `/activity` بقواعدها (`core/activityDays` — الويبُ يقرأ الملفَّ نفسَه): الرقاقات · حصيلةُ الأسبوع · الأيّام */
export function ActivityList({ rows, onTitle, emptyText }: { rows: ProfileActivity[]; onTitle: (k: "tv" | "movie", id: number) => void; emptyText: string }) {
  const { t, tokens, locale } = useApp();
  const [scope, setScope] = useState<Scope>("all");
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
      })),
    [rows],
  );
  const matching = items.filter((it) => keep(it, scope));
  const today = dayKey(new Date().toISOString(), true);
  const weekCount = matching.filter((it) => dayKey(it.at, true) >= shiftDay(today, -6)).length;
  const days = groupDays(matching, true, t, locale, today);
  return (
    <View style={{ paddingHorizontal: PAGE_PAD, paddingTop: 14 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {SCOPES.map((s) => (
          <Chip key={s} label={scopeLabel(s, t)} active={scope === s} onPress={() => (s === scope ? undefined : (haptic.pick(), setScope(s)))} />
        ))}
      </ScrollView>
      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: tokens.divider, marginTop: 10 }}>
        <Text size={13} muted>{t.activityThisWeek}</Text>
        <Text size={13} muted style={{ fontVariant: ["tabular-nums"] }}>{t.activityCount(weekCount)}</Text>
      </View>
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
                  <Pressable key={r.id} onPress={() => onTitle(r.mediaType, r.tmdbId)} accessibilityRole="link" style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, opacity: pressed ? 0.7 : 1 }]}>
                    <View style={{ position: "absolute", start: -19, width: 9, height: 9, borderRadius: 5, borderWidth: 1, borderColor: tokens.divider, backgroundColor: tokens.bg }} />
                    <View style={{ width: 44, aspectRatio: 2 / 3, borderRadius: 6, overflow: "hidden", backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
                      {r.poster ? <Image source={{ uri: r.poster }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" /> : <Icon name={r.mediaType === "tv" ? "tv" : "film"} size={14} color={tokens.muted} />}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text size={14} numberOfLines={1}>
                        <Text size={14} muted>{verbOf(r, t)} </Text>
                        <Text size={14} weight="700">{r.title}</Text>
                        {ep ? <Text size={14} muted> · {ep}</Text> : null}
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
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))
      )}
    </View>
  );
}
