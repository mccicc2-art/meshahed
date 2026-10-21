import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon } from "../icons";
import { PAGE_PAD } from "./Section";
import type { HomeHeaderPayload } from "../contracts";
import { IdentityBadges, identityFlags } from "../IdentityBadges";
import { HEADER_END_INSET, HeaderIconButton } from "../HeaderEnd";
import { controlSize } from "../theme";
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
export const VEIL = require("../../assets/poster-veil.png");

/** صورةُ الغلاف وحجابُها المسطّح — مادّةُ `HomeCover`، ويقرؤها رأسُ الملفّ المطويّ ليكمل الغلافَ تحت شريط الأزرار (D-1431) */
export function CoverArt({ url, pos }: { url: string; pos: number | null }) {
  return (
    <>
      <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={{ top: `${pos ?? 30}%`, left: "50%" }} /* D-1244 — بلا تلاشٍ: الغلافُ مسخَّنٌ مع الحمولة، والتلاشي كان يُظهر الرأسَ قبل غلافه */ transition={0} cachePolicy="memory-disk" priority="high" />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: COVER_SCRIM }]} />
    </>
  );
}

export function HomeCover({ url, pos }: { url: string | null; pos: number | null }) {
  const insets = useSafeAreaInsets();
  const { tokens } = useApp();
  if (!url) return null;
  const h = insets.top + COVER_H;
  const solid = insets.top + COVER_SOLID;
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height: h, overflow: "hidden" }}>
      <CoverArt url={url} pos={pos} />
      {/* الذوبانُ إلى خلفيّة الصفحة من الخطّ الصلب إلى القاع */}
      <Image source={VEIL} tintColor={tokens.bg} style={{ position: "absolute", left: 0, right: 0, top: solid, height: h - solid }} contentFit="fill" />
      <View style={{ position: "absolute", left: 0, right: 0, top: h - 1, height: 1, backgroundColor: tokens.bg }} />
    </View>
  );
}

/**
 * 🆕 D-1429 — **رأسُ الرئيسيّة صفٌّ واحد بلا شعار** (أحمد ١٦ أكتوبر بصورة: «طبّق نفس هذا التصميم في الهوم»، و«١ أ»: الشعارُ يُحذف):
 * الصورةُ والاسمُ وشارةُ الاشتراك في البداية، والظرفُ والجرسُ والترسُ في الطرف — كان صفّين (الشعارُ والأزرار، ثمّ الترحيبُ ومبدّلُ
 * العرض). الرئيسيّةُ تُعرف بأيقونتها في الشريط السفليّ، وصفٌّ واحدٌ يعطي المحتوى ارتفاعَ صفٍّ كامل.
 * - مبدّلُ العرض نزل إلى بطاقة الأرقام خانةً أخيرة (`HomeStats`)؛ ومن أخفى البطاقةَ يجده هنا قبل الظرف.
 * - الطرفُ على `HEADER_END_INSET` لا هامش الصفحة: الجرسُ ثاني زرٍّ من الطرف في كلِّ ترويسة، فيقف حيث يقف في المكتبة واكتشف والمجتمع.
 * - **الصورةُ ٣٨ (D-1278) والاسمُ ٢٢/٧٠٠ (D-1233)** كما كانا في صفّ الترحيب.
 */
/* 🆕 D-1278 — ٣٨ (كانت ٣٢): أحمد «أحسّ اسم KHLD كبير على الأفتار» واختار ٣٨ من صورةٍ بثلاثة مقاسات */
const AVATAR = 38;
const SWITCH_ICON = 18;
/* مقاسُ الشارة مستقلٌّ عن الاسم: قرصُ اللقطات ~١٦ ارتفاعاً، وهو ما تعطيه `IdentityBadges` عند ٢٠ — الاسمُ كبر والشارةُ لا */
const PILL_NAME_SIZE = 20;

