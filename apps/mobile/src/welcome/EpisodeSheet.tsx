import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import type { WelcomeSeasonsPayload, WelcomeSeedItem, WelcomeUpTo } from "@/core/contracts/welcome";
import { api } from "../api";
import { haptic } from "../haptics";
import { Sheet } from "../library/Sheet";
import { posterFor } from "../poster";
import { useApp } from "../state";
import { radius, space } from "../theme";
import { Button, Text } from "../ui";

/**
 * ====== ورقةُ «أين وصلت» — المواسمُ ثمّ الحلقات (D-1347) ======
 *
 * قرارُ أحمد ١٠ أكتوبر (بصورةٍ وافق عليها): «اللي يضغط على مسلسل اني بدأته يظهر له المواسم والحلقات» —
 * يضغط **آخرَ حلقةٍ شاهدها** فيُعلَّم كلُّ ما قبلها (المواسمُ السابقةُ كاملةً وهذا الموسمُ حتى حلقتِه)، أو
 * «ما أتذكر — بدأته فقط» فيبقى «بدأته» بلا حلقة (D-1342).
 *
 * 🔑 **الورقةُ الواحدة** (`library/Sheet` — القاعدة ٣) بمحتوى جديد، لا ورقةٌ ثانية. **وأرقامٌ لا أسماء**: الحلقاتُ
 * `first … first + count − 1` كما يحسبها الخادمُ بقاعدتَي الختم الكامل — فما يُضغط هو ما يُكتب، في الترقيم النسبيّ
 * والمطلق (One Piece: الموسمُ الأخيرُ يبدأ من ١١٥٦).
 *
 * ⚖️ **لا شيءَ يُكتب هنا**: الاختيارُ يعود للشاشة ويُرسل مع «يالله نبدأ» (كلُّ الترحيب يُكتب في آخر خطوة — D-126).
 */
const COLS = 7;
const GAP = 8;
const PAD = 16;

