import React from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";

/**
 * ====== 🆕 T450 — بابا الإنشاء في إطارٍ واحد: «＋ قائمة جديدة | ✦ قائمة ذكيّة» ======
 *
 * الإطارُ نفسُه الذي كان في رأس قوائم المكتبة (D-1018 · بمقاس خانة «الإحصائيات · النشاط» — D-1212) صار مكوّناً
 * يُرسم في «اكتشف ← القوائم» أيضاً (أحمد: «لا اقصد مثل شكلها فالمكتبة» — الإطارُ لا الورقة). **وكلاهما يدفع صفحةَ
 * «قائمة جديدة»** (`/list/new`) لا ورقة؛ و`from` يقرّر مصدرَها (المكتبةُ تختار ممّا تملك وحدَه).
 */
export function NewListBar({ from, style }: { from: "discover" | "library"; style?: object }) {
  const { t, tokens } = useApp();
  const router = useRouter();
  const go = (tab: "list" | "smart") => router.push({ pathname: "/list/new", params: { from, tab } });
  const cell = ({ pressed }: { pressed: boolean }) => ({
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 8,
    paddingVertical: 9,
    opacity: pressed ? 0.6 : 1,
  });
  return (
    <View style={[{ flexDirection: "row", borderWidth: 1, borderColor: tokens.border, borderRadius: radius.card, overflow: "hidden" }, style]}>
      <Pressable onPress={() => go("list")} accessibilityRole="button" style={cell}>
        <Icon name="plus" size={16} color={tokens.fg} />
        <Text size={13} weight="700" numberOfLines={1}>{t.listNewGroup}</Text>
      </Pressable>
      <Pressable onPress={() => go("smart")} accessibilityRole="button" style={cell}>
        <Icon name="sparkle-star" size={16} color={tokens.accent} />
        <Text size={13} weight="700" numberOfLines={1}>{t.smartListLabel}</Text>
      </Pressable>
    </View>
  );
}