export function HomeTopBar({
  h,
  unreadSignals,
  unreadShares,
  onInbox,
  onSignals,
  onSettings,
  onAvatar,
  avatarRef,
  viewSwitch,
}: {
  /** قبل وصول الحمولة: الأزرارُ وحدها في مواضعها */
  h: HomeHeaderPayload | null;
  unreadSignals: number;
  unreadShares: number;
  onInbox: () => void;
  onSignals: () => void;
  onSettings: () => void;
  onAvatar: () => void;
  /** D-1318 — مرساةُ الجولة: الحلقةُ و«اضغط هنا» تُقاسان على هذه الصورة */
  avatarRef?: React.Ref<View>;
  /** المبدّلُ هنا فقط حين تُخفى بطاقةُ الأرقام */
  viewSwitch?: React.ReactNode;
}) {
  const { t, tokens } = useApp();
  /* D-1424 — الزرُّ صار `HeaderIconButton` المشترك مع جرس ترويسات التبويبات */
  const btn = (name: "mail" | "bell" | "settings", label: string, onPress: () => void, count: number) => <HeaderIconButton name={name} label={label} onPress={onPress} count={count} color={tokens.fg} />;
  return (
    <View style={{ height: 64, flexDirection: "row", alignItems: "center", gap: 10, paddingStart: PAGE_PAD, paddingEnd: HEADER_END_INSET }}>
      {h ? (
        <>
          <Pressable ref={avatarRef} onPress={onAvatar} accessibilityRole="link" accessibilityLabel={h.display_name} hitSlop={6} style={{ width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, overflow: "hidden", borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
            {h.avatar_url ? <Image source={{ uri: h.avatar_url }} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={{ top: `${h.avatar_pos ?? 50}%`, left: "50%" }} cachePolicy="memory-disk" /> : <Icon name="people" size={19} color={tokens.muted} />}
          </Pressable>
          {/* `flex: 1` للحاوية لا للاسم (D-634): الشارةُ تبقى ملتصقةً بالاسم والأزرارُ تُدفع إلى الطرف */}
          <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text size={22} weight="700" numberOfLines={1} style={{ flexShrink: 1, lineHeight: 28 }}>{h.display_name}</Text>
            <IdentityBadges flags={{ ...identityFlags(h), verified: false }} nameSize={PILL_NAME_SIZE} />
          </View>
        </>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {viewSwitch}
        {btn("mail", t.communityTabInbox, onInbox, unreadShares)}
        {btn("bell", t.notifTitle, onSignals, unreadSignals)}
        {btn("settings", t.settingsNavHeading, onSettings, 0)}
      </View>
    </View>
  );
}

/**
 * مبدّلُ العرض — **والرمزُ يصف الحالَ لا الوجهة** (D-1321، حكمُ أحمد ٨ أكتوبر: «الحالي»)؛ والوجهةُ في الاسم المنطوق.
 * 🆕 D-1425 — وضعان لا ثلاثة: المربّعات والمزدوج. هدفُ اللمس ٤٠ كأزرار الترويسة.
 */
export function HomeViewSwitch({ view, onToggle }: { view: HomeView; onToggle: () => void }) {
  const { t, tokens } = useApp();
  const next = nextHomeView(view);
  const nameOf = (v: HomeView) => (v === "mixed" ? t.viewMixed : t.viewVisual);
  return (
    <Pressable onPress={onToggle} accessibilityRole="button" accessibilityLabel={`${t.viewSwitchAria} — ${nameOf(next)}`} hitSlop={6} style={({ pressed }) => [{ width: controlSize.headerBtn, height: controlSize.headerBtn, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 }]}>
      <Icon name={view === "mixed" ? "view-mixed" : "grid"} size={SWITCH_ICON} color={tokens.accent} />
    </Pressable>
  );
}

/** 🆕 D-1429 — بطاقةُ الرئيسيّة تحمل مبدّلَ العرض خانةً أخيرةً بعد فاصل (صورةُ أحمد: «للمشاهدة | القادم | ▦») */
export function HomeStats({ h, onStat, viewSwitch }: { h: HomeHeaderPayload; onStat: (href: string) => void; viewSwitch: React.ReactNode }) {
  if (!h.show_stats) return null;
  return <StatsCard stats={h.stats} onStat={onStat} trailing={viewSwitch} />;
}

/** 🆕 11-N · N1 — بطاقةُ الأرقام نفسُها لملفّ الشخص الأصليّ (الويبُ يرسمها للرئيسيّة وللملفّ بوصفةٍ واحدة — D-561/D-650) */
export type StatCell = { key: string; icon: string; value: string | number; label: string; href: string };
export function StatsCard({ stats, onStat, trailing }: { stats: readonly StatCell[]; onStat: (href: string) => void; trailing?: React.ReactNode }) {
  const { tokens } = useApp();
  if (stats.length === 0 && !trailing) return null;
  /* 🆕 D-1429 — مع خانةٍ أخيرة (مبدّلُ الرئيسيّة) تعود الفواصلُ الرفيعةُ بين الخانات كما في صورة أحمد؛ بطاقةُ الملفّ بلا فواصل
     كما حكم في D-1093. فاصلٌ قصيرٌ في الوسط لا حدٌّ كامل، بلون الإطار نفسِه */
  const sep = (key: string) => (trailing ? <View key={key} style={{ width: 1, alignSelf: "center", height: 22, backgroundColor: tokens.border }} /> : null);
  /* 🆕 D-1129 — **أربعةٌ في صفٍّ واحد** (أحمد بلقطة: «إذا كانت ٤ أبغاها خط واحد»؛ كانت عمودين ×
     سطرين — D-620). ربعُ العرض (~٨٧) لا يتّسع لأيقونةٍ ورقمٍ واسمٍ في سطر («120d Time» يُقصّ)، فالخانةُ
     عند الأربعة **عموديّة**: الأيقونةُ والرقمُ فوق والاسمُ تحته — بالأحجام نفسِها. الاثنان والثلاثة كما هي. */
  const stacked = stats.length === 4;
  /* D-1093 — بطاقةُ الأرقام على لون الصفحة (`bg`) بلا فواصل بين الخانات (أحمد بلقطة: «خلّ خلفيّتها سوداء
     بدل رصاصي وبدون خطوط بينهم»): وصفةُ D-1081 — الإطارُ الخارجيُّ الرفيع وحده يحدّها، و`bg` لا `#000`
     كي تصحّ `daylight`. الفراغُ بين الأرقام الثلاثة يفصلها وحدَه؛ خطٌّ فوقه كان يكرّر الفصل. */
  return (
    <View style={{ marginHorizontal: PAGE_PAD, marginTop: 10, borderRadius: 16, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.bg, overflow: "hidden" }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {stats.flatMap((s, i) => [
          i > 0 ? sep(`sep-${s.key}`) : null,
          stacked ? (
            <Pressable key={s.key} onPress={() => onStat(s.href)} accessibilityRole="link" accessibilityLabel={`${s.value} ${s.label}`} style={({ pressed }) => [{ flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 2, paddingVertical: 9, opacity: pressed ? 0.7 : 1 }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Icon name={s.icon as never} size={16} color={tokens.accent} />
                <Text size={15} weight="700" style={{ fontVariant: ["tabular-nums"] }}>{s.value}</Text>
              </View>
              <Text size={12} weight="500" muted numberOfLines={1} style={{ maxWidth: "100%" }}>{s.label}</Text>
            </Pressable>
          ) : (
            <Pressable key={s.key} onPress={() => onStat(s.href)} accessibilityRole="link" accessibilityLabel={`${s.value} ${s.label}`} style={({ pressed }) => [{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 6, paddingVertical: 10, opacity: pressed ? 0.7 : 1 }]}>
              <Icon name={s.icon as never} size={16} color={tokens.accent} />
              {/* 🔴 D-1499 — **بلا سطرٍ أضيقَ من الخطّ** (لقطةُ أحمد: «النص في الكارد بالأعلى لم يتعدل»): ‏`lineHeight` ‏١٨ تحت Poppins
                  ١٥ (سطرُه الطبيعيّ ~٢٢) و١٤ تحت Tajawal ١٢ كانا يرفعان الرقمَ والاسمَ فوق وسط الأيقونة (~٢pt في اللقطة). السطرُ
                  الطبيعيُّ يتوسّط، والحشوةُ نقصت نقطتين فلا تكبر البطاقة إلّا قليلاً */}
              <Text size={15} weight="700" style={{ fontVariant: ["tabular-nums"] }}>{s.value}</Text>
              <Text size={12} weight="500" muted numberOfLines={1} style={{ flexShrink: 1 }}>{s.label}</Text>
            </Pressable>
          ),
        ])}
        {trailing ? (
          <>
            {stats.length > 0 ? sep("sep-trailing") : null}
            <View style={{ paddingHorizontal: 8, alignItems: "center", justifyContent: "center" }}>{trailing}</View>
          </>
        ) : null}
      </View>
    </View>
  );
}
