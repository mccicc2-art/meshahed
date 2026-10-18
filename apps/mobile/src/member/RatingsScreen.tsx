import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BackHandler, FlatList, Platform, Pressable, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { useApp } from "../state";
import { BackChevron, Button, Text } from "../ui";
import { Icon } from "../icons";
import { Chip } from "../library/Chip";
import { posterFor } from "../poster";
import type { NativeRoot } from "../shell";
import { usePullRefresh } from "../pullRefresh";
import type { MyRating, MyRatingsPayload } from "@/core/contracts/profile";

/**
 * ====== «تقييماتي» أصليّاً (🆕 D-1357 · Phase 11-V · V-C · C1 — ١١ أكتوبر ٢٠٢٦) ======
 *
 * **قرارُ أحمد: «نفذ وارفع ترشيحاتك»** بعد صورةٍ للشاشة. كان عنوانُ «التقييمات — من الأعلى» و«الكلّ» في الرئيسيّة يفتحان صفحةَ
 * الويب طبقةً. **الحمولةُ ما ترسمه `/ratings` حرفاً** (`GET /api/v1/me/ratings`): الأعلى تقييماً ثمّ الأحدث، بسقف ٢٠٠.
 *  - **الرقاقتان** («الكل» · «مع تعليق» بعددَيهما) من عائلة `Chip` نفسِها (القاعدة ٣)، والفرزُ هنا لا طلبٌ ثانٍ.
 *  - **«★ 9/10» لا صفُّ نجوم** («1 أ»): السلّمُ من ١٠، وهو شكلُ شريط الرئيسيّة نفسِه.
 *  - الرأسُ رأسُ «النشاط» و«الإحصائيات» (سهمٌ وعنوان) — شاشةٌ في المكدّس لا جذر، فلا شريطَ سفليّ.
 *  - **المفتاحُ وسمُ `me:ratings`**: `track/rate` و`track/unrate` يعيدانه، فتتجدّد القائمةُ بعد تقييمٍ من صفحة العمل بلا منطقٍ هنا.
 */
const PAGE_PAD = 16;
const HEADER_H = 56;
export const myRatingsKey = ["me:ratings"] as const;

export function RatingsScreen({ from }: { from: NativeRoot | "web" }) {
  const { t, tokens } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [onlyComments, setOnlyComments] = useState(false);
  const q = useQuery({
    queryKey: myRatingsKey,
    queryFn: async () => (await api<MyRatingsPayload>("/api/v1/me/ratings")).data,
    staleTime: 60_000,
  });
  const refresh = usePullRefresh([myRatingsKey], 0);

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

  const all = q.data?.items;
  const withComment = useMemo(() => (all ?? []).filter((r) => r.review), [all]);
  const rows = onlyComments ? withComment : (all ?? []);

  const renderRow = useCallback(
    ({ item: r }: { item: MyRating }) => {
      const uri = posterFor(r.poster_path, 44);
      return (
        <Pressable
          onPress={() => openTitle(r.kind, r.id)}
          accessibilityRole="link"
          style={({ pressed }) => ({ flexDirection: "row", gap: 12, padding: 10, borderRadius: 16, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, opacity: pressed ? 0.7 : 1 })}
        >
          <View style={{ width: 44, aspectRatio: 2 / 3, borderRadius: 8, overflow: "hidden", backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.border, alignItems: "center", justifyContent: "center" }}>
            {uri ? <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" /> : <Icon name={r.kind === "tv" ? "tv" : "film"} size={14} color={tokens.muted} />}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text size={14} weight="700" numberOfLines={1}>{r.title ?? `#${r.id}`}</Text>
            {/* «★ 9/10» بترتيبٍ واحدٍ في اللغتين: صفٌّ اتّجاهُه يسارٌ ليمين (النجمةُ رمزٌ محايد — في سطرٍ عربيٍّ كانت ستنتقل إلى يمين
                الرقم)، والصفُّ نفسُه يقف عند بداية السطر تحت الاسم */}
            <View style={{ flexDirection: "row", direction: "ltr", alignSelf: "flex-start", alignItems: "center", gap: 4, marginTop: 2 }}>
              <Text size={13} color={tokens.accent}>★</Text>
              <Text size={13} weight="600" style={{ fontVariant: ["tabular-nums"] }}>{`${r.rating}/10`}</Text>
            </View>
            {r.review ? <Text size={12} muted numberOfLines={3} style={{ marginTop: 4, lineHeight: 19 }}>{r.review}</Text> : null}
          </View>
        </Pressable>
      );
    },
    [openTitle, tokens],
  );

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg }}>
      <View style={{ paddingTop: insets.top, height: insets.top + HEADER_H, flexDirection: "row", alignItems: "center", paddingHorizontal: 8, gap: 4 }}>
        <Pressable onPress={back} accessibilityRole="button" accessibilityLabel={t.closeLabel} hitSlop={4} style={({ pressed }) => ({ width: 40, height: 40, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}>
          <BackChevron color={tokens.fg} />
        </Pressable>
        <Text size={17} weight="700">{t.ratingsTitle}</Text>
      </View>

      {!all ? (
        q.isError ? (
          <View style={{ alignItems: "center", gap: 12, paddingTop: 48, paddingHorizontal: PAGE_PAD }}>
            <Text muted style={{ textAlign: "center" }}>{t.apiInternal}</Text>
            <Button label={t.errorRetry} variant="ghost" onPress={() => void q.refetch()} />
          </View>
        ) : (
          /* هيكلٌ بشكل الشاشة: الرقاقتان ثمّ بطاقاتُ صفوف */
          <View style={{ paddingHorizontal: PAGE_PAD, paddingTop: 6, gap: 8 }}>
            <View style={{ height: 28, width: 150, borderRadius: 14, backgroundColor: tokens.surface2, marginBottom: 4 }} />
            {Array.from({ length: 7 }, (_, i) => (
              <View key={i} style={{ height: 88, borderRadius: 16, backgroundColor: tokens.surface2 }} />
            ))}
          </View>
        )
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => `${r.kind}-${r.id}`}
          renderItem={renderRow}
          refreshControl={refresh}
          initialNumToRender={10}
          ItemSeparatorComponent={Gap}
          ListHeaderComponent={
            <View style={{ flexDirection: "row", gap: 8, paddingTop: 6, paddingBottom: 12 }}>
              <Chip label={`${t.ratingsAll} ${all.length}`} active={!onlyComments} onPress={() => setOnlyComments(false)} />
              <Chip label={`${t.ratingsWithComment} ${withComment.length}`} active={onlyComments} onPress={() => setOnlyComments(true)} />
            </View>
          }
          ListEmptyComponent={<Text muted style={{ textAlign: "center", paddingVertical: 56 }}>{t.ratingsEmpty}</Text>}
          contentContainerStyle={{ paddingHorizontal: PAGE_PAD, paddingBottom: insets.bottom + 40 }}
        />
      )}
    </View>
  );
}

function Gap() {
  return <View style={{ height: 8 }} />;
}
