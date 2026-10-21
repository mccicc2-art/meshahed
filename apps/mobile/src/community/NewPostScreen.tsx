import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, Keyboard, Pressable, ScrollView, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { qk, queryClient, write } from "../api";
import { titleQuery } from "../title/seed";
import { PenEpisodeSheet, type PenEpisode } from "./PenEpisodeSheet";
import { useApp } from "../state";
import { Button, Text, type ToastTone } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import { haptic } from "../haptics";
import { SYSTEM_FONT_CAP } from "../fontScale";
import { ToastHost, type ToastHostRef } from "../HoldHost";
import { Chip } from "../library/Chip";
import { StarRow } from "../title/StarRow";
import { useKeyboardInset } from "../messages/chatDock";
import { LoopzPanel } from "../messages/PanelModes";
import { HOME_KEY } from "../home/useHome";
import { Avatar, textIsRtl } from "./CommunityCards";
import { errorText } from "./communityActs";
import { num } from "@/core/i18n";
import type { EpisodeRateBody, HomePayload, RateBody, SearchTitle, SettingsPayload, ShowRefBody, ThreadReplyBody, ThreadReplyResult, ToggleMovieBody, TrackResult } from "../contracts";
import { SETTINGS_KEY } from "../settings/api";

/**
 * ====== 🆕 D-1448 — «بوست جديد» من زرّ القلم في «المجتمع» ======
 *
 * أحمد ١٧ أكتوبر بلقطته الرابعة: ✕ · «بوست جديد» · «انشر» — وجهُك واسمُك و«الكل» — النصّ — «أضف فيلماً أو مسلسلاً» — وشريطٌ
 * فوق لوحة المفاتيح. وقراراتُه: **«١ أ»** البوستُ رأيٌ على عمل (لا بوستَ حرٌّ في هذه الدفعة) · **«٢ أ»** «الكل» ظاهرةٌ ثابتة ·
 * **«٣ أ»** الشريطُ: العملُ و«فيها حرق» — الصورةُ والـGIF ينتظران عموداً في `ratings` (هجرةٌ بإذنه)، والمايكُ لاحقاً.
 *
 * 🔑 **الكتابةُ مسارُ صفحة العمل نفسُه** (`POST /track/rate`): البوستُ تقييمٌ ورأي، فيظهر في الخطّ وفي صفحة العمل وفي ملفّك
 * كأيّ رأي — لا جدولَ ثانٍ ولا نسخةَ ثانيةً من المنطق. **والتقييمُ إلزاميٌّ** لأنّ القاعدة لا تقبل رأياً بلا نجوم؛ لذا «انشر»
 * يتفعّل بعملٍ ونجمة، وتحت العمل سطرٌ يقول «قيّمه لتنشر».
 * 🔑 **«أضف عملاً» يبحث في الشريط نفسِه**: خانةُ بحثٍ مكانَ الأدوات وفوقها صفُّ الملصقات (`LoopzPanel` المضغوط — لوحةُ «+»
 * في المحادثات نفسُها)، واللمسةُ تختار وتعيد المؤشّرَ إلى النصّ.
 *
 * ====== 🆕 R58 — «شاهدته؟» ووجهةُ المنشور (أحمد ٢١ أكتوبر — التصاميمُ المعتمدة ①–⑭، وشكلُ السطر الواحد) ======
 * **النجمةُ صارت اختياريّة**، والعملُ يحمل تحته **سطراً واحداً** بحبّاتٍ صغيرة (اعتُمد ١٧:٣٤):
 *  - فيلمٌ لم يُعلَّم: «شاهدته؟» نعم · لسه — و«انشر» مطفأٌ حتى يجيب («١ ب»). نعم ⇒ يُعلَّم وتظهر النجوم؛ لسه ⇒ بلا نجوم.
 *  - مسلسل: كله · حلقة › · لسه — «حلقة» تفتح «أي حلقة؟» على مكانه (`PenEpisodeSheet`)، ونجومُها للحلقة وحدَها.
 *  - شاهدته ولم تقيّمه ⇒ النجومُ مباشرة؛ شاهدته وقيّمته ⇒ «✓ شاهدته · تقييمك ★ ٨» ولا نجوم: المنشورُ نقاشٌ ورأيُك القديمُ باقٍ.
 *    والمسلسلُ المخلَّص يبقى له «حلقة ›» في آخر السطر («اذا بيحدد اخر حلقة»).
 * **والوجهة** (سطرٌ تحت البطاقة يقولها دائماً): نجومٌ ⇒ تقييمٌ ورأيٌ كاليوم (أو تقييمُ الحلقة) · بلا نجوم ⇒ «عام» الغرفة أو غرفةُ
 * الحلقة (`via: pen` فيظهر في الأنشطة) · بلا عمل ⇒ «النقاش العام». وقواعدُ المشاهدة على الخادم (`markWatchedUpTo`).
 */
