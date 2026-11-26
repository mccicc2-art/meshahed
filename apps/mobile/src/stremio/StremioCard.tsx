import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { StarRow } from "../title/StarRow";
import { write } from "../api";
import { haptic } from "../haptics";
import type { EpisodeRateBody, RateBody } from "../contracts";
import { Icon } from "../icons";
import { radius } from "../theme";
import { SectionHeader, PAGE_PAD } from "../home/Section";
import { backdropUrl } from "@/core/media";
import { timeAgo } from "@/core/when";
import { ALWAYS_ASKS, isPlatformSignal, signalSourceLabel, type SignalSource, type StremioSignal } from "@/core/contracts/stremio";
import { Sheet } from "../library/Sheet";
import { episodeLabel } from "./api";
import { rateStages } from "./useAnswer";

/** عرضُ اللقطة 16:9 (قرار ٦: ١١٦ نقطة) — والنصُّ بجانبها بارتفاعها */
const STILL_W = 116;
const STILL_H = Math.round((STILL_W * 9) / 16);
/** دائرتا الجواب — قطرُ «عرض الكل» (٤٠)؛ والجرسُ يمرّر ٣٤ */
const ANSWER_CIRCLE = 40;

/** لقطةُ الحلقة (أو خلفيّةُ العمل) — صورةٌ فشلت يحلّ محلَّها رمزُ النوع كـ`MediaRow` (D-1323) */
export function SignalStill({ s, width }: { s: StremioSignal; width: number }) {
  const { tokens } = useApp();
  const [failed, setFailed] = useState<string | null>(null);
  const uri = s.image_path && failed !== s.image_path ? backdropUrl(s.image_path, "w300") : null;
  return (
    <View style={{ width, height: Math.round((width * 9) / 16), borderRadius: radius.sm, overflow: "hidden", backgroundColor: tokens.surface2 }}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} cachePolicy="memory-disk" onError={() => setFailed(s.image_path)} />
      ) : (
        <View style={styles.center}><Icon name={s.kind === "movie" ? "film" : "tv"} size={18} color={tokens.muted} /></View>
      )}
    </View>
  );
}

/**
 * ====== 🆕 «من أجهزتك» — بطاقةُ الرئيسيّة (خطّةُ Stremio، تصميم «٣»، ٢٢ أكتوبر · وسيرفراتُ البيت منذ هجرة ٢٣٥) ======
 *
 * ⚖️ **قسمٌ واحدٌ لكلِّ الأجهزة** (أحمد ٤ نوفمبر، البطاقة «أ»): أسئلةُ Stremio وPlex وJellyfin وEmby جدولٌ واحد، والمصدرُ
 * اسمٌ في سطر الوقت — لا قسمٌ لكلِّ مصدرٍ يكدّس الرئيسيّة.
 *
 * إشارةٌ واحدةٌ — الأحدث — بلقطتها وسؤالها، وتحتها نصفان بعرض البطاقة: ✓ شفتها (أساسيّ) و✕ لا (شفّاف). الجوابُ يُظهر
 * التي بعدها وينقص العدد، **وبلا إشارةٍ منتظرةٍ يختفي القسمُ كلُّه** (قرار ٥: لا حالةَ فارغةَ في الرئيسيّة) — فالمكوّنُ
 * يعيد `null` والرئيسيّةُ لا تعرف عنه شيئاً.
 * ⚖️ الزرّان من مصنع الأزرار (`Button` حجمَ `sm`) لا رسمٌ ثانٍ؛ ارتفاعُهما ٣٤ ليتّسع الإبهام في نصف بطاقة.
 * والألوانُ رموزُ الثيم كلُّها (فُحصت التصاميمُ في Loopz والنهاريّ والمحيط والقرمزيّ).
 */
