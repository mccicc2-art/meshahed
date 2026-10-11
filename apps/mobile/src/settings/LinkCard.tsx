import React from "react";
import { Clipboard, Pressable, Share, View } from "react-native";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import { haptic } from "../haptics";
import type { ToastHostRef } from "../HoldHost";

/**
 * بطاقةُ الرابط بزرَّي نسخٍ ومشاركة (`InviteLinkCard` في الويب) — 🆕 D-1362: **قطعةٌ واحدةٌ لموضعيها** (رابطُ الدعوة في «الأصدقاء»
 * ورابطُ الشريك في لوحته) — كانت داخل `InvitesScreen` ولها الآن قارئٌ ثانٍ، ونسخةٌ ثانيةٌ منها عطلٌ لا ميزة.
 * **النسخُ والمشاركةُ فعلان**: المشاركةُ ورقةُ النظام، والنسخُ حافظة.
 */
export function LinkCard({ url, toast }: { url: string; toast: React.RefObject<ToastHostRef | null> }) {
  const { t, tokens } = useApp();
  const copy = () => {
    haptic.pick();
    Clipboard.setString(url);
    toast.current?.say(t.linkCopied, undefined, undefined, "success");
  };
  const share = () => {
    haptic.pick();
    /* إغلاقُ ورقة النظام ليس خطأً — لا يُتبع بنسخٍ لم يُطلب (حجّةُ `InviteLinkCard`) */
    void Share.share({ message: url, url }).catch(() => {});
  };
  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, borderRadius: radius.md, backgroundColor: tokens.surface, padding: 8 }}>
        {/* الرابطُ لاتينيٌّ يُقرأ من اليسار في اللغتين، وزرُّ النسخ بعده */}
        <Text size={14} numberOfLines={1} style={{ flex: 1, minWidth: 0, paddingHorizontal: 8 }}>{url.replace(/^https?:\/\//, "")}</Text>
        <Pressable onPress={copy} accessibilityRole="button" accessibilityLabel={t.invCopy} hitSlop={6} style={({ pressed }) => ({ width: 36, height: 36, borderRadius: radius.sm, backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}>
          <Icon name="copy" size={16} color={tokens.fg} />
        </Pressable>
      </View>
      <Pressable onPress={share} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: radius.md, backgroundColor: tokens.accent, paddingVertical: 14, opacity: pressed ? 0.8 : 1 })}>
        <Icon name="share" size={16} color={tokens.onAccent} />
        <Text size={15} weight="700" color={tokens.onAccent}>{t.invShare}</Text>
      </Pressable>
    </>
  );
}
