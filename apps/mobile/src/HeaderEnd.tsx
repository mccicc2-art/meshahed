import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { notePress } from "./perfMarks";
import { drawerStore } from "./drawer/store";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useApp } from "./state";
import { Icon } from "./icons";
import { controlSize } from "./theme";
import { useHomeSignals } from "./home/useHome";
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

/** صورةُ الحساب في الترويسة ٣٠ — أصغرُ من صورة الرئيسيّة (٣٨) لأنّها تجاور جرساً لا اسماً */
const AVATAR = 30;
/**
 * 🆕 D-1430 — بُعدُ آخر زرٍّ عن طرف الشاشة في كلِّ ترويسة: الصورةُ المرئيّةُ تقف على هامش الصفحة (١٦) وهدفُها ٤٠.
 * الرئيسيّةُ تقرؤه أيضاً فيقف جرسُها في الموضع نفسِه من الطرف (أحمد: «تأكّد أنّ موقع زرّ الإشعارات مطابق»).
 */
export const HEADER_END_INSET = 16 - (controlSize.headerBtn - AVATAR) / 2;

/**
 * 🆕 D-1424 — طرفُ ترويسة التبويب: الجرسُ ثمّ صورةُ الحساب في الطرف (أحمد ١٦ أكتوبر، بصورةٍ على لقطته: «١ أ ٢ أ ٣ ب كل
 * الصفحات حتى البحث»). الجرسُ يفتح التنبيهات كجرس الرئيسيّة، والصورةُ تفتح ملفَّك كصورة الرئيسيّة.
 * والرقمُ رقمُ جرس الرئيسيّة نفسُه (`useHomeSignals`) فالجرسان لا يختلفان.
 * مطلقُ الموضع في الطرف كالشعار في البداية، فالعنوانُ يبقى في منتصف الترويسة.
 */
export function HeaderEnd({ from }: { from: NativeRoot }) {
  const { t, tokens, me } = useApp();
  const router = useRouter();
  const signals = useHomeSignals();
  /* 🆕 D-1505 — الصورةُ بابُ القائمة الجانبيّة كصورة الرئيسيّة (الملفُّ أوّلُ ما فيها) — صورتان لبابٍ واحد */
  const openMe = () => (me ? drawerStore.open(from) : router.push("/settings/profile"));
  return (
    <View style={{ position: "absolute", end: HEADER_END_INSET, top: 0, bottom: 0, flexDirection: "row", alignItems: "center" }}>
      <HeaderIconButton name="bell" label={t.notifTitle} count={signals} color={tokens.fg} onPress={() => router.push({ pathname: "/messages", params: { tab: "alerts", from } })} />
      <Pressable onPress={openMe} onPressIn={notePress} accessibilityRole="link" accessibilityLabel={me?.nickname ?? me?.username ?? t.settingsNavHeading} hitSlop={5} style={({ pressed }) => ({ width: controlSize.headerBtn, height: controlSize.headerBtn, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}>
        <View style={{ width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, overflow: "hidden", borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
          {me?.avatar_url ? <Image source={{ uri: me.avatar_url }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" /> : <Icon name="people" size={16} color={tokens.muted} />}
        </View>
      </Pressable>
    </View>
  );
}
