import React, { useMemo, useState } from "react";
import { I18nManager, Pressable, ScrollView, TextInput, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api, write } from "../api";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import { haptic } from "../haptics";
import { Sheet } from "../library/Sheet";
import { Avatar } from "../community/CommunityCards";
import { IdentityBadges, identityFlags } from "../IdentityBadges";
import { SYSTEM_FONT_CAP } from "../fontScale";
import { displayNameOf } from "@/core/people";
import { LIST_MEMBERS_MAX } from "@/core/contracts/library";
import type { FollowsPayload, ListMember, ListMembersBody, ListMembersPayload } from "../contracts";

/**
 * ====== «ادعُ إلى القائمة» — ورقةُ من تتابعهم (القوائمُ المشتركة · هجرة ٢٣٤) ======
 *
 * ⚖️ **من تتابعهم وحدَهم** (أحمد ٤ نوفمبر، ١أ — كمنتقي القروبات) · **أكثرُ من واحدٍ في ضغطة** · **العدّادُ يحسب صاحبَها
 * والمعلّقين** (٤ب: عشرةٌ معه) فلا يُختار ما لا يتّسع له. **والقاعدةُ هي الحارس** (`invite_list_members`) — العدّادُ هنا
 * لئلّا يضغط العضوُ زرّاً يعرف الخادمُ أنّه سيُرفض.
 * 🔑 **الصفُّ صفُّ `FriendPicker` نفسُه** (أفاتار ٣٦ · الاسم · @المعرّف · دائرةُ الاختيار)، والورقةُ `Sheet` الواحدة —
 * **وخلفيّتُها سوداء** (حكمُ أحمد على الصورة: «الخلفية سوداء بدل رصاصي»)، فحقلُ البحث بلون الصفحة بحدّ.
 */
export function ListInviteSheet({
  listId,
  name,
  members,
  onClose,
  onDone,
  onError,
}: {
  listId: string;
  name: string;
  members: ListMember[];
  onClose: () => void;
  onDone: (count: number) => void;
  onError: (e: unknown) => void;
}) {
  const { t, tokens } = useApp();
  const following = useQuery({
    queryKey: ["me:follows", "following", "me"],
    queryFn: async () => (await api<FollowsPayload>("/api/v1/me/follows?dir=following")).data.people,
    staleTime: 60_000,
  });
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const inList = useMemo(() => new Set(members.map((m) => m.id)), [members]);
  /* صاحبُها مقعدٌ دائماً — وقائمةٌ لم تُشارَك بعدُ لا أعضاءَ فيها، فيُحسب هو وحدَه */
  const taken = Math.max(1, members.length);
  const room = Math.max(0, LIST_MEMBERS_MAX - taken);
  const people = useMemo(() => {
    const all = (following.data ?? []).filter((p) => !inList.has(p.id));
    const k = query.trim().toLowerCase();
    return k ? all.filter((p) => `${p.nickname ?? ""} ${p.username ?? ""}`.toLowerCase().includes(k)) : all;
  }, [following.data, inList, query]);

  const toggle = (id: string) => {
    haptic.pick();
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= room ? cur : [...cur, id]));
  };
  const send = async () => {
    if (!picked.length || busy) return;
    setBusy(true);
    try {
      const r = await write<ListMembersPayload>("/api/v1/lists/members", { listId, action: "invite", userIds: picked } satisfies ListMembersBody);
      haptic.success();
      onDone(r.count ?? picked.length);
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={t.listInviteTitle(name)} onClose={onClose}>
      <View style={{ gap: 12 }}>
        <TextInput
          maxFontSizeMultiplier={SYSTEM_FONT_CAP}
          value={query}
          onChangeText={setQuery}
          placeholder={t.listInviteSearch}
          placeholderTextColor={tokens.muted}
          accessibilityLabel={t.listInviteSearch}
          style={{ height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.bg, paddingHorizontal: 14, fontSize: 15, color: tokens.fg, textAlign: I18nManager.isRTL ? "right" : "left" }}
        />
        {!following.data ? (
          <Text size={13} muted style={{ textAlign: "center", paddingVertical: 24 }}>{following.isError ? t.apiInternal : t.shareLoadingPeople}</Text>
        ) : people.length === 0 ? (
          <Text size={13} muted style={{ textAlign: "center", paddingVertical: 24 }}>{t.listInviteNoFollowing}</Text>
        ) : (
          <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {people.map((p, i) => {
              const on = picked.includes(p.id);
              const full = !on && picked.length >= room;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => toggle(p.id)}
                  disabled={full}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on, disabled: full }}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, opacity: full ? 0.4 : 1, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: tokens.divider }}
                >
                  <Avatar uri={p.hide_name ? null : p.avatar_url} size={36} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Text size={14} weight="600" numberOfLines={1} style={{ flexShrink: 1 }}>{displayNameOf(p, t.anonymousUser)}</Text>
                      {p.hide_name ? null : <IdentityBadges flags={identityFlags(p)} nameSize={14} />}
                    </View>
                    {p.username && !p.hide_name ? <Text size={12} muted numberOfLines={1}>@{p.username}</Text> : null}
                  </View>
                  <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: on ? tokens.accent : tokens.border, backgroundColor: on ? tokens.accent : "transparent", alignItems: "center", justifyContent: "center" }}>
                    {on ? <Icon name="check-line" size={12} color={tokens.onAccent} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
        <Button label={t.listInviteSend(picked.length)} busy={busy} disabled={!picked.length} onPress={() => void send()} />
        <Text size={12} muted style={{ textAlign: "center" }}>{t.listInviteNote(taken + picked.length, LIST_MEMBERS_MAX)}</Text>
      </View>
    </Sheet>
  );
}