export function EpisodeSheet({
  seed,
  value,
  onPick,
  onClose,
}: {
  seed: WelcomeSeedItem;
  value: WelcomeUpTo | null;
  /** موضعٌ اختير، أو `null` = «ما أتذكر — بدأته فقط» */
  onPick: (v: WelcomeUpTo | null) => void;
  onClose: () => void;
}) {
  const { t, tokens } = useApp();
  const { width, height } = useWindowDimensions();
  const q = useQuery({
    queryKey: ["welcome", "seasons", seed.id],
    queryFn: async () => (await api<WelcomeSeasonsPayload>(`/api/v1/welcome/seasons?id=${seed.id}`)).data.seasons,
    staleTime: 10 * 60_000,
    retry: 1,
  });
  const seasons = useMemo(() => q.data ?? [], [q.data]);

  const [season, setSeason] = useState<number | null>(value?.season ?? null);
  const [pick, setPick] = useState<WelcomeUpTo | null>(value);
  /* أوّلُ موسمٍ يُفتح حين تصل القائمة — من له اختيارٌ سابقٌ يجد موسمَه */
  useEffect(() => {
    if (season === null && seasons.length) setSeason(seasons[0].season);
  }, [season, seasons]);

  const cur = seasons.find((s) => s.season === season) ?? null;
  /* كم حلقةً يكتبها هذا الاختيار: ما قبل موسمِه كاملاً + موسمُه حتى حلقتِه — العدُّ نفسُه الذي يجريه الخادم */
  const total = useMemo(() => {
    if (!pick) return 0;
    let n = 0;
    for (const s of seasons) {
      if (s.season < pick.season) n += s.count;
      else if (s.season === pick.season) n += Math.max(0, Math.min(s.count, pick.episode - s.first + 1));
    }
    return n;
  }, [pick, seasons]);

  const cell = Math.floor((width - PAD * 2 - GAP * (COLS - 1)) / COLS);
  const url = posterFor(seed.posterPath, 56);
  const tint = withAlpha(tokens.accent, 0.16);

  return (
    <Sheet
      title={seed.title}
      onClose={onClose}
      header={
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
          <View style={{ width: 44, height: 66, borderRadius: 6, overflow: "hidden", backgroundColor: tokens.surface2 }}>
            {url ? <Image source={{ uri: url }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" /> : null}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text size={16} weight="700" numberOfLines={1}>{seed.title}</Text>
            <Text size={13} muted numberOfLines={1} style={{ marginTop: 2 }}>{t.obUpToHint}</Text>
          </View>
        </View>
      }
    >
      {q.isLoading ? (
        <View style={{ height: 160, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={tokens.accent} />
        </View>
      ) : seasons.length === 0 ? (
        /* القائمةُ لم تصل (شبكة) أو لا موسمَ معروضاً: لا موضعَ يُختار — يبقى «بدأته فقط» وهو صادق */
        <View style={{ gap: space.md, alignItems: "center", paddingVertical: space.lg }}>
          <Text size={13} muted style={{ textAlign: "center", lineHeight: 20 }}>{t.obLoadFailed}</Text>
          {q.isError ? <Button label={t.errorRetry} variant="ghost" size="sm" busy={q.isFetching} onPress={() => void q.refetch()} /> : null}
        </View>
      ) : (
        /* ما لا يتّسع يُمرَّر داخل الورقة (موسمٌ بمئة حلقة) — والزرّان تحته لا يُقصّان */
        <ScrollView style={{ maxHeight: Math.round(height * 0.46) }} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: space.md }}>
          <Text size={12} weight="600" muted>{t.obUpToSeason}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP }}>
            {seasons.map((s) => {
              const on = s.season === season;
              /* موسمٌ قبل موسمِ الاختيار مشاهَدٌ كلُّه — علامتُه تقول ذلك قبل أن يُفتح */
              const whole = !!pick && s.season < pick.season;
              return (
                <Pressable
                  key={s.season}
                  onPress={() => {
                    haptic.pick();
                    setSeason(s.season);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={t.seasonLabel(s.season)}
                  style={{ minWidth: 44, height: 44, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center", borderColor: on ? tokens.accent : whole ? tokens.fg : tokens.border, backgroundColor: on ? tokens.accent : tokens.bg }}
                >
                  <Text size={14} weight="600" color={on ? tokens.onAccent : whole ? tokens.fg : tokens.muted}>{whole && !on ? `${s.season} ✓` : String(s.season)}</Text>
                </Pressable>
              );
            })}
          </View>

          {cur ? (
            <>
              <Text size={12} weight="600" muted style={{ marginTop: space.xs }}>{t.obUpToEpisodesOf(cur.season)}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP }}>
                {Array.from({ length: cur.count }, (_, i) => cur.first + i).map((e) => {
                  const here = !!pick && pick.season === cur.season;
                  const last = here && pick.episode === e;
                  /* ما يُعلَّم: كلُّ حلقات موسمٍ قبل موسمِ الاختيار، وما قبل الحلقة المختارة في موسمها */
                  const marked = !!pick && (pick.season > cur.season || (here && e < pick.episode));
                  return (
                    <Pressable
                      key={e}
                      onPress={() => {
                        haptic.pick();
                        setPick({ season: cur.season, episode: e });
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: last }}
                      accessibilityLabel={`${t.seasonLabel(cur.season)} · ${e}`}
                      style={{ width: cell, height: cell, borderRadius: radius.control, borderWidth: 1, alignItems: "center", justifyContent: "center", borderColor: last || marked ? tokens.accent : tokens.border, backgroundColor: last ? tokens.accent : marked ? tint : tokens.surface }}
                    >
                      <Text size={e > 999 ? 11 : 14} weight="600" color={last ? tokens.onAccent : marked ? tokens.accent : tokens.muted} style={{ fontVariant: ["tabular-nums"] }}>{String(e)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}
        </ScrollView>
      )}

      <View style={{ gap: space.md }}>
        {seasons.length > 0 ? (
          <Text size={13} muted style={{ textAlign: "center", lineHeight: 20 }}>{pick ? t.obUpToCount(total) : t.obUpToPick}</Text>
        ) : null}
        <Button label={t.obUpToDone} disabled={!pick} onPress={() => pick && onPick(pick)} style={{ minHeight: 52 }} />
        <Pressable onPress={() => onPick(null)} hitSlop={8} accessibilityRole="button" style={{ alignSelf: "center", paddingVertical: 4 }}>
          <Text size={13} muted>{t.obUpToForgot}</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

/** لونُ الثيم بشفافيّة — `#rrggbb` يصير `rgba`؛ ما ليس كذلك يعود كما هو */
function withAlpha(hex: string, a: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
