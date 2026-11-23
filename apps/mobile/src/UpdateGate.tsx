import React, { useCallback, useEffect, useState } from "react";
import { AppState, BackHandler, Linking, Platform, ScrollView, View } from "react-native";
import Constants from "expo-constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CONFIG } from "./config";
import { useApp } from "./state";
import { Button, Text } from "./ui";
import { Icon, isIconName } from "./icons";
import { Logo } from "./Logo";
import { radius, space } from "./theme";
import { mustUpdate, type AppConfig, type WhatsNewItem } from "@/core/contracts/appConfig";

/**
 * ====== 🆕 T535 — شاشةُ «حدِّث Loopz» الإلزاميّة (خلفُ لافتة «نسخة جديدة في المتجر») ======
 *
 * أحمد ٢٤ نوفمبر: «الزامية من اول مره» · «١ أ» رقمٌ لكلِّ منصّة · «ب» شاشةُ «ما الجديد» (الصورةُ المعتمدة).
 *
 * 🔑 **لماذا إلزاميّة**: البناءُ الأصليُّ الجديد يغيّر البصمة، فلا يصل النسخَ الأقدم بعده تحديثٌ عبر الهواء أبداً — من بقي عليها
 * يبقى على إصلاحاتٍ لا تصله. فإن قال الخادمُ إنّ إصدارَ هذا الثنائيّ (`expoConfig.version`) دون أقلِّ إصدارٍ لمنصّته، غطّت
 * الشاشةُ كلَّ شيء بزرٍّ واحدٍ إلى المتجر، بلا «✕» ولا رجوع.
 * ⚖️ **الإجبارُ لا يقع إلّا بتأكيدٍ صريح** (`mustUpdate`): خادمٌ لا يردّ، أو رقمٌ غيرُ مضبوطٍ لمنصّته، أو منصّةٌ بلا رابط ⇒ لا شاشة.
 * والرقمُ لا يُضبط إلّا بعد ظهور النسخة في متجر منصّته للجميع (`/api/v1/app/config`).
 * ⏱️ السؤالُ عند الإقلاع وعند كلِّ عودةٍ للواجهة: من فتح التطبيقَ قبل التشغيل وأبقاه في الخلفيّة يُسأل حين يعود.
 */
const VERSION = Constants.expoConfig?.version ?? "0";
const PLATFORM: "ios" | "android" = Platform.OS === "ios" ? "ios" : "android";

type Gate = { store: string; items: WhatsNewItem[] };

export function UpdateGate() {
  const { t, tokens, locale } = useApp();
  const insets = useSafeAreaInsets();
  const [gate, setGate] = useState<Gate | null>(null);

  const ask = useCallback(() => {
    void fetch(`${CONFIG.apiBase}/api/v1/app/config`, { credentials: "omit" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { data?: AppConfig } | null) => {
        const c = j?.data ?? null;
        const store = mustUpdate(c, PLATFORM, VERSION);
        /* لا تُطفأ شاشةٌ ظهرت بردٍّ متأخّرٍ أو فاشل: الإجبارُ يرفعه تحديثُ الثنائيّ نفسُه، لا ردُّ شبكة */
        if (store) setGate({ store, items: Array.isArray(c?.whats_new) ? c.whats_new : [] });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    ask();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") ask();
    });
    return () => sub.remove();
  }, [ask]);

  /* أندرويد: زرُّ الرجوع لا يتجاوز الشاشة — ولا يُغلق التطبيقَ من تحتها كذلك (يبقى على الشاشة) */
  useEffect(() => {
    if (!gate || Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, [gate]);

  if (!gate) return null;
  const en = locale === "en";
  const open = () => void Linking.openURL(gate.store).catch(() => {});
  return (
    <View
      accessibilityViewIsModal
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, elevation: 1000, backgroundColor: tokens.bg, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, space.lg) }}
    >
      <ScrollView
        alwaysBounceVertical={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: space.xl, paddingVertical: space.xl }}
      >
        {/* المحتوى بعرض عمودٍ مقروء: على الآيباد لا يتمدّد السطرُ على الشاشة كلِّها */}
        <View style={{ width: "100%", maxWidth: 440, alignItems: "center" }}>
          <View style={{ width: 80, height: 80, borderRadius: 20, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, alignItems: "center", justifyContent: "center" }}>
            <Logo size={48} />
          </View>
          <Text size={26} weight="800" style={{ textAlign: "center", marginTop: space.lg, lineHeight: 36 }}>
            {t.updateGateTitle}
          </Text>
          <Text size={15} muted style={{ textAlign: "center", marginTop: space.sm, lineHeight: 24 }}>
            {gate.items.length ? t.updateGateSubList : t.updateGateSub}
          </Text>
          {gate.items.length ? (
            <View style={{ alignSelf: "stretch", marginTop: space.xl, borderRadius: radius.card, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, overflow: "hidden" }}>
              {gate.items.map((it, i) => {
                const title = en ? it.title?.en : it.title?.ar;
                if (!title) return null;
                const sub = it.sub ? (en ? it.sub.en : it.sub.ar) : "";
                /* اسمٌ لا تعرفه هذه النسخةُ من مجموعة الأيقونات الواحدة ⇒ النجمة — لا أيقونةَ ثانيةَ ولا فراغ */
                const icon = isIconName(it.icon) ? it.icon : "sparkle-star";
                return (
                  <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: space.md, paddingHorizontal: space.lg, paddingVertical: 14, borderTopWidth: i ? 1 : 0, borderTopColor: tokens.divider }}>
                    <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: tokens.accent + "1F", alignItems: "center", justifyContent: "center" }}>
                      <Icon name={icon} size={16} color={tokens.accent} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text size={14} weight="700">{title}</Text>
                      {sub ? <Text size={12} muted style={{ lineHeight: 18 }}>{sub}</Text> : null}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>
      </ScrollView>
      <View style={{ paddingHorizontal: space.xl, alignItems: "center" }}>
        <View style={{ width: "100%", maxWidth: 440 }}>
          <Button label={t.updateGateCta} onPress={open} style={{ minHeight: 52 }} />
          <Text size={12} muted style={{ textAlign: "center", marginTop: space.sm }}>
            {t.updateGateHint}
          </Text>
        </View>
      </View>
    </View>
  );
}