const BODY_MAX = 2000;

type Answer = "yes" | "all" | "ep" | "not" | null;

export function NewPostScreen() {
  const { t, tokens, locale } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const root = useRef<View>(null);
  const kb = useKeyboardInset(root);
  const bodyRef = useRef<TextInput>(null);
  const searchRef = useRef<TextInput>(null);
  const toast = useRef<ToastHostRef>(null);
  const say = useCallback((s: string, tone?: ToastTone) => toast.current?.say(s, undefined, undefined, tone), []);

  const [body, setBody] = useState("");
  const [pick, setPick] = useState<SearchTitle | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [spoiler, setSpoiler] = useState(false);
  const [answer, setAnswer] = useState<Answer>(null);
  const [ep, setEp] = useState<PenEpisode | null>(null);
  const [sheet, setSheet] = useState(false);
  const [finding, setFinding] = useState(false);
  const [term, setTerm] = useState("");
  const [busy, setBusy] = useState(false);

  /* وجهُك واسمُك من كاشَين قائمَين (ترويسةُ الرئيسيّة ثمّ الإعدادات) — كمعاينة «تخصيص» */
  const head = queryClient.getQueryData<HomePayload>(HOME_KEY)?.header;
  const account = queryClient.getQueryData<SettingsPayload>(SETTINGS_KEY)?.account;
  const myName = head?.display_name ?? account?.nickname ?? account?.username ?? "";
  const myFace = head?.avatar_url ?? account?.avatar_url ?? null;

  const close = useCallback(() => {
    Keyboard.dismiss();
    if (router.canGoBack()) router.back();
    else router.replace("/community");
  }, [router]);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (finding) {
        setFinding(false);
        return true;
      }
      close();
      return true;
    });
    return () => sub.remove();
  }, [finding, close]);

  const openFinder = () => {
    setTerm("");
    setFinding(true);
    setTimeout(() => searchRef.current?.focus(), 30);
  };
  const choose = (r: SearchTitle) => {
    setPick(r);
    setRating(null);
    setAnswer(null);
    setEp(null);
    setFinding(false);
    setTimeout(() => bodyRef.current?.focus(), 30);
  };
  const clearPick = () => {
    setPick(null);
    setRating(null);
    setAnswer(null);
    setEp(null);
  };

  /* حالتي من كاش صفحة العمل (`titleQuery` — يُجلب إن لم يكن): شاهدتُه؟ قيّمتُه؟ أين وصلت؟ */
  const tq = useQuery({ ...titleQuery(pick?.mediaType ?? "movie", pick?.id ?? 0), enabled: !!pick });
  const info = pick && tq.data && tq.data.kind === pick.mediaType ? tq.data : null;
  const tv = info && info.kind === "tv" ? info : null;
  const mv = info && info.kind === "movie" ? info : null;
  const myRating = info?.me.rating ?? null;
  const watchedSet = useMemo(() => new Set(tv?.me.watched ?? []), [tv]);
  const at = useMemo(() => {
    let best: { season: number; episode: number } | null = null;
    for (const k of tv?.me.watched ?? []) {
      const [s, e] = k.split(":").map(Number);
      if (!Number.isInteger(s) || !Number.isInteger(e) || s <= 0) continue;
      if (!best || s > best.season || (s === best.season && e > best.episode)) best = { season: s, episode: e };
    }
    return best;
  }, [tv]);
  const seriesDone = !!tv && tv.me.watched_count > 0 && tv.me.watched_count >= tv.aired_total;
  const movieWatched = !!mv && mv.me.watched === true;
  /* السؤالُ لمن لم يُعلَّم عنده العملُ مشاهَداً كلَّه */
  const asks = !!pick && !!info && (mv ? !movieWatched : !seriesDone);
  const watchedNow = movieWatched || seriesDone || answer === "yes" || answer === "all" || answer === "ep";
  /* النجوم: حلقةٌ مختارةٌ لم تُقيَّم · أو العملُ شاهدتَه ولم تقيّمه */
  const epStars = !!ep && ep.myRating == null;
  const titleStars = !ep && watchedNow && myRating == null && answer !== "not";
  const showStars = epStars || titleStars;
  const stars = showStars ? rating : null;

  const pickEpisode = (e: PenEpisode) => {
    setEp(e);
    setAnswer(asks ? "ep" : answer);
    setRating(null);
    /* منشورٌ عن حلقةٍ بعينها محجوبٌ افتراضاً (أحمد «١ أ») — ويُطفأ باليد */
    setSpoiler(true);
    setSheet(false);
  };
  const clearEpisode = () => {
    setEp(null);
    if (answer === "ep") setAnswer(null);
    setSpoiler(false);
  };

  const needsAnswer = asks && answer === null;
  const hasText = body.trim().length > 0;
  const ready = !busy && (pick ? !!info && !needsAnswer && (hasText || !!stars) : hasText);

  const toLine = (): { lead: string; bold: string; tail?: string } => {
    if (!pick) return { lead: t.penTo, bold: t.talkGeneralTitle };
    if (needsAnswer) return { lead: "", bold: t.penAnswer };
    if (ep) return stars ? { lead: t.penTo, bold: `${t.penToRating} · ${t.epChip(ep.season, ep.episode, 0)}` } : { lead: t.penTo, bold: t.penToEpisode(ep.episode), tail: t.penCovered };
    if (stars) return { lead: t.penTo, bold: `${t.penToRating} · ${pick.title}` };
    return { lead: t.penTo, bold: t.penToGeneral(pick.title), tail: myRating != null ? t.penKeeps : undefined };
  };

  const post = async () => {
    if (!ready) return;
    setBusy(true);
    try {
      const text = body.trim();
      if (pick && answer === "yes" && mv && !movieWatched)
        await write("/api/v1/track/movie", { movieTmdbId: pick.id, runtime: mv.runtime ?? null, watched: true } satisfies ToggleMovieBody);
      if (pick && answer === "all" && tv && !seriesDone) await write("/api/v1/track/show-watched", { showTmdbId: pick.id } satisfies ShowRefBody);
      if (pick && ep && stars) {
        /* تقييمُ الحلقة — والخادمُ يعلّمها وما قبلها مشاهَدة («٢ أ») */
        await write("/api/v1/track/episode-rate", { showTmdbId: pick.id, season: ep.season, episode: ep.episode, rating: stars, review: text || null, spoiler } satisfies EpisodeRateBody);
      } else if (pick && stars) {
        await write<TrackResult>("/api/v1/track/rate", {
          tmdbId: pick.id,
          mediaType: pick.mediaType,
          rating: stars,
          review: text,
          hasSpoiler: spoiler,
          title: pick.title,
          posterPath: pick.posterPath ?? null,
        } satisfies RateBody);
      } else {
        /* نقاشٌ من القلم: «عام» الغرفة · غرفةُ الحلقة (والخادمُ يعلّم المشاهدة حتى هي) · أو «النقاش العام» */
        await write<ThreadReplyResult>("/api/v1/thread/reply", {
          target: pick ? { kind: "talk", tmdb_id: pick.id, media_type: pick.mediaType } : { kind: "talk", tmdb_id: 0, media_type: "general" },
          body: text,
          has_spoiler: spoiler,
          via: "pen",
          ...(pick && ep && pick.mediaType === "tv" ? { season: ep.season, episode: ep.episode } : {}),
        } satisfies ThreadReplyBody);
      }
      haptic.success();
      void queryClient.invalidateQueries({ queryKey: ["community"] });
      if (pick) void queryClient.invalidateQueries({ queryKey: qk.title(pick.mediaType, pick.id) });
      void queryClient.invalidateQueries({ queryKey: ["thread"] });
      Keyboard.dismiss();
      close();
    } catch (e) {
      setBusy(false);
      say(errorText(t, e));
    }
  };

  const pill = (label: string, on: boolean, onPress: () => void, key: string) => (
    <Pressable key={key} onPress={onPress} hitSlop={4} accessibilityRole="button" accessibilityState={{ selected: on }} style={({ pressed }) => ({ paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1, borderColor: on ? tokens.accent : tokens.border, backgroundColor: on ? tokens.accent : tokens.surface, opacity: pressed ? 0.7 : 1 })}>
      <Text size={12} weight="700" color={on ? tokens.onAccent : tokens.fg} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
  const epPill = (key: string) =>
    ep
      ? pill(`${t.epChip(ep.season, ep.episode, 0)}  ✕`, true, clearEpisode, key)
      : pill(`${t.penEpisode} ›`, false, () => setSheet(true), key);

  const rtlBody = textIsRtl(body);
  const bottom = kb > 0 ? kb : insets.bottom;

  return (
    <View ref={root} style={{ flex: 1, backgroundColor: tokens.bg, paddingTop: insets.top }}>
      {/* الرأس: ✕ · العنوان · «انشر» */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, height: 56, borderBottomWidth: 1, borderBottomColor: tokens.divider }}>
        <Pressable onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel={t.cancelLabel} style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}>
          <Icon name="close" size={22} color={tokens.fg} />
        </Pressable>
        <Text size={17} weight="700" style={{ flex: 1, textAlign: "center" }}>{t.newPostTitle}</Text>
        <Button label={t.newPostSend} size="sm" busy={busy} disabled={!ready} onPress={() => void post()} />
      </View>

      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Avatar uri={myFace} size={44} />
          <View style={{ gap: 4, flexShrink: 1 }}>
            <Text size={15} weight="700" numberOfLines={1}>{myName}</Text>
            {/* «٢ أ»: ثابتةٌ حتى يصير للبوست جمهور — حبّةٌ تقول لمن يُنشر، لا قائمةٌ تخدع بخيارٍ لا يعمل */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, borderWidth: 1, borderColor: tokens.accent }}>
              <Icon name="people" size={12} color={tokens.accent} />
              <Text size={12} weight="700" color={tokens.accent}>{t.newPostAudienceAll}</Text>
            </View>
          </View>
        </View>

        <TextInput
          ref={bodyRef}
          maxFontSizeMultiplier={SYSTEM_FONT_CAP}
          value={body}
          onChangeText={setBody}
          autoFocus
          multiline
          maxLength={BODY_MAX}
          placeholder={t.newPostPlaceholder}
          placeholderTextColor={tokens.muted}
          textAlignVertical="top"
          style={{ minHeight: 120, fontSize: 17, lineHeight: 26, color: tokens.fg, padding: 0, textAlign: body ? (rtlBody ? "right" : "left") : undefined, writingDirection: body ? (rtlBody ? "rtl" : "ltr") : undefined }}
        />

        {pick ? (
          <View style={{ gap: 10, padding: 10, borderRadius: radius.card, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 40, aspectRatio: 2 / 3, borderRadius: radius.poster, overflow: "hidden", backgroundColor: tokens.surface2 }}>
                {pick.poster ? <Image source={{ uri: pick.poster }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" /> : null}
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text size={14} weight="700" numberOfLines={1}>{pick.title}</Text>
                <Text size={12} muted numberOfLines={1}>{`${pick.mediaType === "tv" ? t.typeSeries : t.typeMovie}${pick.year ? ` · ${pick.year}` : ""}`}</Text>
              </View>
              <Pressable onPress={clearPick} hitSlop={10} accessibilityRole="button" accessibilityLabel={t.cancelLabel} style={{ padding: 4 }}>
                <Icon name="close" size={16} color={tokens.muted} />
              </Pressable>
            </View>
            {/* 🆕 R58 — السطرُ الواحد: حالتُك في البداية، والحبّاتُ في النهاية (الصور ①–⑬ بشكل ⑪) */}
            {info ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, paddingHorizontal: 10, borderRadius: radius.md, backgroundColor: tokens.surface2 }}>
                <View style={{ flexShrink: 1, flexDirection: "row", alignItems: "center", gap: 4, minWidth: 0 }}>
                  {asks ? (
                    at && tv ? (
                      <Text size={12} weight="600" color={tokens.success} numberOfLines={1}>{`📍 ${t.penAt(at.episode)}`}</Text>
                    ) : (
                      <Text size={12} weight="700" numberOfLines={1}>{t.penWatchedQ}</Text>
                    )
                  ) : (
                    <>
                      <Icon name="check" size={13} color={tokens.success} />
                      <Text size={12} weight="600" color={tokens.success} numberOfLines={1}>{t.penWatched}</Text>
                      {myRating != null ? (
                        <Text size={12} muted numberOfLines={1}>
                          {` · ${t.penYourRating} `}
                          <Text size={12} weight="700" color={tokens.accent}>{`★ ${num(myRating, locale)}`}</Text>
                        </Text>
                      ) : null}
                    </>
                  )}
                </View>
                <View style={{ marginStart: "auto", flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  {asks && mv
                    ? [
                        pill(`✓ ${t.penYes}`, answer === "yes", () => { setAnswer("yes"); setRating(null); }, "y"),
                        pill(t.penNotYet, answer === "not", () => { setAnswer("not"); setRating(null); }, "n"),
                      ]
                    : asks && tv
                      ? [
                          pill(t.penAll, answer === "all", () => { setAnswer("all"); setEp(null); setRating(null); }, "a"),
                          epPill("e"),
                          pill(t.penNotYet, answer === "not", () => { setAnswer("not"); setEp(null); setRating(null); setSpoiler(false); }, "n"),
                        ]
                      : tv
                        ? epPill("e")
                        : null}
                </View>
              </View>
            ) : (
              <Text size={12} muted>…</Text>
            )}
            {showStars ? (
              <>
                <StarRow spread size={22} value={rating} onChange={setRating} />
                <Text size={12} muted>
                  {ep ? t.penRateEp(ep.episode) : t.penRateOpt}
                  {rating ? <Text size={12} weight="700" color={tokens.accent}>{` · ${num(rating, locale)}`}</Text> : null}
                </Text>
              </>
            ) : null}
          </View>
        ) : (
          <View style={{ flexDirection: "row" }}>
            <Chip label={t.newPostAddTitle} active={false} onPress={openFinder} leading={<Icon name="film" size={14} color={tokens.muted} />} />
          </View>
        )}
        {/* 🆕 R58 — الوجهةُ دائماً تحت (لا مفاجآت): أين يذهب هذا المنشور */}
        {(() => {
          const d = toLine();
          return (
            <Text size={12} muted>
              {d.lead ? `➜ ${d.lead} ` : "➜ "}
              <Text size={12} weight="700" color={needsAnswer ? tokens.muted : tokens.fg}>{d.bold}</Text>
              {d.tail ? ` · ${d.tail}` : ""}
            </Text>
          );
        })()}
      </ScrollView>

      {/* الشريطُ فوق لوحة المفاتيح — والبحثُ عن عملٍ يحلّ محلَّه */}
      <View style={{ paddingBottom: bottom, borderTopWidth: 1, borderTopColor: tokens.divider, backgroundColor: tokens.surface }}>
        {finding ? (
          <>
            <LoopzPanel term={term} compact onPick={choose} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, height: 52 }}>
              <Icon name="search" size={18} color={tokens.muted} />
              <TextInput
                ref={searchRef}
                maxFontSizeMultiplier={SYSTEM_FONT_CAP}
                value={term}
                onChangeText={setTerm}
                placeholder={t.newPostSearch}
                placeholderTextColor={tokens.muted}
                returnKeyType="search"
                style={{ flex: 1, fontSize: 15, color: tokens.fg, paddingVertical: 8 }}
              />
              <Pressable onPress={() => { setFinding(false); bodyRef.current?.focus(); }} hitSlop={10} accessibilityRole="button" accessibilityLabel={t.cancelLabel}>
                <Icon name="close" size={18} color={tokens.muted} />
              </Pressable>
            </View>
          </>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 22, paddingHorizontal: 16, height: 48 }}>
            <Pressable onPress={openFinder} hitSlop={10} accessibilityRole="button" accessibilityLabel={t.newPostAddTitle}>
              <Icon name="film" size={21} color={tokens.accent} />
            </Pressable>
            <Pressable onPress={() => setSpoiler((v) => !v)} hitSlop={10} accessibilityRole="switch" accessibilityState={{ checked: spoiler }} accessibilityLabel={t.spoilerMark} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Icon name={spoiler ? "eye-off" : "eye"} size={20} color={spoiler ? tokens.accent : tokens.muted} />
              {spoiler ? <Text size={12} weight="700" color={tokens.accent}>{t.spoilerMark}</Text> : null}
            </Pressable>
            <Text size={12} muted style={{ marginStart: "auto", fontVariant: ["tabular-nums"] }}>{`${num(body.length, locale)} / ${num(BODY_MAX, locale)}`}</Text>
          </View>
        )}
      </View>
      <ToastHost hostRef={toast} bottom={bottom + 64} />
      {sheet && pick && tv ? (
        <PenEpisodeSheet
          showId={pick.id}
          seasons={tv.seasons}
          watched={watchedSet}
          at={at}
          done={seriesDone}
          onPick={pickEpisode}
          onGeneral={() => { clearEpisode(); setSheet(false); }}
          onClose={() => setSheet(false)}
        />
      ) : null}
    </View>
  );
}