export function StremioCard({
  items,
  count,
  onAnswer,
  onAll,
  onOpen,
  rating,
  onRate,
  onRateEpisode,
  onSkipRate,
  onAnswerMany,
}: {
  /** المنتظرةُ بعد إخفاء ما أُجيب عنه */
  items: StremioSignal[];
  count: number;
  /** `quiet` (T579): جوابٌ من ورقة «اختر منها» — بلا نجومٍ في البطاقة */
  onAnswer: (s: StremioSignal, watched: boolean, quiet?: boolean) => void;
  /** 🆕 T579 — جوابٌ واحدٌ لحلقات عملٍ ظهرت معاً من منصّة (`useStremioAnswer.answerMany`) */
  onAnswerMany?: (list: StremioSignal[], watched: boolean) => void;
  onAll: () => void;
  onOpen: (s: StremioSignal) => void;
  /** 🆕 T415 — ما أُجيب عنه بـ✓ وينتظر نجومه (`useStremioAnswer`) */
  rating?: ReadonlyMap<number, StremioSignal>;
  onRate?: (s: StremioSignal, stars: number) => Promise<boolean>;
  /** 🆕 T485 — نجومُ الحلقة؛ `last` = لا نجومَ للعمل بعدها */
  onRateEpisode?: (s: StremioSignal, stars: number, last: boolean) => Promise<boolean>;
  onSkipRate?: (s: StremioSignal) => void;
}) {
  const { t, tokens } = useApp();
  const s = items[0];
  if (!s) return null;
  const ep = episodeLabel(s, t.stremioMovie);
  const src = s.source ?? "stremio";
  const movie = s.kind === "movie";
  const stages = rateStages(s);
  /* اسمُ نجوم العمل وحالتُه (T415): الفيلمُ «قيّمه»، والمسلسلُ «قيّم المسلسل» عند نهاية الموسم أو المسلسل */
  const workLabel = movie ? t.autoRate : t.signalRateShow;
  const workStatus = movie ? t.stremioMarkedMovie : s.rate === "show" ? t.signalShowDone : t.signalSeasonDone;
  /* 🆕 T485 — كتابةُ نجوم الحلقة للتلقائيّ (المشاهدةُ محفوظةٌ قبله فلا جوابَ يُنتظر) */
  const autoEp = async (n: number) => {
    if (s.season == null || s.episode == null) return false;
    try {
      await write<unknown>("/api/v1/track/episode-rate", { showTmdbId: s.tmdb_id, season: s.season, episode: s.episode, rating: n } satisfies EpisodeRateBody);
      haptic.success();
      return true;
    } catch {
      return false;
    }
  };
  const autoWork = async (n: number) => {
    try {
      await write<unknown>("/api/v1/track/rate", { tmdbId: s.tmdb_id, mediaType: s.kind, rating: n, review: "", title: s.title, posterPath: s.poster_path ?? null } satisfies RateBody);
      haptic.success();
      return true;
    } catch {
      return false;
    }
  };
  /* 🆕 T361 — ما سجّله Loopz بنفسه (أحمد ١٠ نوفمبر «١ أ و ج»): «✓ أضفناه لمكتبتك» ثمّ النجوم، و«حسناً» بلا نجوم.
     🆕 T485 — والحلقةُ بنجومها أوّلاً (كانت «حسناً»)، ثمّ نجومُ المسلسل عند نهايته (T415) */
  if (s.auto) {
    return (
      <DoneCard
        key={s.id}
        s={s}
        count={count}
        ep={ep}
        steps={stages.map((st, i) => ({
          status: i === 0 ? (movie ? t.autoAddedMovie : t.autoAddedEpisode) : workStatus,
          plain: i === 0,
          label: st === "ep" ? t.signalRateEpisode : workLabel,
          rate: st === "ep" ? autoEp : autoWork,
        }))}
        okStatus={movie ? t.autoAddedMovie : t.autoAddedEpisode}
        onDone={() => onAnswer(s, true)}
        onAll={onAll}
        onOpen={onOpen}
      />
    );
  }
  /* 🆕 T415 (أحمد ١٨ نوفمبر «أ نفذ») — **بعد «✓ شفتها» تنقلب البطاقةُ إلى النجوم في مكانها** — صفُّ البطاقة التلقائيّة نفسُه، لا
     نافذةٌ منبثقة (قرار ٥ من خطّة Stremio باقٍ). «تراجع» في الإشعار يعيدها سؤالاً.
     🆕 T485 — كلُّ حلقةٍ بنجومها («قيّم الحلقة»)، ونهايةُ الموسم أو المسلسل بعدها بنجوم المسلسل */
  if (rating?.has(s.id) && onRate && onSkipRate && stages.length) {
    return (
      <DoneCard
        key={`r${s.id}`}
        s={s}
        count={count}
        ep={ep}
        steps={stages.map((st, i) => ({
          status: st === "ep" ? t.signalEpisodeDone : workStatus,
          plain: false,
          label: st === "ep" ? t.signalRateEpisode : workLabel,
          rate: st === "ep" ? (n: number) => (onRateEpisode ? onRateEpisode(s, n, i === stages.length - 1) : Promise.resolve(false)) : (n: number) => onRate(s, n),
        }))}
        okStatus={workStatus}
        onDone={() => onSkipRate(s)}
        onAll={onAll}
        onOpen={onOpen}
      />
    );
  }
  /* 🆕 T579 — **حلقاتُ عملٍ واحدٍ ظهرت معاً في سجلّ منصّة: سؤالٌ واحد** (أحمد «٢ب»). حلقةٌ واحدة ⇒ البطاقةُ كما هي */
  if (onAnswerMany && isPlatformSignal(s.source) && s.kind === "tv") {
    const group = sameWork(items, s, rating);
    if (group.length > 1) return <GroupCard key={`g${s.source}-${s.tmdb_id}`} group={group} count={count} onAnswer={onAnswer} onAnswerMany={onAnswerMany} onAll={onAll} onOpen={onOpen} />;
  }
  return (
    <View>
      <SectionHeader
        title={t.devicesFrom}
        icon="play"
        onTitle={onAll}
        action={<Text size={12} weight="700" color={tokens.accent}>{String(count)}</Text>}
        seeAll={t.allWord}
        onSeeAll={onAll}
      />
      <View style={{ marginHorizontal: PAGE_PAD, borderRadius: 16, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, padding: 8, gap: 8 }}>
        <Pressable
          onPress={() => onOpen(s)}
          accessibilityRole="button"
          accessibilityLabel={`${s.title}، ${s.kind === "movie" ? t.stremioAskMovieLine : `${ep}، ${t.stremioAsk}`}`}
          style={({ pressed }) => ({ flexDirection: "row", gap: 12, opacity: pressed ? 0.85 : 1 })}
        >
          <SignalStill s={s} width={STILL_W} />
          <View style={{ flex: 1, minWidth: 0, height: STILL_H, justifyContent: "space-between" }}>
            <Text size={15} weight="700" numberOfLines={1}>{s.title}</Text>
            {/* 🆕 T497 — السؤالُ يسمّي ما يسأل عنه: «S1 E1 · شاهدت الحلقة؟» و«شاهدت الفيلم؟» */}
            <Text size={13} weight="500" numberOfLines={1}>{s.kind === "movie" ? t.stremioAskMovieLine : `${ep} · ${t.stremioAsk}`}</Text>
            {/* 🆕 هجرة ٢٣٥ — «من أجهزتك» (البطاقة «أ»): المصدرُ اسمٌ في السطر، و«بدأ التشغيل» لـStremio و«شاهدتها/شاهدته» لسيرفر البيت */}
            <Text size={12} muted numberOfLines={1}>{`${signalSourceLabel(src, t.shahidName)} · ${sourceVerb(src, s.kind, t)} ${timeAgo(s.seen_at, t)}`}</Text>
          </View>
        </Pressable>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button label={s.kind === "movie" ? t.stremioYesMovie : t.stremioYes} size="sm" style={styles.half} onPress={() => onAnswer(s, true)} />
          <Button label={t.stremioNo} size="sm" variant="ghost" style={styles.half} onPress={() => onAnswer(s, false)} />
        </View>
      </View>
    </View>
  );
}

