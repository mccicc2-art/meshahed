import React, { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, qk, write } from "../api";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon } from "../icons";
import { Chip } from "../library/Chip";
import { radius } from "../theme";
import { episodeKey } from "@/core/keys";
import type { SeasonPayload, SetSeasonBody, ToggleEpisodeBody, TrackResult, TvTitlePayload, WatchUpToBody } from "../contracts";

/**
 * ====== المواسمُ والحلقات — نسخةُ `EpisodeTracker` (الويب) بحدود D1 ======
 * (Phase 11-D · D-956)
 *
 * 🔑 **أكورديونُ المواسم كما في الصفحة**: صفُّ الموسم (الاسم · المشاهَد/المبثوث ·
 * ✓ أخضر إن اكتمل) يُفتح فيجلب حلقاتِه من `GET /api/v1/title/tv/{id}/season/{n}`
 * — **جلبٌ عند الفتح لا قبله** (الموسمُ المغلق لا يكلّف نداءً)، ورقاقةُ «شاهدته
 * كاملاً» للموسم (`track/season`). **الحلقةُ**: رقمٌ · اسمٌ · تاريخٌ · دائرةُ ✓ —
 * ضغطةٌ تبدّلها (`track/episode`)، **وضغطةٌ مطوّلةٌ «حتى هنا»** (`track/watch-up-to`)
 * كما في الويب. **المستقبليّةُ (بلا تاريخٍ أو بعد اليوم) تُرسم باهتةً ولا تُعلَّم.**
 *
 * 🔑 **التفاؤلُ في كاش الموسم والعنوان معاً** ثمّ إعادةُ الجلب (`onSettled` من
 * الأب) — فعدّادُ «شاهدت N من M» في البطل يتحرّك في اللحظة نفسِها.
 */
const today = () => new Date().toISOString().slice(0, 10);

export function SeasonAccordion({
  show,
  watched,
  onError,
  onSettled,
}: {
  show: TvTitlePayload;
  watched: Set<string>;
  onError: (e: unknown) => void;
  onSettled: () => void;
}) {
  const { t, tokens } = useApp();
  /* الموسمُ المفتوحُ افتراضاً: أوّلُ موسمٍ لم يكتمل (كما `initialSeason` في الصفحة) */
  const firstOpen = useMemo(() => {
    const s = show.seasons.find((x) => x.aired > 0 && show.me.watched.filter((k) => k.startsWith(`${x.season_number}:`)).length < x.aired);
    return s?.season_number ?? show.seasons[0]?.season_number ?? null;
  }, [show]);
  const [open, setOpen] = useState<number | null>(firstOpen);

  return (
    <View style={{ gap: 8 }}>
      {show.seasons.map((s) => {
        const inSeason = show.me.watched.filter((k) => k.startsWith(`${s.season_number}:`)).length;
        const done = s.aired > 0 && inSeason >= s.aired;
        const isOpen = open === s.season_number;
        return (
          <View key={s.season_number} style={{ borderRadius: radius.card, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, overflow: "hidden" }}>
            <Pressable onPress={() => setOpen(isOpen ? null : s.season_number)} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text size={15} weight="700">{s.name || t.seasonLabel(s.season_number)}</Text>
                <Text size={12} muted style={{ fontVariant: ["tabular-nums"] }}>{inSeason} / {s.aired}</Text>
              </View>
              {done ? <Icon name="check-line" size={18} color={tokens.success} /> : null}
              <View style={{ transform: [{ rotate: isOpen ? "180deg" : "0deg" }] }}>
                <Icon name="chevron-down" size={16} color={tokens.muted} />
              </View>
            </Pressable>
            {isOpen ? <SeasonBody show={show} season={s.season_number} aired={s.aired} watched={watched} onError={onError} onSettled={onSettled} /> : null}
          </View>
        );
      })}
    </View>
  );
}

