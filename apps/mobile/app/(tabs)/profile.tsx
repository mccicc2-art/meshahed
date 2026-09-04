import React from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { useAuth } from "../../src/auth";
import { useApp } from "../../src/state";
import { queryClient } from "../../src/api";
import { Button, Card, Loading, Screen, Text } from "../../src/ui";
import { space } from "../../src/theme";

/** الملفُّ — اسمٌ وصورةٌ وشاراتٌ وزرُّ خروج. الإعداداتُ تبقى في الويب في النسخة الأولى. */
export default function Profile() {
  const { signOut } = useAuth();
  const { me, meLoading, t, tokens } = useApp();
  if (meLoading) return <Screen><Loading /></Screen>;
  return (
    <Screen style={{ padding: space.lg, gap: space.lg }}>
      <Text size={28} weight="700">{t.profile}</Text>
      <Card style={{ flexDirection: "row", gap: space.md, alignItems: "center" }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, overflow: "hidden", backgroundColor: tokens.surface2 }}>
          {me?.avatar_url ? <Image source={{ uri: me.avatar_url }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : null}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text size={18} weight="700" numberOfLines={1}>{me?.nickname ?? me?.username ?? "—"}</Text>
            {me?.verified ? <Text style={{ color: tokens.accent }}>✔</Text> : null}
          </View>
          {me?.username ? <Text muted>@{me.username}</Text> : null}
          {me?.plus ? <Text size={12} style={{ color: tokens.accent }}>{me.partner ? "Partner" : "Plus"}</Text> : null}
        </View>
      </Card>
      {me?.bio ? <Text muted>{me.bio}</Text> : null}
      <View style={{ flex: 1 }} />
      <Button
        label={t.signOut}
        variant="ghost"
        onPress={async () => {
          await signOut();
          queryClient.clear();
        }}
      />
    </Screen>
  );
}
