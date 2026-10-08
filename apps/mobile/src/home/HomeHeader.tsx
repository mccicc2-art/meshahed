import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon } from "../icons";
import { Logo } from "../Logo";
import { PAGE_PAD } from "./Section";
import type { HomeHeaderPayload } from "../contracts";
import { IdentityBadges, identityFlags } from "../IdentityBadges";
import { nextHomeView, type HomeView } from "@/core/homePrefs";

/**
 * ترويسةُ الرئيسية — `HomeHeader.tsx` الويبيّة بأرقامها (Phase 11-H · H2).
 * ⚖️ D-1233: الرئيسيّةُ نفسُها لم تعد ترسم الغلافَ — `HomeCover` باقٍ لأنّ `ProfileScreen` يقرؤه؛ وبطاقةُ الأرقام
 *   باقيةٌ في الاثنين. الوصفُ أدناه وصفُ الأصل:
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
      <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={{ top: `${pos ?? 30}%`, left: "50%" }} /* D-1244 — بلا تلاشٍ: الغلافُ مسخَّنٌ مع الحمولة، والتلاشي كان يُظهر الرأسَ قبل غلافه */ transition={0} cachePolicy="memory-disk" priority="high" />
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

/**
 * 🆕 D-1233 — **صفُّ الترحيب صفٌّ واحد** (أحمد بثلاث لقطات، ٣ أكتوبر ٢٠٢٦): الصورةُ ٣٢ (اليوم ٣٨ — D-1278) · الاسمُ ٢٢/٧٠٠ (حجمُ عنوان القسم تحته — قياسُ لقطته) · شارةُ
 * الاشتراك (`PARTNER`/`PLUS`، ولا شيء لغير المشترك) · مبدّلُ العرض في الطرف.
 * - **خرج منه**: سطرُ `@username • المتابعون`، وختمُ التوثيق (قرارُه: «يُحذف من الهوم» — يبقى في الملفّ والإعدادات)،
 *   وألوانُ «فوق الغلاف» (`onArt`) لأنّ الغلافَ نفسَه خرج من الرئيسيّة.
 * - **المبدّلُ على خطِّ «الكلّ»** («خلّ تغيير الوضع متساوي على نفس الخط مع all اللي تحت»): هدفُ اللمس ما زال ٤٠،
 *   لكنّ الرمزَ يُسنَد إلى طرفه لا إلى وسطه؛ و`ICON_INSET` يعوّض هامشَ الرسمة الشفّاف (٩ من ٧٢ في `list.png`
 *   و`grid.png`) — بدونه يقف الرمزُ المرئيُّ ٢٫٢٥ قبل حافّة «الكلّ».
 */
/* 🆕 D-1278 — ٣٨ (كانت ٣٢): أحمد «أحسّ اسم KHLD كبير على الأفتار» واختار ٣٨ من صورةٍ بثلاثة مقاسات. الاسمُ ٢٢
   بسطرٍ ٢٨ كان يكاد يساوي الصورة؛ و٣٨ دون هدف المبدّل (٤٠) فلا يطول الصفّ. */
const AVATAR = 38;
const SWITCH_ICON = 18;
const ICON_INSET = (9 / 72) * SWITCH_ICON;
/* مقاسُ الشارة مستقلٌّ عن الاسم: قرصُ اللقطات ~١٦ ارتفاعاً، وهو ما تعطيه `IdentityBadges` عند ٢٠ — الاسمُ كبر والشارةُ لا */
const PILL_NAME_SIZE = 20;

export function HomeGreeting({
  h,
  view,
  onToggleView,
  onAvatar,
  avatarRef,
}: {
  h: HomeHeaderPayload;
  view: HomeView;
  onToggleView: () => void;
  onAvatar: () => void;
  /** D-1318 — مرساةُ الجولة: الحلقةُ و«اضغط هنا» تُقاسان على هذه الصورة */
  avatarRef?: React.Ref<View>;
}) {
  const { t, tokens } = useApp();
  /* 🆕 D-1321 — ثلاثةُ أوضاعٍ تدور، **والرمزُ يصف الحالَ لا الوجهة** (حكمُ أحمد ٨ أكتوبر: «الحالي»): بثلاثةٍ لا يعرف
     الناظرُ أين هو من رمز ما سيأتي. والوجهةُ باقيةٌ في الاسم المنطوق. */
  const next = nextHomeView(view);
  const nameOf = (v: HomeView) => (v === "compact" ? t.viewCompact : v === "mixed" ? t.viewMixed : t.viewVisual);
  return (
    <View style={{ paddingHorizontal: PAGE_PAD, flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Pressable ref={avatarRef} onPress={onAvatar} accessibilityRole="link" accessibilityLabel={h.display_name} hitSlop={6} style={{ width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, overflow: "hidden", borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
        {h.avatar_url ? <Image source={{ uri: h.avatar_url }} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={{ top: `${h.avatar_pos ?? 50}%`, left: "50%" }} cachePolicy="memory-disk" /> : <Icon name="people" size={19} color={tokens.muted} />}
      </Pressable>
      {/* `flex: 1` للحاوية لا للاسم (D-634): الشارةُ تبقى ملتصقةً بالاسم والمبدّلُ يُدفع إلى الطرف */}
      <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text size={22} weight="700" numberOfLines={1} style={{ flexShrink: 1, lineHeight: 28 }}>{h.display_name}</Text>
        <IdentityBadges flags={{ ...identityFlags(h), verified: false }} nameSize={PILL_NAME_SIZE} />
      </View>
      <Pressable
        onPress={onToggleView}
        accessibilityRole="button"
        accessibilityLabel={`${t.viewSwitchAria} — ${nameOf(next)}`}
        hitSlop={6}
        style={({ pressed }) => [{ width: 40, height: 40, alignItems: "flex-end", justifyContent: "center", marginEnd: -ICON_INSET, opacity: pressed ? 0.7 : 1 }]}
      >
        <Icon name={view === "compact" ? "list" : view === "mixed" ? "view-mixed" : "grid"} size={SWITCH_ICON} color={tokens.accent} />
      </Pressable>
    </View>
  );
}

export function HomeStats({ h, onStat }: { h: HomeHeaderPayload; onStat: (href: string) => void }) {
  if (!h.show_stats) return null;
  return <StatsCard stats={h.stats} onStat={onStat} />;
}

/** 🆕 11-N · N1 — بطاقةُ الأرقام نفسُها لملفّ الشخص الأصليّ (الويبُ يرسمها للرئيسيّة وللملفّ بوصفةٍ واحدة — D-561/D-650) */
export type StatCell = { key: string; icon: string; value: string | number; label: string; href: string };
export function StatsCard({ stats, onStat }: { stats: readonly StatCell[]; onStat: (href: string) => void }) {
  const { tokens } = useApp();
  if (stats.length === 0) return null;
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
