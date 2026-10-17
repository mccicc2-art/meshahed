import React, { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Keyboard, Pressable, ScrollView, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { queryClient, write } from "../api";
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
import type { HomePayload, RateBody, SearchTitle, SettingsPayload, TrackResult } from "../contracts";
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
 */
const BODY_MAX = 2000;

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
    setFinding(false);
    setTimeout(() => bodyRef.current?.focus(), 30);
  };

  const ready = !!pick && !!rating && !busy;
  const post = async () => {
    if (!pick || !rating) return;
    setBusy(true);
    try {
      await write<TrackResult>("/api/v1/track/rate", {
        tmdbId: pick.id,
        mediaType: pick.mediaType,
        rating,
        review: body.trim(),
        hasSpoiler: spoiler,
        title: pick.title,
        posterPath: pick.posterPath ?? null,
      } satisfies RateBody);
      haptic.success();
      void queryClient.invalidateQueries({ queryKey: ["community"] });
      Keyboard.dismiss();
      close();
    } catch (e) {
      setBusy(false);
      say(errorText(t, e));
    }
  };

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
              <Text size={20} weight="700" color={rating ? tokens.accent : tokens.border} style={{ fontVariant: ["tabular-nums"] }}>{rating ? num(rating, locale) : "–"}</Text>
              <Pressable onPress={() => { setPick(null); setRating(null); }} hitSlop={10} accessibilityRole="button" accessibilityLabel={t.cancelLabel} style={{ padding: 4 }}>
                <Icon name="close" size={16} color={tokens.muted} />
              </Pressable>
            </View>
            <StarRow spread size={22} value={rating} onChange={setRating} />
            {!rating ? <Text size={12} muted>{t.newPostRateHint}</Text> : null}
          </View>
        ) : (
          <View style={{ flexDirection: "row" }}>
            <Chip label={t.newPostAddTitle} active={false} onPress={openFinder} leading={<Icon name="film" size={14} color={tokens.muted} />} />
          </View>
        )}
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
    </View>
  );
}
