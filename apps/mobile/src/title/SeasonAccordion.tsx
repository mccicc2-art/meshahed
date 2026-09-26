import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mark } from "../perfMarks";
import { Pressable, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isGuest, qk, softGet, useGuestUpgrade, write } from "../api";
import { Image } from "expo-image";
import { backdropUrl } from "@/core/media";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon } from "../icons";
import { ReviewSheet } from "./TitleCommunity";
import { radius } from "../theme";
import { episodeKey } from "@/core/keys";
import { formatDateShort } from "@/core/when";
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
  pending = false,
}: {
  show: TvTitlePayload;
  watched: Set<string>;
  onError: (e: unknown) => void;
  onSettled: () => void;
  /** 🆕 D-1141 — العملُ جاء زائراً (الرمزُ لم يصل): حالتي مجهولةٌ لا «صفر» — العدّاداتُ والعلاماتُ هيكلٌ معطَّل */
  pending?: boolean;
}) {
  const { t, tokens } = useApp();
  /* الموسمُ المفتوحُ افتراضاً: أوّلُ موسمٍ لم يكتمل (كما `initialSeason` في الصفحة) */
  const firstOpen = useMemo(() => firstOpenSeason(show), [show]);
  const [open, setOpenRaw] = useState<number | null>(firstOpen);
  /* D-1141 — ردُّ الزائر يفتح الموسمَ الأوّل (لا يعرف ما شوهد)؛ حين تصل حالتي يُفتح أوّلُ موسمٍ لم يكتمل —
     ما لم يكن القارئُ قد فتح أو طوى بنفسه */
  const touched = useRef(false);
  const setOpen = useCallback((v: number | null) => {
    touched.current = true;
    setOpenRaw(v);
  }, []);
  useEffect(() => {
    if (!touched.current) setOpenRaw(firstOpen);
  }, [firstOpen]);
  /**
   * 🔴 D-1021 — **تبويبُ الحلقات بترتيب الويب** (طلبُ أحمد بلقطتين، ١٨ سبتمبر): شريطُ التقدّم
   * ومفتاحُ التقييمات وسطرُ القاعدة **مرّةً واحدة فوق المواسم** (كانت داخل كلِّ موسم فتتكرّر
   * وتطول)؛ ورأسُ الموسم سطرٌ واحد: السهمُ يساراً، الاسمُ والعدّ، وعلى اليمين «الموسم كلّه ✓»
   * الذي يصير «مسح الموسم» بعد التعليم. تعليمُ الموسم كلِّه من الرأس يعتمد على `first_episode`
   * و`aired` (D-988) فلا يحتاج فتحَ الموسم.
   */
  const [showRatings, setShowRatings] = useState(false);
  const qc = useQueryClient();
  const runtime = show.episode_run_time ?? null;
  const total = show.aired_total;
  const doneAll = show.me.watched_count;
  const pctAll = total > 0 ? Math.round((doneAll / total) * 100) : 0;
  const whole = useMutation({
    mutationFn: ({ season, on }: { season: number; on: boolean }) => {
      const sm = show.seasons.find((x) => x.season_number === season);
      const first = sm?.first_episode ?? 1;
      const count = Math.min(sm?.aired ?? 0, sm?.episode_count ?? 0);
      const episodes = Array.from({ length: count }, (_, i) => ({ season, episode: first + i, runtime }));
      return write<TrackResult>("/api/v1/track/season", { showTmdbId: show.id, episodes, watched: on, title: show.name, posterPath: show.poster_path } satisfies SetSeasonBody);
    },
    onMutate: ({ season, on }) => {
      const sm = show.seasons.find((x) => x.season_number === season);
      const first = sm?.first_episode ?? 1;
      const count = Math.min(sm?.aired ?? 0, sm?.episode_count ?? 0);
      const keys = Array.from({ length: count }, (_, i) => episodeKey(season, first + i));
      qc.setQueryData<TvTitlePayload>(qk.title("tv", show.id), (prev) => {
        if (!prev) return prev;
        const set = new Set(prev.me.watched);
        for (const k of keys) {
          if (on) set.add(k);
          else set.delete(k);
        }
        return { ...prev, me: { ...prev.me, watched: [...set], watched_count: set.size } };
      });
    },
    onSuccess: onSettled,
    onError,
  });

  return (
    <View style={{ gap: 8 }}>
      {total > 0 ? (
        <View style={{ gap: 6, marginBottom: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            {pending ? (
              <View style={{ flex: 1, height: 13 }}><View style={{ width: 150, height: 13, borderRadius: 4, backgroundColor: tokens.surface2 }} /></View>
            ) : (
              <>
                <Text size={13} style={{ flex: 1 }} numberOfLines={1}>{t.watchedOf(doneAll, total)}</Text>
                <Text size={13} weight="700" color={doneAll >= total ? tokens.success : tokens.accent}>{`${pctAll}%`}</Text>
              </>
            )}
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
            {pending ? null : <View style={{ width: `${pctAll}%`, height: "100%", backgroundColor: doneAll >= total ? tokens.success : tokens.accent }} />}
          </View>
          <Text size={11} muted>{t.cascadeHint}</Text>
        </View>
      ) : null}
      {show.seasons.map((s) => {
        const inSeason = show.me.watched.filter((k) => k.startsWith(`${s.season_number}:`)).length;
        const done = s.aired > 0 && inSeason >= s.aired;
        const isOpen = open === s.season_number;
        return (
          /* D-1019 — بطاقةُ الموسم سوداءُ كالصفحة (حدُّها وحدَه يفصلها) — كالأوراق وصفوف الأفعال */
          <View key={s.season_number} style={{ borderRadius: radius.card, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.bg, overflow: "hidden" }}>
            {done && !pending ? <View style={{ height: 3, backgroundColor: tokens.accent }} /> : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12 }}>
              <Pressable onPress={() => setOpen(isOpen ? null : s.season_number)} accessibilityRole="button" accessibilityState={{ expanded: isOpen }} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 }}>
                <View style={{ transform: [{ rotate: isOpen ? "0deg" : "-90deg" }] }}>
                  <Icon name="chevron-down" size={16} color={tokens.muted} />
                </View>
                <Text size={15} weight="700">{s.name || t.seasonLabel(s.season_number)}</Text>
                {/* 🆕 D-1029 — **موسمٌ لم يُبثّ منه شيء لا يُكتب «0/0»** (بلاغُ أحمد بلقطة، The Pitt الموسم ٣:
                    «فاضي… المفترض على نفس الخط يظهر تاريخ بدء الموسم وعدد الحلقات»): «٠ من ٠» كسرٌ بلا
                    معنى يُقرأ عطلاً. فمكانَ العدّاد **عددُ حلقاته المعلَن**، ومكانَ «الموسم كامل» (لا شيء
                    يُعلَّم بعد) **تاريخُ بدئه** بصيغة الحلقات نفسِها (`airsOn` + `formatDateShort`) — والحقلان
                    في الردّ أصلاً (`episode_count` · `air_date`) فلا نداءَ جديداً. موسمٌ بلا عددٍ ولا تاريخ
                    يبقى اسمُه وحدَه: لا نخترع ما لم تعلنه TMDB. */}
                {s.aired > 0 && pending ? (
                  <View style={{ width: 30, height: 12, borderRadius: 4, backgroundColor: tokens.surface2 }} />
                ) : s.aired > 0 ? (
                  <Text size={12} muted style={{ fontVariant: ["tabular-nums"] }}>{inSeason}/{s.aired}</Text>
                ) : s.episode_count > 0 ? (
                  <Text size={12} muted style={{ fontVariant: ["tabular-nums"] }}>{t.episodesCount(s.episode_count)}</Text>
                ) : null}
              </Pressable>
              {/* 🔴 D-1039 — **موسمٌ أُعلن بلا موعدٍ ولا عدد لا يبقى سطراً أصمّ** (بلاغُ أحمد بلقطةٍ على 1.11.0: «وصل ولم
                  تُعالَج» — The Pitt الموسم ٣): D-1029 أزالت «0/0» وراهنت على أنّ TMDB تعلن عدداً أو تاريخاً؛ لهذا الموسم
                  لا تعلن شيئاً (`episode_count = 0` · `air_date = null`) **فبقي الاسمُ وحدَه وبدا عطلاً**. الآن:
                  ١ · التاريخُ من الموسم، **وإلّا من `next_episode_to_air` إن كانت حلقتُه القادمة في هذا الموسم** (TMDB
                      تملؤها قبل أن تملأ تاريخَ الموسم) — في الردّ أصلاً، لا نداء.
                  ٢ · وإلّا «قريباً» (`comingSoon`، مفتاحٌ قائم) — **السطرُ يقول دائماً لماذا هو فارغ.**
                  ولا نخترع تاريخاً ولا عدداً: «قريباً» حالٌ لا موعد. */}
              {s.aired === 0 ? (
                <Text size={12} muted style={{ paddingVertical: 12, fontVariant: ["tabular-nums"] }}>
                  {(() => {
                    const next = show.next_episode_to_air;
                    const date = s.air_date ?? (next && next.season_number === s.season_number ? next.air_date : null);
                    if (!date) return t.comingSoon;
                    /* تاريخٌ مضى ولم تصل حلقاتُه بعد (TMDB تتأخّر): التاريخُ وحدَه — «يُعرض» لماضٍ كذبة */
                    return date > new Date().toISOString().slice(0, 10) ? t.airsOn(formatDateShort(date, t)) : formatDateShort(date, t);
                  })()}
                </Text>
              ) : null}
              {s.aired > 0 ? (
                <Pressable disabled={pending} onPress={() => whole.mutate({ season: s.season_number, on: !done })} hitSlop={8} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 12, opacity: pending ? 0.35 : pressed || whole.isPending ? 0.6 : 1 })}>
                  {done ? <Icon name="check-line" size={14} color={tokens.success} /> : null}
                  <Text size={13} weight="600" color={done ? tokens.muted : tokens.accent}>{done ? t.seasonUndo : t.seasonAll}</Text>
                </Pressable>
              ) : null}
            </View>
            {isOpen ? <SeasonBody show={show} season={s.season_number} aired={s.aired} watched={watched} onError={onError} onSettled={onSettled} showRatings={showRatings} onShowRatings={() => setShowRatings(true)} pending={pending} /> : null}
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
  showRatings,
  onShowRatings,
  pending,
}: {
  show: TvTitlePayload;
  season: number;
  aired: number;
  watched: Set<string>;
  /** D-1021 — المفتاحُ في رأس التبويب لا في الموسم */
  showRatings: boolean;
  onShowRatings: () => void;
  onError: (e: unknown) => void;
  onSettled: () => void;
  /** D-1141 — حالتي لم تصل: العلامةُ والنجمةُ هيكلٌ لا يُضغط */
  pending: boolean;
}) {
  const { t, tokens } = useApp();
  const qc = useQueryClient();
  /**
   * 🆕 D-1011 — **صفُّ الحلقة يحمل ما يحمله في الويب** (طلبُ أحمد بلقطةٍ مؤشَّرة): صورةُ
   * الحلقة، ونجمةُ تقييمي، وشريطُ التقدّم مع مفتاح التقييمات، والسطرُ الذي يشرح أنّ التأشير
   * يعلّم ما قبله (D-988). **التقييماتُ تُطلب عند فتح المفتاح لا قبله** (`?r=1` — رحلةُ OMDb
   * لكلِّ موسم)، كما يفعل `EpisodeTracker` حرفاً، والمفتاحُ يُذكَر للجلسة.
   */
  const q = useQuery({
    ...seasonQuery(show.id, season, showRatings),
    placeholderData: (prev) => prev,
  });
  /* D-1141 — حلقاتٌ جاءت زائرة: تُعاد حين يصل الرمز (تقييماتي على الحلقات) */
  useGuestUpgrade(isGuest(q.data) && !q.isPlaceholderData, q.refetch);
  /* 🆕 D-1118 — `season.open`: من فتح الموسم إلى حلقاته (`cached=1` إن كانت في الكاش أصلاً) */
  const seasonMark = useRef<{ key: string; t0: number; cached: number } | null>(null);
  useEffect(() => {
    const key = `${show.id}:${season}`;
    seasonMark.current = { key, t0: performance.now(), cached: q.data && !q.isPlaceholderData ? 1 : 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- البدايةُ مع فتح الموسم وحده
  }, [show.id, season]);
  useEffect(() => {
    const m = seasonMark.current;
    if (!m || !q.data || q.isPlaceholderData || m.key !== `${show.id}:${season}`) return;
    mark("season.open", performance.now() - m.t0, { cached: m.cached });
    seasonMark.current = null;
  }, [q.data, q.isPlaceholderData, show.id, season]);
  /**
   * 🔴 D-1015 — **ورقةُ تقييم الحلقة كورقة تقييم العمل** (بلاغُ أحمد بثلاث لقطات على 1.9.3:
   * «تقييم الحلقة ما يشتغل… أبغى انبثاقاً مثل تقييم المسلسل أحدّد التقييم وأكتب تعليقاً»):
   * كانت الورقةُ نجوماً عاريةً تكتب بلمسةٍ واحدة وتُغلق — **ولا أثرَ يُرى**، لأنّ `my_rating`
   * لا يصل إلا حين يُفتح مفتاحُ التقييمات (`?r=1`)، وكاشُ التفاؤل كان يُكتب على مفتاحٍ غير
   * المفتاح النشط. الآن `ReviewSheet` نفسُها (نجوم + تعليق + حارقٌ + «تمّ»)، والكتابةُ تُحدّث
   * المفتاحَ النشط **وتفتح مفتاحَ التقييمات** كي تُرى النجمةُ فوراً.
   */
  const rate = useMutation({
    mutationFn: (v: { episode: number; rating: number; review: string | null }) =>
      write<TrackResult>("/api/v1/track/episode-rate", { showTmdbId: show.id, season, episode: v.episode, rating: v.rating, review: v.review, runtime } satisfies EpisodeRateBody),
    onMutate: (v) => {
      onShowRatings();
      for (const key of [[...qk.season(show.id, season), "r"], [...qk.season(show.id, season), ""]] as const)
        qc.setQueryData<SeasonPayload>(key, (prev) =>
          prev ? { ...prev, episodes: prev.episodes.map((e) => (e.episode_number === v.episode ? { ...e, my_rating: v.rating, my_review: v.review } : e)) } : prev,
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

  /* التفاؤلُ: مفاتيحُ `watched` في كاش العنوان (المصدرُ الواحد الذي يقرأه البطلُ والأكورديون) */
  const patch = (keys: string[], on: boolean) =>
    qc.setQueryData<TvTitlePayload>(qk.title("tv", show.id), (prev) => {
      if (!prev || prev.kind !== "tv") return prev;
      const set = new Set(prev.me.watched);
      for (const k of keys) {
        if (on) set.add(k);
        else set.delete(k);
      }
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
      {/* D-1021 — شريطُ التقدّم وزرُّ الموسم كلِّه انتقلا إلى رأس التبويب ورأس الموسم */}
      {eps.map((e) => {
        const key = episodeKey(season, e.episode_number);
        const on = watched.has(key);
        const future = !e.air_date || e.air_date > d;
        return (
          <Pressable
            key={e.episode_number}
            disabled={future || pending}
            /* D-988 — التأشيرُ «حتى هنا»؛ الإزالةُ حلقةٌ واحدة */
            onPress={() => (on ? toggle.mutate(e.episode_number) : upTo.mutate(e.episode_number))}
            onLongPress={() => upTo.mutate(e.episode_number)}
            delayLongPress={400}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, opacity: future ? 0.45 : 1 }}
          >
            {/* D-1021 — دائرةُ التأشير يساراً كالويب، والرقمُ مع الاسم */}
            <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: pending ? 0 : 1.5, borderColor: on ? tokens.success : tokens.border, backgroundColor: pending ? tokens.surface2 : on ? tokens.success : "transparent", alignItems: "center", justifyContent: "center" }}>
              {on && !pending ? <Icon name="check-line" size={13} color={tokens.onAccent} /> : null}
            </View>
            {/* صورةُ الحلقة — `w300` تكفي مربّعاً ٧٢×٤٠ (D-895: لا نجلب أكبر ممّا نرسم) */}
            <View style={{ width: 72, height: 40, borderRadius: 6, overflow: "hidden", backgroundColor: tokens.surface2 }}>
              {e.still_path ? <Image source={{ uri: backdropUrl(e.still_path, "w300") ?? undefined }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={120} recyclingKey={`${season}-${e.episode_number}`} /> : null}
            </View>
            <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
              <Text size={14} weight={on ? "500" : "600"} numberOfLines={1} color={on ? tokens.muted : tokens.fg}>{`${e.episode_number}. ${e.name}`}</Text>
              {e.air_date ? <Text size={11} muted>{formatDateShort(e.air_date, t)}{e.runtime ? ` · ${t.minutesCount(e.runtime)}` : ""}</Text> : null}
            </View>
            {showRatings && typeof e.imdb_rating === "number" ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text size={9} weight="800" color="#F5C518">IMDb</Text>
                <Text size={11} weight="700" muted style={{ fontVariant: ["tabular-nums"] }}>{e.imdb_rating.toFixed(1)}</Text>
              </View>
            ) : null}
            {/* نجمةُ تقييمي — تملأ برقمها حين أقيّم، والضغطُ يفتح منتقيَ ١..١٠ */}
            <Pressable
              disabled={pending}
              onPress={() => setRating(e.episode_number)}
              hitSlop={6}
              accessibilityLabel={t.epRateAria(season, e.episode_number)}
              style={{ flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 2 }}
            >
              <Icon name={typeof e.my_rating === "number" ? "star-filled" : "star"} size={15} color={typeof e.my_rating === "number" ? tokens.accent : tokens.muted} />
              {typeof e.my_rating === "number" ? <Text size={11} weight="700" color={tokens.accent} style={{ fontVariant: ["tabular-nums"] }}>{e.my_rating}</Text> : null}
            </Pressable>
          </Pressable>
        );
      })}
      {rating !== null ? (
        <ReviewSheet
          title={t.epRateAria(season, rating)}
          head={{ name: show.name, posterPath: show.poster_path }}
          initial={{
            rating: eps.find((e) => e.episode_number === rating)?.my_rating ?? null,
            review: eps.find((e) => e.episode_number === rating)?.my_review ?? null,
            has_spoiler: false,
          }}
          busy={rate.isPending}
          onClose={() => setRating(null)}
          onSave={(v) => {
            rate.mutate({ episode: rating, rating: v.rating, review: v.review });
            setRating(null);
          }}
        />
      ) : null}
    </View>
  );
}

/** 🆕 D-1118 — أوّلُ موسمٍ لم يكتمل، وإلا الأوّل — تقرؤه الشاشةُ لتبدأ جلبَه مع الصفحة لا بعد رسم القائمة */
export function firstOpenSeason(show: TvTitlePayload): number | null {
  const s = show.seasons.find((x) => x.aired > 0 && show.me.watched.filter((k) => k.startsWith(`${x.season_number}:`)).length < x.aired);
  return s?.season_number ?? show.seasons[0]?.season_number ?? null;
}

/** 🆕 D-1118 — استعلامُ الموسم الواحد: القائمةُ والجلبُ المسبق بالمفتاح نفسِه فلا يتكرّر */
export function seasonQuery(showId: number, season: number, ratings = false) {
  return {
    queryKey: [...qk.season(showId, season), ratings ? "r" : ""] as const,
    /* D-1141 — الحلقاتُ عامّة (علاماتُها من كاش العنوان لا من هنا): لا تنتظر الرمز؛ `my_rating` يُملأ بعد الترقية */
    queryFn: () => softGet<SeasonPayload>(`/api/v1/title/tv/${showId}/season/${season}${ratings ? "?r=1" : ""}`),
    staleTime: 60_000,
  };
}
