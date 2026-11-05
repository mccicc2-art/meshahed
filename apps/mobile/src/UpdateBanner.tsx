import React, { useEffect, useState } from "react";
import { Linking, Platform, Pressable, View } from "react-native";
import Constants from "expo-constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CONFIG } from "./config";
import { useApp } from "./state";
import { Button, Text } from "./ui";
import { Icon } from "./icons";
import { radius, space } from "./theme";
import { versionBelow, type AppConfig } from "@/core/contracts/appConfig";

/**
 * ====== 🆕 لافتةُ «نسخة جديدة في المتجر» (خطّةُ Loopz+ v2، المرحلة ٠) ======
 *
 * 🔑 **لماذا الآن وهي مطفأة**: بناءُ 1.14.0 يغيّر البصمةَ الأصليّة، فلا يصل 1.13.x بعده تحديثٌ عبر الهواء — فاللافتةُ تنزل
 * إليه **الآن** مع هذا التحديث، وتُشغَّل من الخادم (`/api/v1/app/config` → `min_version`) يومَ يصير 1.14.0 في المتجرين.
 * ⚖️ الرقمُ رقمُ الثنائيّ (`expoConfig.version`)، والسؤالُ مرّةً بعد الإقلاع بثوانٍ (لا يزاحم أوّلَ بيانات) بلا رمزٍ ولا هويّة.
 * و«✕» يخفيها حتى الإقلاع التالي — تذكيرٌ لا جدار: النسخةُ القديمةُ تعمل، لكنّها لا ترى الجديد.
 */
const VERSION = Constants.expoConfig?.version ?? "0";

export function UpdateBanner() {
  const { t, tokens } = useApp();
  const insets = useSafeAreaInsets();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const id = setTimeout(() => {
      void fetch(`${CONFIG.apiBase}/api/v1/app/config`, { credentials: "omit" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { data?: AppConfig } | null) => {
          const c = j?.data ?? null;
          const store = c ? (Platform.OS === "ios" ? c.store_url.ios : c.store_url.android) : null;
          if (c?.min_version && store && versionBelow(VERSION, c.min_version)) setUrl(store);
        })
        .catch(() => {});
    }, 6000);
    return () => clearTimeout(id);
  }, []);
  if (!url) return null;
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, top: insets.top + 8, paddingHorizontal: space.md }}>
      <View
        accessibilityRole="alert"
        style={{ flexDirection: "row", alignItems: "center", gap: 10, borderRadius: radius.card, borderWidth: 1, borderColor: tokens.accent + "59", backgroundColor: tokens.surface, padding: 12 }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text size={14} weight="700">{t.updateBannerTitle}</Text>
          <Text size={12} muted style={{ lineHeight: 17 }}>{t.updateBannerSub}</Text>
        </View>
        <Button size="sm" label={t.updateBannerCta} onPress={() => void Linking.openURL(url).catch(() => {})} />
        <Pressable onPress={() => setUrl(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t.closeLabel}>
          <Icon name="close" size={14} color={tokens.muted} />
        </Pressable>
      </View>
    </View>
  );
}