/**
 * ====== 🆕 T361 — ما سُجّل تلقائياً في البطاقة نفسِها (هجرة ٢٤٢) · 🆕 T415 — وما أُجيب عنه بـ✓ ====== 
 * القسمُ ورأسُه واللقطةُ وسطرُ المصدر كما هي — **سطرُ الحالة وحده يتغيّر** (بلون النجاح)، وتحت الصفّ:
 * - **نجوم** (`rateLabel`): «قيّمه» للفيلم، «قيّم المسلسل» لنهايته — وعشرُ نجومٍ بعرض البطاقة، صفُّ النجوم نفسُه في ورقة
 *   الاحتفال (`StarRow spread`)، والحفظُ فعلُ التقييم نفسُه (`track/rate`). حُفظ ⇒ يخرج من البطاقة. و«بدون تقييم» في طرف السطر
 *   (T365: لا يزيد الارتفاع).
 * - **بلا نجوم**: «حسناً» بعرض البطاقة من مصنع الأزرار.
 * ⚖️ T415 — **بطاقةٌ واحدةٌ للحالتين** (التلقائيّ و«شفتها» المُجاب): نسختان من صفِّ النجوم كانتا ستفترقان عند أوّل تعديل.
 */
function DoneCard({
  s,
  count,
  ep,
  steps,
  okStatus,
  onDone,
  onAll,
  onOpen,
}: {
  s: StremioSignal;
  count: number;
  ep: string;
  /**
   * 🆕 T485 — **مراحلُ النجوم بالترتيب** (الحلقةُ ثمّ العمل): لكلٍّ سطرُ حالته واسمُ نجومه وكتابتُها. التقييمُ أو «بدون تقييم» ينقل
   * إلى التالية، وبعد الأخيرة `onDone`. `plain` — سطرُ التلقائيّ (T361): «✓» وحدَها بلون النجاح والحالةُ بلونها. فارغةٌ ⇒ «حسناً».
   */
  steps: { status: string; plain: boolean; label: string; rate: (stars: number) => Promise<boolean> }[];
  /** سطرُ الحالة حين لا نجوم («حسناً») */
  okStatus: string;
  onDone: () => void;
  onAll: () => void;
  onOpen: (s: StremioSignal) => void;
}) {
  const { t, tokens } = useApp();
  const [step, setStep] = useState(0);
  const [stars, setStars] = useState(0);
  const src = s.source ?? "stremio";
  const movie = s.kind === "movie";
  const cur = steps[step] ?? null;
  const status = cur ? cur.status : okStatus;
  const plain = cur ? cur.plain : !!s.auto;
  const next = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
      setStars(0);
    } else onDone();
  };
  const rate = async (n: number) => {
    if (!cur || stars || n < 1) return;
    setStars(n);
    haptic.pick();
    if (!(await cur.rate(n))) {
      setStars(0);
      return;
    }
    next();
  };
  return (
    <View>
      <SectionHeader
        title={t.devicesFrom}
        icon="play"
        onTitle={onAll}
        action={<Text size={12} weight="700" color={tokens.accent}>{String(count)}</Text>}
        seeAll={t.allWord}
        onSeeAll={onAll}
      />
      <View style={{ marginHorizontal: PAGE_PAD, borderRadius: 16, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, padding: 8, gap: 8 }}>
        <Pressable
          onPress={() => onOpen(s)}
          accessibilityRole="button"
          accessibilityLabel={`${s.title}، ${movie ? "" : `${ep}، `}${status}`}
          style={({ pressed }) => ({ flexDirection: "row", gap: 12, opacity: pressed ? 0.85 : 1 })}
        >
          <SignalStill s={s} width={STILL_W} />
          <View style={{ flex: 1, minWidth: 0, height: STILL_H, justifyContent: "space-between" }}>
            <Text size={15} weight="700" numberOfLines={1}>{s.title}</Text>
            {/* التلقائيُّ كما كان (T361): «✓» وحدَها بلون النجاح، والفيلمُ بلا «فيلم ·»، و«خلّصتها». والمُجابُ بـ✓ (T415، الصورةُ المعتمدة):
                السطرُ كسطر السؤال «فيلم · …» والحالةُ كلُّها بلون النجاح، وسطرُ المصدر كما كان في السؤال */}
            <Text size={13} weight="500" numberOfLines={1}>
              {movie ? (plain ? "" : `${t.stremioMovie} · `) : `${ep} · `}
              <Text size={13} weight="700" color={tokens.success}>{plain ? "✓ " : `✓ ${status}`}</Text>
              {plain ? status : ""}
            </Text>
            <Text size={12} muted numberOfLines={1}>{`${signalSourceLabel(src, t.shahidName)} · ${s.auto ? (s.kind === "movie" ? t.serverFinishedMovie : t.serverFinished) : sourceVerb(src, s.kind, t)} ${timeAgo(s.seen_at, t)}`}</Text>
          </View>
        </Pressable>
        {cur ? (
          <View style={{ gap: 6, paddingHorizontal: 4, paddingBottom: 2 }}>
            {/* T365 — «بدون تقييم» في سطر الاسم نفسِه، في طرفه المنطقيّ فينقلب مع العربيّة */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text size={13} weight="700" muted>{cur.label}</Text>
              {stars ? null : (
                <Pressable onPress={next} accessibilityRole="button" hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
                  <Text size={13} weight="700" muted>{t.autoSkipRate}</Text>
                </Pressable>
              )}
            </View>
            {/* `key` بالمرحلة: صفٌّ جديدٌ فارغٌ لنجوم العمل بعد نجوم الحلقة */}
            <View key={step} pointerEvents={stars ? "none" : "auto"}>
              <StarRow spread size={22} value={stars || null} onChange={(n) => void rate(n ?? 0)} />
            </View>
          </View>
        ) : (
          <Button label={t.autoOk} size="sm" style={{ minHeight: 34 }} onPress={onDone} />
        )}
      </View>
    </View>
  );
}

