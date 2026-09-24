import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon } from "../icons";
import { Logo } from "../Logo";
import { radius } from "../theme";
import { PAGE_PAD } from "./Section";
import type { HomeHeaderPayload } from "../contracts";

/**
 * ترويسةُ الرئيسية — `HomeHeader.tsx` الويبيّة بأرقامها (Phase 11-H · H2):
 * - **الغلافُ** يخرج عن الهوامش، ارتفاعُه `safe-top + 164` وصلبٌ حتى `safe-top +
 *   135` ثمّ يذوب (D-836/D-853)، وفوقه حجابٌ واحدٌ مسطّح **٠٫٣٠** (D-616 → D-661 →
 *   قيمةُ اليوم في `COVER_SCRIM`) — لونٌ واحدٌ بلا تدرّج.
 * - **الشريطُ**: الشعارُ في البداية، وفي النهاية الظرفُ والجرسُ والترس (D-620/D-776)،
 *   بيضاءُ فوق الغلاف وثيميّةٌ بدونه.
 * - **صفُّ الترحيب**: الصورةُ ٥٦ (D-853)، الاسمُ ٢٠/٧٠٠، سطرُ `@username • ن يتابعونني • ن أتابع`
 *   ١٢ باهت (D-618/D-621)، ومبدّلُ العرض في الطرف (رمزٌ وحدَه — D-434 المنقوضة).
 * - **بطاقةُ الأرقام**: بطاقةٌ واحدةٌ في الوضعين (D-439)، عمودان عند أربع خانات
 *   (D-620)، فاصلٌ رفيع، رمزٌ أصفرُ ورقمٌ ١٥/٧٠٠ واسمٌ ١٢ باهت (D-437/D-787).
 *
 * ⚠️ الذوبانُ في الويب `mask-image`؛ هنا يُرسم بحجاب الملصق (`poster-veil`)
 * مقلوباً فوق ذيل الغلاف — الأثرُ نفسُه بلا مكتبةِ تدرّج.
 */
export const COVER_H = 164;
export const COVER_SOLID = 135;
const COVER_SCRIM = "rgba(0,0,0,0.30)";
const VEIL = require("../../assets/poster-veil.png");

export function HomeCover({ url, pos }: { url: string | null; pos: number | null }) {
  const insets = useSafeAreaInsets();
  const { tokens } = useApp();
  if (!url) return null;
  const h = insets.top + COVER_H;
  const solid = insets.top + COVER_SOLID;
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height: h, overflow: "hidden" }}>
      <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={{ top: `${pos ?? 30}%`, left: "50%" }} transition={200} cachePolicy="memory-disk" />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: COVER_SCRIM }]} />
      {/* الذوبانُ إلى خلفيّة الصفحة من الخطّ الصلب إلى القاع */}
      <Image source={VEIL} tintColor={tokens.bg} style={{ position: "absolute", left: 0, right: 0, top: solid, height: h - solid }} contentFit="fill" />
      <View style={{ position: "absolute", left: 0, right: 0, top: h - 1, height: 1, backgroundColor: tokens.bg }} />
    </View>
  );
}

export function HomeTopBar({
  onArt,
  unreadSignals,
  unreadShares,
  onInbox,
  onSignals,
  onSettings,
}: {
  onArt: boolean;
  unreadSignals: number;
  unreadShares: number;
  onInbox: () => void;
  onSignals: () => void;
  onSettings: () => void;
}) {
  const { t, tokens } = useApp();
  const fg = onArt ? "#fff" : tokens.fg;
  const btn = (name: "mail" | "bell" | "settings", label: string, onPress: () => void, count: number) => (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={count > 0 ? `${label} (${count})` : label} hitSlop={4} style={({ pressed }) => [{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 }]}>
      <Icon name={name} size={22} color={fg} />
      {count > 0 ? <View style={{ position: "absolute", top: 7, end: 7, width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.accent }} /> : null}
    </Pressable>
  );
  return (
    <View style={{ height: 64, flexDirection: "row", alignItems: "center", paddingHorizontal: PAGE_PAD }}>
      {/* الكلمةُ لا الرمز — قرارُ أحمد ٢٢ سبتمبر: «loopz مثل الويب للهوم، باقي الأقسام شعار لوبز» */}
      <Logo size={30} variant="wordmark" onArt={onArt} />
      <View style={{ flex: 1 }} />
      {btn("mail", t.communityTabInbox, onInbox, unreadShares)}
      {btn("bell", t.notifTitle, onSignals, unreadSignals)}
      {btn("settings", t.settingsNavHeading, onSettings, 0)}
    </View>
  );
}

