import React, { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, qk, write } from "../api";
import { Image } from "expo-image";
import { backdropUrl } from "@/core/media";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon } from "../icons";
import { Chip } from "../library/Chip";
import { Sheet } from "../library/Sheet";
import { StarRow } from "./StarRow";
import { radius } from "../theme";
import { episodeKey } from "@/core/keys";
import type { EpisodeRateBody, SeasonPayload, SetSeasonBody, ToggleEpisodeBody, TrackResult, TvTitlePayload, WatchUpToBody } from "../contracts";

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
  /**
   * 🆕 D-1011 — **صفُّ الحلقة يحمل ما يحمله في الويب** (طلبُ أحمد بلقطةٍ مؤشَّرة): صورةُ
   * الحلقة، ونجمةُ تقييمي، وشريطُ التقدّم مع مفتاح التقييمات، والسطرُ الذي يشرح أنّ التأشير
   * يعلّم ما قبله (D-988). **التقييماتُ تُطلب عند فتح المفتاح لا قبله** (`?r=1` — رحلةُ OMDb
   * لكلِّ موسم)، كما يفعل `EpisodeTracker` حرفاً، والمفتاحُ يُذكَر للجلسة.
   */
  const [showRatings, setShowRatings] = useState(false);
  const q = useQuery({
    queryKey: [...qk.season(show.id, season), showRatings ? "r" : ""] as const,
    queryFn: async () => (await api<SeasonPayload>(`/api/v1/title/tv/${show.id}/season/${season}${showRatings ? "?r=1" : ""}`)).data,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
  const rate = useMutation({
    mutationFn: (v: { episode: number; rating: number | null }) =>
      write<TrackResult>("/api/v1/track/episode-rate", { showTmdbId: show.id, season, episode: v.episode, rating: v.rating, runtime } satisfies EpisodeRateBody),
    onMutate: (v) => {
      qc.setQueryData<SeasonPayload>([...qk.season(show.id, season), "r"], (prev) =>
        prev ? { ...prev, episodes: prev.episodes.map((e) => (e.episode_number === v.episode ? { ...e, my_rating: v.rating } : e)) } : prev,
      );
    },
    onSuccess: onSettled,
    onError,
  });
  const [rating, setRating] = useState<number | null>(null);
  const eps = q.data?.episodes ?? [];
  const runtime = show.episode_run_time;
  const d = today();
  const airedEps = eps.filter((e) => e.air_date && e.air_date <= d);
  const allDone = airedEps.length > 0 && airedEps.every((e) => watched.has(episodeKey(season, e.episode_number)));
  const doneCount = airedEps.filter((e) => watched.has(episodeKey(season, e.episode_number))).length;
  const pct = airedEps.length > 0 ? Math.round((doneCount / airedEps.length) * 100) : 0;

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
  /**
   * 🔴 D-988 — **التأشيرُ يعني «شاهدتُ حتى هنا» — عبر المواسم كلِّها، كالويب** (طلبُ أحمد
   * بلقطة، ١٦ سبتمبر: «إذا ضغطت شفت حلقة، أيّ حلقة قبلها يجي عليها إني شفتها مثل الويب»):
   * `EpisodeTracker.toggleOne` يعدّ كلَّ ما قبل الحلقة مشاهَداً — في موسمها **وفي المواسم
   * السابقة** بعدد ما بُثّ منها (`aired`، بقاعدة D-603) — ويكتب ما لم يكن معلَّماً وحدَه. هنا
   * كان التأشيرُ حلقةً واحدة والضغطةُ المطوّلةُ «حتى هنا» داخل الموسم فقط. **الآن الضغطةُ
   * والمطوّلةُ سواء**، وإزالةُ العلامة وحدَها تبقى حلقةً واحدة (كالويب أيضاً).
   */
  const upToKeys = (n: number) => {
    const list: { season: number; episode: number; runtime: number | null }[] = [];
    for (const sm of show.seasons) {
      if (sm.season_number > season) continue;
      if (sm.season_number === 0 && season !== 0) continue;
      if (sm.season_number === season) continue;
      /* نافذةُ الموسم من `first_episode` لا من ١ (الترقيمُ المطلق، D-603) */
      const count = Math.min(sm.aired, sm.episode_count);
      const first = sm.first_episode ?? 1;
      for (let i = 0; i < count; i++) list.push({ season: sm.season_number, episode: first + i, runtime });
    }
    /* حلقاتُ الموسم المفتوح بأرقامها الفعليّة (قد لا تبدأ من ١ في الترقيم المطلق) */
    const own = airedEps.filter((e) => e.episode_number <= n).map((e) => ref(e.episode_number));
    return [...list, ...own].filter((x) => !watched.has(episodeKey(x.season, x.episode)));
  };
  const upTo = useMutation({
    mutationFn: (n: number) => {
      const eps = upToKeys(n);
      return eps.length === 1
        ? write<TrackResult>("/api/v1/track/episode", { showTmdbId: show.id, ...eps[0], watched: true, title: show.name, posterPath: show.poster_path } satisfies ToggleEpisodeBody)
        : write<TrackResult>("/api/v1/track/watch-up-to", { showTmdbId: show.id, episodes: eps, title: show.name, posterPath: show.poster_path } satisfies WatchUpToBody);
    },
    onMutate: (n) => patch(upToKeys(n).map((x) => episodeKey(x.season, x.episode)), true),
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
        <>
          {/* D-1011 — شريطُ التقدّم ونسبتُه ومفتاحُ تقييمات الحلقات، ثمّ سطرُ قاعدة التأشير */}
          <View style={{ gap: 6, marginBottom: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Text size={13} style={{ flex: 1 }} numberOfLines={1}>{t.watchedOf(doneCount, airedEps.length)}</Text>
              <Text size={13} weight="700" color={tokens.accent}>{`${pct}%`}</Text>
              <Pressable
                onPress={() => setShowRatings((v) => !v)}
                hitSlop={8}
                accessibilityRole="switch"
                accessibilityState={{ checked: showRatings }}
                accessibilityLabel={showRatings ? t.epRatingsHide : t.epRatingsShow}
                style={{ width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: showRatings ? tokens.surface2 : "transparent" }}
              >
                <Icon name={showRatings ? "star-filled" : "star"} size={16} color={showRatings ? tokens.accent : tokens.muted} />
              </Pressable>
            </View>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: tokens.surface2, overflow: "hidden" }}>
              <View style={{ width: `${pct}%`, height: "100%", backgroundColor: tokens.accent }} />
            </View>
            <Text size={11} muted>{t.cascadeHint}</Text>
          </View>
          <View style={{ flexDirection: "row", marginBottom: 4 }}>
            <Chip label={allDone ? t.unwatchShowDone : t.markAllWatched} active={allDone} onPress={() => whole.mutate(!allDone)} />
          </View>
        </>
      ) : null}
      {eps.map((e) => {
        const key = episodeKey(season, e.episode_number);
        const on = watched.has(key);
        const future = !e.air_date || e.air_date > d;
        return (
          <Pressable
            key={e.episode_number}
            disabled={future}
            /* D-988 — التأشيرُ «حتى هنا»؛ الإزالةُ حلقةٌ واحدة */
            onPress={() => (on ? toggle.mutate(e.episode_number) : upTo.mutate(e.episode_number))}
            onLongPress={() => upTo.mutate(e.episode_number)}
            delayLongPress={400}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, opacity: future ? 0.45 : 1 }}
          >
            <Text size={12} weight="700" muted style={{ width: 22, textAlign: "center", fontVariant: ["tabular-nums"] }}>{e.episode_number}</Text>
            {/* صورةُ الحلقة — `w300` تكفي مربّعاً ٧٢×٤٠ (D-895: لا نجلب أكبر ممّا نرسم) */}
            <View style={{ width: 72, height: 40, borderRadius: 6, overflow: "hidden", backgroundColor: tokens.surface2 }}>
              {e.still_path ? <Image source={{ uri: backdropUrl(e.still_path, "w300") ?? undefined }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={120} recyclingKey={`${season}-${e.episode_number}`} /> : null}
            </View>
            <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
              <Text size={14} weight={on ? "500" : "600"} numberOfLines={1} color={on ? tokens.muted : tokens.fg}>{e.name}</Text>
              {e.air_date ? <Text size={11} muted>{e.air_date}{e.runtime ? ` · ${t.minutesCount(e.runtime)}` : ""}</Text> : null}
            </View>
            {showRatings && typeof e.imdb_rating === "number" ? (
              <Text size={11} weight="700" muted style={{ fontVariant: ["tabular-nums"] }}>{e.imdb_rating.toFixed(1)}</Text>
            ) : null}
            {/* نجمةُ تقييمي — تملأ برقمها حين أقيّم، والضغطُ يفتح منتقيَ ١..١٠ */}
            <Pressable
              onPress={() => setRating(e.episode_number)}
              hitSlop={6}
              accessibilityLabel={t.epRateAria(season, e.episode_number)}
              style={{ flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 2 }}
            >
              <Icon name={typeof e.my_rating === "number" ? "star-filled" : "star"} size={15} color={typeof e.my_rating === "number" ? tokens.accent : tokens.muted} />
              {typeof e.my_rating === "number" ? <Text size={11} weight="700" color={tokens.accent} style={{ fontVariant: ["tabular-nums"] }}>{e.my_rating}</Text> : null}
            </Pressable>
            <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: on ? tokens.accent : tokens.border, backgroundColor: on ? tokens.accent : "transparent", alignItems: "center", justifyContent: "center" }}>
              {on ? <Icon name="check-line" size={13} color={tokens.onAccent} /> : null}
            </View>
          </Pressable>
        );
      })}
      {rating !== null ? (
        <Sheet title={t.epRateAria(season, rating)} onClose={() => setRating(null)}>
          <StarRow
            value={eps.find((e) => e.episode_number === rating)?.my_rating ?? null}
            clearable
            onChange={(n) => {
              rate.mutate({ episode: rating, rating: n });
              setRating(null);
            }}
          />
        </Sheet>
      ) : null}
    </View>
  );
}