/**
 * فعلُ سطر المصدر: Stremio وNuvio «بدأ التشغيل»، وسيرفرُ البيت «شاهدتها/شاهدته»، و🆕 T579 المنصّةُ «في سجلّك» (السؤالُ عمّا ظهر في سجلّها
 * لا عمّا شغّلتَه أنت — الملفُّ مشترك)
 */
function sourceVerb(src: SignalSource, kind: "tv" | "movie", t: ReturnType<typeof useApp>["t"]): string {
  if (isPlatformSignal(src)) return t.askInHistory;
  if (ALWAYS_ASKS.includes(src)) return t.stremioOpened;
  return kind === "movie" ? t.serverFinishedMovie : t.serverFinished;
}

/** حلقاتُ العمل نفسِه من المنصّة نفسِها المنتظرةُ — بترتيبها (موسماً ثمّ حلقة) — ولا يدخلها ما ينتظر نجومَه */
function sameWork(items: StremioSignal[], s: StremioSignal, rating?: ReadonlyMap<number, StremioSignal>): StremioSignal[] {
  return items
    .filter((x) => x.source === s.source && x.kind === "tv" && x.tmdb_id === s.tmdb_id && !x.auto && !rating?.has(x.id) && x.season != null && x.episode != null)
    .sort((a, b) => (a.season ?? 0) - (b.season ?? 0) || (a.episode ?? 0) - (b.episode ?? 0));
}