export function HomeGreeting({
  h,
  onArt,
  view,
  onToggleView,
  onAvatar,
  onFollowers,
  onFollowing,
}: {
  h: HomeHeaderPayload;
  onArt: boolean;
  view: "visual" | "compact";
  onToggleView: () => void;
  onAvatar: () => void;
  onFollowers: () => void;
  onFollowing: () => void;
}) {
  const { t, tokens } = useApp();
  const next = view === "visual" ? "compact" : "visual";
  const muted = onArt ? "rgba(255,255,255,0.7)" : tokens.muted;
  const fg = onArt ? "#fff" : tokens.fg;
  return (
    <View style={{ paddingHorizontal: PAGE_PAD, flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Pressable onPress={onAvatar} accessibilityRole="link" accessibilityLabel={h.display_name} style={{ width: 56, height: 56, borderRadius: 28, overflow: "hidden", borderWidth: 2, borderColor: onArt ? "rgba(255,255,255,0.6)" : tokens.border, backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
        {h.avatar_url ? <Image source={{ uri: h.avatar_url }} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={{ top: `${h.avatar_pos ?? 50}%`, left: "50%" }} cachePolicy="memory-disk" /> : <Icon name="people" size={24} color={tokens.muted} />}
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text size={20} weight="700" color={fg} numberOfLines={1} style={[{ flexShrink: 1, lineHeight: 24 }, onArt ? styles.shadow : null]}>{h.display_name}</Text>
          {h.verified_at ? <Icon name="check-line" size={16} color={tokens.verified} /> : null}
          {h.plan && h.plan !== "free" ? (
            <View style={{ paddingHorizontal: 6, height: 18, borderRadius: 9, backgroundColor: tokens.accent, alignItems: "center", justifyContent: "center" }}>
              <Text size={10} weight="700" color={tokens.onAccent}>+</Text>
            </View>
          ) : null}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
          {h.username ? <Text size={12} color={muted} numberOfLines={1} style={{ flexShrink: 1 }}>@{h.username}</Text> : null}
          {h.username ? <Text size={12} color={muted} style={{ opacity: 0.6 }}>•</Text> : null}
          {/* القفلُ كالويب (`locked` في `FollowCountButton`): العددُ يُرى والورقةُ لا تُفتح */}
          <Pressable onPress={onFollowers} disabled={h.hide_follow_lists} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${h.followers} ${t.followersLabel}`} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <Icon name="people" size={12} color={muted} />
            <Text size={12} weight="600" color={muted} style={{ fontVariant: ["tabular-nums"] }}>{String(h.followers)}</Text>
          </Pressable>
          <Pressable onPress={onFollowing} disabled={h.hide_follow_lists} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${h.following} ${t.followingLabel}`} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <Icon name="heart" size={12} color={muted} />
            <Text size={12} weight="600" color={muted} style={{ fontVariant: ["tabular-nums"] }}>{String(h.following)}</Text>
          </Pressable>
        </View>
      </View>
      <Pressable
        onPress={onToggleView}
        accessibilityRole="button"
        accessibilityLabel={`${t.viewSwitchAria} — ${next === "compact" ? t.viewCompact : t.viewVisual}`}
        hitSlop={6}
        style={({ pressed }) => [{ width: 44, height: 36, borderRadius: radius.lg, borderWidth: 1, borderColor: onArt ? "rgba(255,255,255,0.45)" : tokens.border, backgroundColor: onArt ? "rgba(0,0,0,0.25)" : tokens.surface, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 }]}
      >
        <Icon name={next === "compact" ? "list" : "grip"} size={15} color={fg} />
      </Pressable>
    </View>
  );
}

export function HomeStats({ h, onStat }: { h: HomeHeaderPayload; onStat: (href: string) => void }) {
  const { tokens } = useApp();
  const stats = h.stats;
  if (!h.show_stats || stats.length === 0) return null;
  /* 🆕 D-1129 — **أربعةٌ في صفٍّ واحد** (أحمد بلقطة: «إذا كانت ٤ أبغاها خط واحد»؛ كانت عمودين ×
     سطرين — D-620). ربعُ العرض (~٨٧) لا يتّسع لأيقونةٍ ورقمٍ واسمٍ في سطر («120d Time» يُقصّ)، فالخانةُ
     عند الأربعة **عموديّة**: الأيقونةُ والرقمُ فوق والاسمُ تحته — بالأحجام نفسِها. الاثنان والثلاثة كما هي. */
  const stacked = stats.length === 4;
  /* D-1093 — بطاقةُ الأرقام على لون الصفحة (`bg`) بلا فواصل بين الخانات (أحمد بلقطة: «خلّ خلفيّتها سوداء
     بدل رصاصي وبدون خطوط بينهم»): وصفةُ D-1081 — الإطارُ الخارجيُّ الرفيع وحده يحدّها، و`bg` لا `#000`
     كي تصحّ `daylight`. الفراغُ بين الأرقام الثلاثة يفصلها وحدَه؛ خطٌّ فوقه كان يكرّر الفصل. */
  return (
    <View style={{ marginHorizontal: PAGE_PAD, marginTop: 10, borderRadius: 16, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.bg, overflow: "hidden" }}>
      <View style={{ flexDirection: "row" }}>
        {stats.map((s) =>
          stacked ? (
            <Pressable key={s.key} onPress={() => onStat(s.href)} accessibilityRole="link" accessibilityLabel={`${s.value} ${s.label}`} style={({ pressed }) => [{ flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 2, paddingVertical: 11, opacity: pressed ? 0.7 : 1 }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Icon name={s.icon as never} size={16} color={tokens.accent} />
                <Text size={15} weight="700" style={{ fontVariant: ["tabular-nums"], lineHeight: 18 }}>{s.value}</Text>
              </View>
              <Text size={12} weight="500" muted numberOfLines={1} style={{ lineHeight: 14, maxWidth: "100%" }}>{s.label}</Text>
            </Pressable>
          ) : (
            <Pressable key={s.key} onPress={() => onStat(s.href)} accessibilityRole="link" accessibilityLabel={`${s.value} ${s.label}`} style={({ pressed }) => [{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 6, paddingVertical: 12, opacity: pressed ? 0.7 : 1 }]}>
              <Icon name={s.icon as never} size={16} color={tokens.accent} />
              <Text size={15} weight="700" style={{ fontVariant: ["tabular-nums"], lineHeight: 18 }}>{s.value}</Text>
              <Text size={12} weight="500" muted numberOfLines={1} style={{ flexShrink: 1, lineHeight: 14 }}>{s.label}</Text>
            </Pressable>
          ),
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: { textShadowColor: "rgba(0,0,0,0.9)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 5 },
});
