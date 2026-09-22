import React from "react";
import { Pressable, ScrollView, View } from "react-native";
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
 * القائمتين بـ`PersonRowLink` واحد (D-565) — لا صفَّ ثانياً. النقرُ يفتح ملفَّ الشخص في الويب
 * كما في الويب؛ والمخفي الاسمُ بلا رابط (قاعدةُ `displayNameOf`).
 */
export function FollowsSheet({ dir, onClose, onOpenWeb }: { dir: "followers" | "following"; onClose: () => void; onOpenWeb: (path: string) => void }) {
  const { t, tokens } = useApp();
  const q = useQuery({
    /* مفتاحٌ بلا وسمٍ من `tags.ts`: لا كتابةَ في التطبيق تُبطل هذه القائمة، و`staleTime` دقيقةٌ تكفي */
    queryKey: ["me:follows", dir],
    queryFn: async () => (await api<FollowsPayload>(`/api/v1/me/follows?dir=${dir}`)).data.people,
    staleTime: 60_000,
  });
  const people = q.data;
  return (
    <Sheet title={dir === "followers" ? t.followsTabFollowers : t.followsTabFollowing} onClose={onClose}>
      {!people ? (
        <Text size={13} muted style={{ textAlign: "center", paddingVertical: 24 }}>{q.isError ? t.apiInternal : t.shareLoadingPeople}</Text>
      ) : people.length === 0 ? (
        <Text size={13} muted style={{ textAlign: "center", paddingVertical: 24 }}>{t.followListEmpty}</Text>
      ) : (
        <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
          {people.map((p, i) => {
            const label = displayNameOf(p, t.anonymousUser);
            const href = !p.hide_name && p.username ? `/u/${p.username}` : null;
            return (
              <Pressable
                key={p.id}
                disabled={!href}
                onPress={() => {
                  if (!href) return;
                  haptic.pick();
                  onClose();
                  onOpenWeb(href);
                }}
                accessibilityRole={href ? "link" : undefined}
                style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: tokens.divider, opacity: pressed ? 0.7 : 1 }]}
              >
                <View style={{ width: 36, height: 36, borderRadius: 18, overflow: "hidden", backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
                  {!p.hide_name && p.avatar_url ? <Image source={{ uri: p.avatar_url }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : <Icon name="people" size={16} color={tokens.muted} />}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text size={14} weight="600" numberOfLines={1}>{label}</Text>
                  {p.username && !p.hide_name ? <Text size={12} muted numberOfLines={1}>@{p.username}</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </Sheet>
  );
}
