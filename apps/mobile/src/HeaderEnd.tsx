import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { notePress } from "./perfMarks";
import { drawerStore } from "./drawer/store";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useApp } from "./state";
import { Icon } from "./icons";
import { controlSize } from "./theme";
import { Logo } from "./Logo";
import type { NativeRoot } from "./shell";

/**
 * زرُّ الترويسة الواحد — دائرةُ لمسٍ ٤٠ ورمزٌ ١٨ ونقطةُ «غير مقروء» الصفراء في زاويتها.
 * 🆕 D-1424 — كان دالّةً محلّيّةً في `HomeTopBar` وحدَها؛ صار مكوّناً لأنّ ترويساتِ التبويبات الأربعة تحمل الجرسَ
 * نفسَه الآن — وزرٌّ ثانٍ بمقاسٍ آخر عيبٌ (القاعدة ٣).
 */
export function HeaderIconButton({ name, label, onPress, count, color }: { name: "chat" | "bell" | "settings"; label: string; onPress: () => void; count: number; color: string }) {
  const { tokens } = useApp();
  return (
    <Pressable onPress={onPress} onPressIn={notePress} accessibilityRole="button" accessibilityLabel={count > 0 ? `${label} (${count})` : label} hitSlop={4} style={({ pressed }) => [{ width: controlSize.headerBtn, height: controlSize.headerBtn, borderRadius: controlSize.headerBtn / 2, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 }]}>
      <Icon name={name} size={controlSize.headerIcon} color={color} />
      {count > 0 ? <View style={{ position: "absolute", top: 7, end: 7, width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.accent }} /> : null}
    </Pressable>
  );
}

/** هامشُ الصفحة، وحجمُ الشعار الذي كانت كلُّ شاشةٍ تكتبه بنفسها */
const PAGE_PAD = 16;
const LOGO = 28;

/** صورةُ الحساب في الترويسة ٣٠ — أصغرُ من صورة الرئيسيّة (٣٨) لأنّها تجاور عنواناً لا اسماً */
const AVATAR = 30;
/**
 * 🆕 D-1430 — بُعدُ آخر زرٍّ عن طرف الشاشة في كلِّ ترويسة: الصورةُ المرئيّةُ تقف على هامش الصفحة (١٦) وهدفُها ٤٠.
 * الرئيسيّةُ تقرؤه أيضاً فيقف جرسُها في الموضع نفسِه من الطرف (أحمد: «تأكّد أنّ موقع زرّ الإشعارات مطابق»).
 */
export const HEADER_END_INSET = 16 - (controlSize.headerBtn - AVATAR) / 2;

/**
 * 🆕 D-1569 — طرفا ترويسة التبويب: **صورةُ الحساب في البداية وشعارُ Loopz في الطرف** (أحمد ٢٩ أكتوبر على لقطة «مكتبتي»:
 * «صوره الحساب تكون في نفس مكان الصوره في الهوم … و لوبز تكون في اليسار مكان الصوره الحالية»). كانت الصورةُ في الطرف
 * والشعارُ في البداية (D-1022/D-1424)، والرئيسيّةُ تضع الصورةَ في البداية — فبابُ القائمة الجانبيّة كان في مكانين؛ الآن
 * مكانٌ واحدٌ في كلِّ تبويب، وفي جهة القائمة التي يفتحها.
 * 🗑️ **والجرسُ خرج من ترويسات التبويبات** («الجرس و الرسائل في الرئيسية فقط و اخفيهم من الباقي»): التنبيهاتُ والرسائلُ
 *   بابُهما رأسُ الرئيسيّة وحدَه.
 * - الصورةُ على `HEADER_END_INSET` فحافّتُها المرئيّةُ على هامش الصفحة (١٦) كصورة الرئيسيّة؛ وتبقى ٣٠ لا ٣٨ («٢أ»):
 *   تجاور عنواناً لا اسماً.
 * - مطلقا الموضع كلاهما، فالعنوانُ يبقى في منتصف الترويسة.
 */
export function HeaderEdges({ from }: { from: NativeRoot }) {
  const { t, tokens, me } = useApp();
  const router = useRouter();
  /* 🆕 D-1505 — الصورةُ بابُ القائمة الجانبيّة كصورة الرئيسيّة (الملفُّ أوّلُ ما فيها) — صورتان لبابٍ واحد */
  const openMe = () => (me ? drawerStore.open(from) : router.push("/settings/profile"));
  return (
    <>
      <View style={{ position: "absolute", start: HEADER_END_INSET, top: 0, bottom: 0, justifyContent: "center" }}>
        <Pressable onPress={openMe} onPressIn={notePress} accessibilityRole="link" accessibilityLabel={me?.nickname ?? me?.username ?? t.settingsNavHeading} hitSlop={5} style={({ pressed }) => ({ width: controlSize.headerBtn, height: controlSize.headerBtn, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}>
          <View style={{ width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, overflow: "hidden", borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
            {me?.avatar_url ? <Image source={{ uri: me.avatar_url }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" /> : <Icon name="people" size={16} color={tokens.muted} />}
          </View>
        </Pressable>
      </View>
      <View style={{ position: "absolute", end: PAGE_PAD, top: 0, bottom: 0, justifyContent: "center" }}>
        <Logo size={LOGO} />
      </View>
    </>
  );
}
