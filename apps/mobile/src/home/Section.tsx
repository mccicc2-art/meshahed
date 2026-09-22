import React from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon, type IconName } from "../icons";

/**
 * قسمُ الرئيسية — نظيرُ `PosterRail`/`Section` في `app/page.tsx` (Phase 11-H · H2):
 * رأسٌ (رمزٌ بالتمييز · عنوانٌ هو بابُ الصفّ · أداةٌ · «الكلّ») ثمّ صفٌّ أفقيٌّ
 * يُمرَّر في البصريّ، أو عمودٌ من الصفوف في المختصر (D-439: المحتوى واحد،
 * الشكلُ وحدَه يتبدّل). الفراغُ بين الأقسام ١٢ (D-467) والعنوانُ ٢٢/٧٠٠.
 *
 * ⚖️ D-863/D-868 — رأسٌ فيه «الكلّ» واحدة: الأداةُ (زرُّ الترتيب) و«الكلّ»
 * يجتمعان، **ولا يجتمع بابُ ورقةٍ مع رابطٍ بالكلمة نفسِها.**
 */
export const PAGE_PAD = 16;
export const RAIL_GAP = 12;
export const BACKDROP_W = 220;

export function SectionHeader({
  title,
  icon,
  accent = true,
  onTitle,
  action,
  seeAll,
  seeAllLabel,
  onSeeAll,
}: {
  title: string;
  icon?: IconName;
  /** رمزٌ بلون التمييز (أقسامُ الرئيسية) أو باهتٌ (الرائج) */
  accent?: boolean;
  onTitle?: () => void;
  action?: React.ReactNode;
  seeAll?: string;
  /** ما يُقرأ للقارئ الصوتيّ حين تختلف الكلمةُ المرئيّة عن الفعل — `QueueOrderButton` الويب: يُرى «الكل» ويُقرأ «أعد الترتيب» */
  seeAllLabel?: string;
  onSeeAll?: () => void;
}) {
  const { tokens } = useApp();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 6, paddingHorizontal: PAGE_PAD }}>
      <Pressable onPress={onTitle} disabled={!onTitle} accessibilityRole={onTitle ? "link" : undefined} style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 }}>
        {icon ? <Icon name={icon} size={20} color={accent ? tokens.accent : tokens.muted} /> : null}
        <Text size={22} weight="700" numberOfLines={1} style={{ flexShrink: 1 }}>
          {title}
        </Text>
      </Pressable>
      {action || (seeAll && onSeeAll) ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {action}
          {seeAll && onSeeAll ? (
            <Pressable onPress={onSeeAll} hitSlop={8} accessibilityRole="button" accessibilityLabel={seeAllLabel}>
              <Text size={12} weight="500" muted>{seeAll}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** الصفُّ الأفقيّ — حشوةُ الصفحة في الطرفين، والفجوةُ ١٢ كالويب (`gap-3`) */
export function Rail({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: PAGE_PAD, gap: RAIL_GAP }} decelerationRate="fast">
      {children}
    </ScrollView>
  );
}

/** العمودُ المختصر — `space-y-2` كالويب */
export function Column({ children }: { children: React.ReactNode }) {
  return <View style={{ paddingHorizontal: PAGE_PAD, gap: 8 }}>{children}</View>;
}

/** الفراغُ بين الأقسام (D-467) */
export function Gap() {
  return <View style={{ height: 12 }} />;
}
