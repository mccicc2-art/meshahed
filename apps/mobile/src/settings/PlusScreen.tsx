import React from "react";
import { View } from "react-native";
import { useApp } from "../state";
import { Text } from "../ui";
import { radius } from "../theme";
import { Icon, iconOr } from "../icons";
import { SECTIONS } from "@/core/features";
import { SettingsScreen, Group, RowsSkeleton, StatusPill } from "./ui";
import { useSettings } from "./api";

/**
 * ====== Loopz+ أصليّاً — شريحةُ «لا ويب في التطبيق» ٤ (١٩ أكتوبر ٢٠٢٦) ======
 *
 * **شاشةٌ واحدةٌ لكلِّ أبواب البلس** (`/plus` بأقفالها التسعة عشر، و«إدارة اشتراك Loopz+» `/profile/settings/billing`) —
 * تُفتح من `shell.nativeDoor` فلا يتغيّر أيُّ مستدعٍ. وهي ترجمةُ صفحة الاشتراك بأسئلتها الثلاثة (D-851): نوعُ حسابك وسببُه ·
 * متى ينتهي · ما الذي يشمله أو يفتحه — **من سجلِّ الميزات نفسِه** (`@/core/features`، بنودُ `plus` المشحونة وحدَها).
 *
 * 🔴 **بلا سعرٍ وبلا زرِّ شراء** (خطّةُ المدفوعات §11): الاشتراكُ لم يُفتح بعد، وعلى الآيفون لا يُعرض سعرٌ ولا رابطُ شراءٍ خارج
 * Apple. لغير المشترك سطرُ «قريباً» نفسُه الذي يقوله الويب (`plusSoon`). الشراءُ والاسترجاعُ وإدارةُ الاشتراك من المتجر تأتي
 * إلى هذه الشاشة نفسِها مع P5 (بناءٌ مدفوع، قراراتُ §10).
 */
export function PlusScreen() {
  const { t, tokens, locale, me } = useApp();
  const q = useSettings();
  const a = q.data?.account;
  const plus = a?.plus ?? me?.plus ?? false;
  /* التاريخُ بلغة القارئ؛ والفاسدُ غياب (D-475). و«انتهى» = تاريخٌ محفوظٌ مع «لستَ مشتركاً» — حكمُ `isPlus` في الخادم لا ساعةُ الجهاز */
  const untilMs = a?.plus_until ? Date.parse(a.plus_until) : NaN;
  const until = Number.isNaN(untilMs) ? null : new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar", { day: "numeric", month: "long", year: "numeric" }).format(new Date(untilMs));
  const expired = !plus && until !== null;
  const unlocks = SECTIONS.flatMap((s) => s.items.filter((i) => i.plus && !i.soon));
  const ar = locale === "ar";
  return (
    <SettingsScreen title="Loopz+">
      {!a ? (
        q.isError ? <Text muted style={{ textAlign: "center", paddingVertical: 24 }}>{t.apiInternal}</Text> : <RowsSkeleton rows={3} />
      ) : (
        <>
          <View style={{ borderRadius: radius.card, backgroundColor: tokens.surface, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: tokens.accent + "1A", alignItems: "center", justifyContent: "center" }}>
              <Icon name="sparkles" size={22} color={tokens.accent} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text size={20} weight="800">{a.plan_label}</Text>
              {a.plan_reason ? <Text size={14} weight="600" color={tokens.accent} style={{ marginTop: 2 }}>{a.plan_reason}</Text> : null}
              <Text size={12} muted style={{ marginTop: 6, lineHeight: 18 }}>{expired ? t.subExpired : plus ? (until ? t.subUntil(until) : t.subNoEnd) : t.plusSoon}</Text>
            </View>
            {plus ? <StatusPill label={t.appPlusActive} /> : null}
          </View>

          {unlocks.length > 0 ? (
            <Group label={plus ? t.plusIncludes : t.subPlusUnlocks}>
              {unlocks.map((f) => (
                <View key={f.en} style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 14, paddingVertical: 12 }}>
                  <View style={{ marginTop: 2 }}>
                    <Icon name={iconOr(f.icon, "sparkle-star")} size={18} color={plus ? tokens.accent : tokens.muted} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text size={15} weight="600" style={{ lineHeight: 20 }}>{ar ? f.ar : f.en}</Text>
                    <Text size={12} muted style={{ marginTop: 2, lineHeight: 18 }}>{ar ? f.arBody : f.enBody}</Text>
                  </View>
                </View>
              ))}
            </Group>
          ) : null}
        </>
      )}
    </SettingsScreen>
  );
}
