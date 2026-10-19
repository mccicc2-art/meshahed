import React from "react";
import { View } from "react-native";
import { useApp } from "../state";
import { Text } from "../ui";
import { radius } from "../theme";
import { Icon, iconOr } from "../icons";
import { SECTIONS, type Feature } from "@/core/features";
import { SettingsScreen, StatusPill } from "./ui";

/**
 * ====== المميزاتُ أصليّةً — شريحةُ «لا ويب في التطبيق» ١ (١٩ أكتوبر ٢٠٢٦) ======
 *
 * 🔑 **السجلُّ نفسُه لا نسخةٌ منه** (`@/core/features` — D-851): الصفحةُ في الويب وهذه الشاشةُ قارئان لصفٍّ واحد،
 * فميزةٌ تُشحن غداً يتبدّل وسمُها في المكانين معاً ولا يَعِد أحدُهما بما لا يعرفه الآخر.
 *
 * ⚖️ **ولماذا لا نستعمل `Row`**: صفُّ الإعدادات يقصّ العنوانَ في سطرٍ والوصفَ في سطرين — وهذه الصفحةُ وُجدت لتقول
 * ما المتاح «بصدق» (D-122)، فالوصفُ المقصوص يُخفي نصفَ الوعد. البطاقةُ هنا تلفّ النصَّ كاملاً بالألوان والزوايا نفسِها.
 *
 * ⚖️ **وسطرُ الخاتمة بلا سعرٍ وبلا رابطٍ إلى `/plus`**: سعرٌ أو رابطُ شراءٍ خارج المتجر في شاشة آيفون سببُ رفضٍ عند
 * Apple (خطّةُ المدفوعات §11)، والشاشةُ الأصليّةُ لـ Loopz+ هي الشريحةُ ٤ — حين تأتي يُضاف بابُها هنا.
 */
export function FeaturesScreen() {
  const { t, locale, tokens } = useApp();
  const ar = locale === "ar";
  return (
    <SettingsScreen title={t.setAboutFeatures}>
      <Text size={13} muted style={{ paddingHorizontal: 4, lineHeight: 20 }}>{t.featuresIntro}</Text>
      {SECTIONS.map((s) => (
        <View key={s.en}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 4, marginBottom: 8 }}>
            <Icon name={iconOr(s.icon, "sparkle-star")} size={16} color={tokens.muted} />
            <Text size={15} weight="700">{ar ? s.ar : s.en}</Text>
          </View>
          <View style={{ gap: 8 }}>
            {s.items.map((f) => (
              <FeatureCard key={f.en} f={f} ar={ar} />
            ))}
          </View>
        </View>
      ))}
      <Text size={12} muted style={{ paddingHorizontal: 4, lineHeight: 18 }}>{t.featuresFoot}</Text>
    </SettingsScreen>
  );
}

function FeatureCard({ f, ar }: { f: Feature; ar: boolean }) {
  const { t, tokens } = useApp();
  /* وسمٌ واحدٌ في خانةٍ واحدة (الويب حرفاً): «مجاني» بلون النجاح، و«Loopz+» و«قريباً» بلون الهويّة */
  const free = !f.plus && !f.soon;
  const tone = free ? tokens.success : tokens.accent;
  const tag = f.plus ? (f.soon ? t.featuresTagPlusSoon : "Loopz+") : f.soon ? t.featuresTagSoon : t.featuresTagFree;
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, borderRadius: radius.card, backgroundColor: tokens.surface, paddingHorizontal: 14, paddingVertical: 12 }}>
      <View style={{ marginTop: 2 }}>
        <Icon name={iconOr(f.icon, "sparkle-star")} size={18} color={tokens.accent} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size={14} weight="700" style={{ lineHeight: 20 }}>{ar ? f.ar : f.en}</Text>
        <Text size={12} muted style={{ marginTop: 2, lineHeight: 18 }}>{ar ? f.arBody : f.enBody}</Text>
      </View>
      <StatusPill label={tag} color={tone} />
    </View>
  );
}