/** «S1 E1–E4»، أو «S1 E9 – S2 E2» حين تعبر موسماً */
function rangeLabel(group: StremioSignal[], movieWord: string): string {
  const a = group[0];
  const b = group[group.length - 1];
  return a.season === b.season ? `${episodeLabel(a, movieWord)}–E${b.episode}` : `${episodeLabel(a, movieWord)} – ${episodeLabel(b, movieWord)}`;
}

/**
 * ====== 🆕 T579 — **بطاقةُ العمل: حلقاتٌ ظهرت معاً في سجلّ المنصّة** (أحمد «٢ب»، الصورةُ المعتمدة) ======
 * القسمُ ورأسُه واللقطةُ كالسؤال الواحد. السطرُ «٤ حلقات · شاهدتها كلها؟»، والمصدرُ «Netflix · S1 E1–E4 · قبل ساعة». وتحتها ثلاثةٌ من
 * مصنع الأزرار بارتفاع ٣٤: «✓ كلها» (أساسيّ) · «اختر منها» · «✕ لا». «اختر منها» يفتح **الورقةَ الواحدة** بصفٍّ لكلِّ حلقةٍ ودائرتَي
 * الجواب نفسِهما (`AnswerCircles`) — والجوابُ هناك بلا نجوم (`quiet`)، والورقةُ تُغلق حين لا يبقى فيها شيء.
 */