function SeasonBody({
  show,
  season,
  aired,
  watched,
  onError,
  onSettled,
}: {
  show: TvTitlePayload;
  season: number;
  aired: number;
  watched: Set<string>;
  onError: (e: unknown) => void;
  onSettled: () => void;
}) {
  const { t, tokens } = useApp();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: qk.season(show.id, season),
    queryFn: async () => (await api<SeasonPayload>(`/api/v1/title/tv/${show.id}/season/${season}`)).data,
    staleTime: 60_000,
  });
  const eps = q.data?.episodes ?? [];
  const runtime = show.episode_run_time;
  const d = today();
  const airedEps = eps.filter((e) => e.air_date && e.air_date <= d);
  const allDone = airedEps.length > 0 && airedEps.every((e) => watched.has(episodeKey(season, e.episode_number)));

  /* التفاؤلُ: مفاتيحُ `watched` في كاش العنوان (المصدرُ الواحد الذي يقرأه البطلُ والأكورديون) */
  const patch = (keys: string[], on: boolean) =>
    qc.setQueryData<TvTitlePayload>(qk.title("tv", show.id), (prev) => {
      if (!prev || prev.kind !== "tv") return prev;
      const set = new Set(prev.me.watched);
      for (const k of keys) on ? set.add(k) : set.delete(k);
      return { ...prev, me: { ...prev.me, watched: [...set], watched_count: set.size, following: true } };
    });
  const ref = (n: number) => ({ season, episode: n, runtime });

  const toggle = useMutation({
    mutationFn: (n: number) =>
      write<TrackResult>("/api/v1/track/episode", { showTmdbId: show.id, ...ref(n), watched: !watched.has(episodeKey(season, n)), title: show.name, posterPath: show.poster_path } satisfies ToggleEpisodeBody),
    onMutate: (n) => patch([episodeKey(season, n)], !watched.has(episodeKey(season, n))),
    onSuccess: onSettled,
    onError,
  });
  const upTo = useMutation({
    mutationFn: (n: number) =>
      write<TrackResult>("/api/v1/track/watch-up-to", { showTmdbId: show.id, episodes: airedEps.filter((e) => e.episode_number <= n).map((e) => ref(e.episode_number)), title: show.name, posterPath: show.poster_path } satisfies WatchUpToBody),
    onMutate: (n) => patch(airedEps.filter((e) => e.episode_number <= n).map((e) => episodeKey(season, e.episode_number)), true),
    onSuccess: onSettled,
    onError,
  });
  const whole = useMutation({
    mutationFn: (on: boolean) =>
      write<TrackResult>("/api/v1/track/season", { showTmdbId: show.id, episodes: airedEps.map((e) => ref(e.episode_number)), watched: on, title: show.name, posterPath: show.poster_path } satisfies SetSeasonBody),
    onMutate: (on) => patch(airedEps.map((e) => episodeKey(season, e.episode_number)), on),
    onSuccess: onSettled,
    onError,
  });

  if (!q.data) {
    return (
      <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 8 }}>
        {Array.from({ length: Math.min(aired || 3, 4) }, (_, i) => (
          <View key={i} style={{ height: 44, borderRadius: radius.control, backgroundColor: tokens.surface2 }} />
        ))}
      </View>
    );
  }
  return (
    <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 6 }}>
      {airedEps.length > 0 ? (
        <View style={{ flexDirection: "row", marginBottom: 4 }}>
          <Chip label={allDone ? t.unwatchShowDone : t.markAllWatched} active={allDone} onPress={() => whole.mutate(!allDone)} />
        </View>
      ) : null}
      {eps.map((e) => {
        const key = episodeKey(season, e.episode_number);
        const on = watched.has(key);
        const future = !e.air_date || e.air_date > d;
        return (
          <Pressable
            key={e.episode_number}
            disabled={future}
            onPress={() => toggle.mutate(e.episode_number)}
            onLongPress={() => upTo.mutate(e.episode_number)}
            delayLongPress={400}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, opacity: future ? 0.45 : 1 }}
          >
            <Text size={12} weight="700" muted style={{ width: 28, textAlign: "center", fontVariant: ["tabular-nums"] }}>{e.episode_number}</Text>
            <View style={{ flex: 1, gap: 1 }}>
              <Text size={14} weight={on ? "500" : "600"} numberOfLines={1} color={on ? tokens.muted : tokens.fg}>{e.name}</Text>
              {e.air_date ? <Text size={11} muted>{e.air_date}</Text> : null}
            </View>
            <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: on ? tokens.accent : tokens.border, backgroundColor: on ? tokens.accent : "transparent", alignItems: "center", justifyContent: "center" }}>
              {on ? <Icon name="check-line" size={13} color={tokens.onAccent} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
