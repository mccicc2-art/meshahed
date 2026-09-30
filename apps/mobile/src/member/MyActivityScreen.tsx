import React, { useCallback, useEffect } from "react";
import { BackHandler, Platform, Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import type { NativeRoot } from "../shell";
import { usePullRefresh } from "../pullRefresh";
import { ActivityList } from "./ActivityList";
import type { MyActivityPayload } from "@/core/contracts/profile";

/**
 * ====== «النشاط» أصليّاً — سجلُّك أنت (🆕 D-1213، ١ أكتوبر ٢٠٢٦) ======
 *
 * **قرارُ أحمد: «نفّذ النشاط»** — كان بابُ «النشاط» في المكتبة وبطاقةُ «حصيلة الأسبوع» في الرئيسيّة يفتحان صفحةَ الويب طبقةً
 * (K3b). **الحمولةُ ما ترسمه `/activity` حرفاً** (`GET /api/v1/me/activity` فوق `lib/activityCore.ts`)، **والجسمُ `ActivityList`
 * نفسُه الذي يرسم تبويبَ «النشاط» في ملفّ الشخص** (القاعدة ٣): الرقاقاتُ الخمس · حصيلةُ الأسبوع · الأيّامُ بساعة القارئ · الصفُّ
 * يفتح العملَ أصليّاً. **بلا سقفٍ ولا «المزيد»** كالصفحة (D-710: وجهةٌ قصدها صاحبُها ليقرأ سجلَّه كلَّه).
 * الرأسُ رأسُ «الإحصائيات» الأصليّة (سهمٌ وعنوان) — شاشةٌ في المكدّس لا جذر، فلا شريطَ سفليّ.
 */
const PAGE_PAD = 16;
const HEADER_H = 56;
export const myActivityKey = ["me:activity"] as const;

export function MyActivityScreen({ from }: { from: NativeRoot | "web" }) {
  const { t, tokens } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const q = useQuery({
    queryKey: myActivityKey,
    queryFn: async () => (await api<MyActivityPayload>("/api/v1/me/activity")).data,
    staleTime: 60_000,
  });
  const refresh = usePullRefresh([myActivityKey], 0);

  const back = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/web");
  }, [router]);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      back();
      return true;
    });
    return () => sub.remove();
  }, [back]);

  const openTitle = useCallback(
    (kind: "tv" | "movie", id: number) => router.push({ pathname: "/title/[kind]/[id]", params: { kind, id: String(id), from } }),
    [router, from],
  );

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg }}>
      <View style={{ paddingTop: insets.top, height: insets.top + HEADER_H, flexDirection: "row", alignItems: "center", paddingHorizontal: 8, gap: 4 }}>
        <Pressable onPress={back} accessibilityRole="button" accessibilityLabel={t.closeLabel} hitSlop={4} style={({ pressed }) => ({ width: 40, height: 40, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}>
          <View style={{ width: 11, height: 11, borderStartWidth: 2, borderTopWidth: 2, borderColor: tokens.fg, transform: [{ rotate: "-45deg" }], marginStart: 4 }} />
        </Pressable>
        <Text size={17} weight="700">{t.activityTitle}</Text>
      </View>

      {!q.data ? (
        q.isError ? (
          <View style={{ alignItems: "center", gap: 12, paddingTop: 48, paddingHorizontal: PAGE_PAD }}>
            <Text muted style={{ textAlign: "center" }}>{t.apiInternal}</Text>
            <Button label={t.errorRetry} variant="ghost" onPress={() => void q.refetch()} />
          </View>
        ) : (
          /* هيكلٌ بشكل الشاشة: صفُّ الرقاقات · سطرُ الحصيلة · صفوفٌ بملصقٍ صغير */
          <View style={{ paddingHorizontal: PAGE_PAD, paddingTop: 14, gap: 14 }}>
            <View style={{ height: 34, width: "80%", borderRadius: 17, backgroundColor: tokens.surface2 }} />
            <View style={{ height: 18, borderRadius: 6, backgroundColor: tokens.surface2 }} />
            {Array.from({ length: 7 }, (_, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 44, aspectRatio: 2 / 3, borderRadius: 6, backgroundColor: tokens.surface2 }} />
                <View style={{ flex: 1, height: 14, borderRadius: 6, backgroundColor: tokens.surface2 }} />
              </View>
            ))}
          </View>
        )
      ) : (
        <ScrollView refreshControl={refresh} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
          <ActivityList rows={q.data.items} onTitle={openTitle} emptyText={t.activityEmpty} />
        </ScrollView>
      )}
    </View>
  );
}