function GroupCard({
  group,
  count,
  onAnswer,
  onAnswerMany,
  onAll,
  onOpen,
}: {
  group: StremioSignal[];
  count: number;
  onAnswer: (s: StremioSignal, watched: boolean, quiet?: boolean) => void;
  onAnswerMany: (list: StremioSignal[], watched: boolean) => void;
  onAll: () => void;
  onOpen: (s: StremioSignal) => void;
}) {
  const { t, tokens } = useApp();
  const [picking, setPicking] = useState(false);
  const s = group[group.length - 1];
  const src = s.source ?? "stremio";
  const newest = group.reduce((m, x) => (x.seen_at > m ? x.seen_at : m), s.seen_at);
  const n = t.linkEpisodes(group.length);
  return (
    <View>
      <SectionHeader
        title={t.devicesFrom}
        icon="play"
        onTitle={onAll}
        action={<Text size={12} weight="700" color={tokens.accent}>{String(count)}</Text>}
        seeAll={t.allWord}
        onSeeAll={onAll}
      />
      <View style={{ marginHorizontal: PAGE_PAD, borderRadius: 16, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, padding: 8, gap: 8 }}>
        <Pressable
          onPress={() => onOpen(s)}
          accessibilityRole="button"
          accessibilityLabel={`${s.title}، ${t.askEpisodesQ(n)}`}
          style={({ pressed }) => ({ flexDirection: "row", gap: 12, opacity: pressed ? 0.85 : 1 })}
        >
          <SignalStill s={s} width={STILL_W} />
          <View style={{ flex: 1, minWidth: 0, height: STILL_H, justifyContent: "space-between" }}>
            <Text size={15} weight="700" numberOfLines={1}>{s.title}</Text>
            <Text size={13} weight="500" numberOfLines={1}>{t.askEpisodesQ(n)}</Text>
            <Text size={12} muted numberOfLines={1}>{`${signalSourceLabel(src, t.shahidName)} · ${rangeLabel(group, t.stremioMovie)} · ${timeAgo(newest, t)}`}</Text>
          </View>
        </Pressable>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button label={t.askAllYes} size="sm" style={styles.half} onPress={() => onAnswerMany(group, true)} />
          <Button label={t.askPick} size="sm" variant="ghost" style={styles.half} onPress={() => setPicking(true)} />
          <Button label={t.stremioNo} size="sm" variant="ghost" style={styles.half} onPress={() => onAnswerMany(group, false)} />
        </View>
      </View>
      {picking ? (
        <Sheet title={t.askPickTitle} onClose={() => setPicking(false)}>
          <View style={{ gap: 4 }}>
            {group.map((x) => (
              <View key={x.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingHorizontal: 4 }}>
                <Text size={15} weight="600" style={{ flex: 1 }}>{episodeLabel(x, t.stremioMovie)}</Text>
                <AnswerCircles
                  label={`${x.title} ${episodeLabel(x, t.stremioMovie)}`}
                  movie={false}
                  onNo={() => {
                    if (group.length === 1) setPicking(false);
                    onAnswer(x, false, true);
                  }}
                  onYes={() => {
                    if (group.length === 1) setPicking(false);
                    onAnswer(x, true, true);
                  }}
                />
              </View>
            ))}
          </View>
        </Sheet>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  half: { flex: 1, minHeight: 34 },
});

/**
 * 🆕 المهمّة ٥٦١ — **دائرتا الجواب ✕ و✓** — كانتا هنا وحدَهما، ونُقلتا مكوّناً حين احتاجهما جرسُ «التنبيهات» («شغّلت X في Stremio.
 * شاهدتها؟» يُجاب من الجرس — أحمد «١أ»): نسختان من الدائرتين كانتا ستتباعدان.
 */
export function AnswerCircles({ label, movie, onNo, onYes, size = ANSWER_CIRCLE }: { label: string; movie: boolean; onNo: () => void; onYes: () => void; size?: number }) {
  const { t, tokens } = useApp();
  return (
    <>
      <Pressable
        onPress={onNo}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel={`${t.stremioNo} — ${label}`}
        style={({ pressed }) => ({ width: size, height: size, borderRadius: size / 2, borderWidth: 1, borderColor: tokens.border, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}
      >
        <Icon name="close" size={16} color={tokens.muted} />
      </Pressable>
      <Pressable
        onPress={onYes}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel={`${movie ? t.stremioYesMovie : t.stremioYes} — ${label}`}
        style={({ pressed }) => ({ width: size, height: size, borderRadius: size / 2, backgroundColor: tokens.accent, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}
      >
        <Icon name="check" size={18} color={tokens.onAccent} />
      </Pressable>
    </>
  );
}
