import React, { useCallback, useRef } from "react";
import { FlatList, Pressable, View } from "react-native";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon } from "../icons";
import { Sheet } from "../library/Sheet";
import { haptic } from "../haptics";
import { displayNameOf } from "@/core/people";
import type { FollowsPayload } from "../contracts";

/**
 * ورقةُ «يتابعونني / أتابعهم» — `FollowCountButton` الويب (Phase 11-H، تقفل D-1066 §10).
 * **الصفُّ صفُّ `FriendPicker` نفسُه** (الأفاتار ٣٦ + الاسم + `@username`) لأنّ الويب يرسم
 * القائمتين بـ`PersonRowLink` واحد (D-565) — لا صفَّ ثانياً. النقرُ يفتح ملفَّ الشخص (🆕 11-N · N1: أصليّاً — `onOpen`
 * باسمه)؛ والمخفي الاسمُ بلا رابط (قاعدةُ `displayNameOf`).
 * 🆕 N1 — `userId`: قائمتا شخصٍ آخر (عدّادا ملفّه) — القفلُ والخصوصيّةُ في القاعدة (`follow_people`)، والمفتاحُ يحمله.
 */
/**
 * 🆕 D-1325 — **قائمةٌ افتراضيّةٌ بارتفاعٍ معلوم، وموضعٌ يُستعاد** (تسجيلُ أحمد ٨ أكتوبر):
 * - كانت `ScrollView` تركّب كلَّ الصفوف، والورقةُ تظهر قصيرةً («جارٍ التحميل») ثمّ تطول حين تصل الأسماء. الآن الصفُّ
 *   بارتفاعٍ ثابت (`ROW_H`)، والورقةُ تأخذ ارتفاعَها من **العدّاد الذي ضُغط** (`count`) قبل وصول القائمة فلا تقفز،
 *   وتُركَّب الصفوفُ الظاهرةُ وحدَها — عشرةُ متابعين ومئاتٌ سواء.
 * - `startY` و`onOpen(href, y)`: من فتح ملفّاً منها يعود فيجدها حيث تركها (الفاتحُ يحفظ الموضعَ ويعيده — `ProfileScreen`).
 */
const ROW_H = 57;
const MAX_H = 420;
type Person = FollowsPayload["people"][number];

export function FollowsSheet({
  dir,
  userId,
  count,
  startY = 0,
  onClose,
  onOpen,
}: {
  dir: "followers" | "following";
  userId?: string;
  /** العدّادُ المضغوط — ارتفاعُ الورقة قبل وصول القائمة */
  count?: number;
  startY?: number;
  onClose: () => void;
  onOpen: (username: string, y: number) => void;
}) {
  const { t, tokens } = useApp();
  const q = useQuery({
    /* مفتاحٌ بلا وسمٍ من `tags.ts`: لا كتابةَ في التطبيق تُبطل هذه القائمة، و`staleTime` دقيقةٌ تكفي */
    queryKey: ["me:follows", dir, userId ?? "me"],
    queryFn: async () => (await api<FollowsPayload>(`/api/v1/me/follows?dir=${dir}${userId ? `&user=${userId}` : ""}`)).data.people,
    staleTime: 60_000,
  });
  const people = q.data;
  const y = useRef(startY);
  const heightOf = (n: number) => Math.min(MAX_H, Math.max(1, n) * ROW_H);
  const renderItem = useCallback(
    ({ item: p, index }: { item: Person; index: number }) => {
      const label = displayNameOf(p, t.anonymousUser);
      /* 🔴 N1-fix4 — **من لا اسمَ مستخدمٍ له يُفتح بمعرّفه** (أحمد ٢٩ سبتمبر: «فيه كم شخص ما أقدر أدخل البروفايل حقه»): قاعدةُ الويب
         نفسُها (`PeopleFollowList`: `username ?? id` — و`profileHref`): نصفُ الأعضاء بلا اسم مستخدم، فكان صفُّهم ميّتاً هنا وحدَه */
      const href = p.username?.trim() || p.id || null;
      return (
        <Pressable
          disabled={!href}
          onPress={() => {
            if (!href) return;
            haptic.pick();
            onClose();
            onOpen(href, y.current);
          }}
          accessibilityRole={href ? "link" : undefined}
          style={({ pressed }) => [{ height: ROW_H, flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, borderTopColor: index > 0 ? tokens.divider : "transparent", opacity: pressed ? 0.7 : 1 }]}
        >
          <View style={{ width: 36, height: 36, borderRadius: 18, overflow: "hidden", backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
            {!p.hide_name && p.avatar_url ? <Image source={{ uri: p.avatar_url }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" /> : <Icon name="people" size={16} color={tokens.muted} />}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text size={14} weight="600" numberOfLines={1}>{label}</Text>
            {p.username && !p.hide_name ? <Text size={12} muted numberOfLines={1}>@{p.username}</Text> : null}
          </View>
        </Pressable>
      );
    },
    [t, tokens, onClose, onOpen],
  );
  return (
    <Sheet title={dir === "followers" ? t.followsTabFollowers : t.followsTabFollowing} onClose={onClose}>
      {!people ? (
        <View style={{ height: heightOf(count ?? 1), alignItems: "center", justifyContent: "center" }}>
          <Text size={13} muted style={{ textAlign: "center" }}>{q.isError ? t.apiInternal : t.shareLoadingPeople}</Text>
        </View>
      ) : people.length === 0 ? (
        <Text size={13} muted style={{ textAlign: "center", paddingVertical: 24 }}>{t.followListEmpty}</Text>
      ) : (
        <FlatList
          data={people}
          renderItem={renderItem}
          keyExtractor={(p) => p.id}
          getItemLayout={(_, index) => ({ length: ROW_H, offset: ROW_H * index, index })}
          style={{ height: heightOf(people.length) }}
          contentOffset={{ x: 0, y: Math.min(startY, Math.max(0, people.length * ROW_H - heightOf(people.length))) }}
          onScroll={(e) => {
            y.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={32}
          initialNumToRender={Math.ceil(MAX_H / ROW_H) + 1 + Math.ceil(startY / ROW_H)}
          maxToRenderPerBatch={8}
          windowSize={5}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Sheet>
  );
}
