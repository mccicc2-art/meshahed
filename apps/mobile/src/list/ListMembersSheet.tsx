import React, { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { write } from "../api";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { haptic } from "../haptics";
import { Sheet } from "../library/Sheet";
import { Avatar } from "../community/CommunityCards";
import { LIST_MEMBERS_MAX } from "@/core/contracts/library";
import type { ListMember, ListMembersBody, ListMembersPayload } from "../contracts";

/**
 * ====== «الأعضاء · ٣ من ١٠» — ورقةُ القائمة المشتركة (هجرة ٢٣٤) ======
 *
 * ⚖️ **تُفتح بضغطةٍ على الصور المكدّسة في سطر صاحبها** (أحمد ٤ نوفمبر: الشكلُ «أ» — «و أ كيف يزيل اعضاء؟» ⇐ هنا):
 * الصفحةُ لا تطول بقسمٍ دائم، والإدارةُ — وهي نادرة — في ورقةٍ حين تُطلب.
 * - **صاحبُها**: «إزالة» للعضو و«إلغاء» للدعوة المعلّقة، و«ادعُ من تتابعهم» تحتها.
 * - **العضو**: يرى الفعّالين، و«غادر القائمة» تحتها.
 * - **الزائر**: يرى الفعّالين وحسب.
 * والأعمالُ التي أضافها من أُزيل تبقى — القائمةُ لصاحبها (`remove_list_member`).
 */
export function ListMembersSheet({
  listId,
  members,
  mine,
  meId,
  onClose,
  onInvite,
  onChanged,
  onLeft,
  onError,
}: {
  listId: string;
  members: ListMember[];
  mine: boolean;
  meId: string | null;
  onClose: () => void;
  onInvite: (() => void) | null;
  onChanged: (removedId: string) => void;
  onLeft: () => void;
  onError: (e: unknown) => void;
}) {
  const { t, tokens } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const amMember = !mine && !!meId && members.some((m) => m.id === meId && m.role === "member");

  const remove = async (userId: string) => {
    if (busy) return;
    setBusy(userId);
    try {
      await write<ListMembersPayload>("/api/v1/lists/members", { listId, action: "remove", userId } satisfies ListMembersBody);
      haptic.success();
      if (userId === meId) onLeft();
      else onChanged(userId);
    } catch (e) {
      onError(e);
    } finally {
      setBusy(null);
    }
  };

  const roleText = (m: ListMember) => (m.role === "owner" ? t.listMemberOwner : m.role === "pending" ? t.listMemberPending : t.listMemberActive);

  return (
    <Sheet title={t.listMembersTitle(members.length, LIST_MEMBERS_MAX)} onClose={onClose}>
      <View style={{ gap: 12 }}>
        <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
          {members.map((m, i) => (
            <View key={m.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: tokens.divider }}>
              <Avatar uri={m.avatar} size={36} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text size={14} weight="600" numberOfLines={1}>{m.name}</Text>
                <Text size={12} muted numberOfLines={1}>{roleText(m)}</Text>
              </View>
              {mine && m.role !== "owner" ? (
                <Pressable onPress={() => void remove(m.id)} disabled={busy !== null} hitSlop={10} accessibilityRole="button" accessibilityLabel={`${m.role === "pending" ? t.listMemberCancel : t.listMemberRemove} ${m.name}`}>
                  <Text size={13} muted style={{ opacity: busy === m.id ? 0.4 : 1 }}>{m.role === "pending" ? t.listMemberCancel : t.listMemberRemove}</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </ScrollView>
        {mine && onInvite ? <Button label={t.listInviteFromFollowing} variant="ghost" onPress={onInvite} /> : null}
        {amMember && meId ? <Button label={t.listMemberLeave} variant="ghost" busy={busy === meId} onPress={() => void remove(meId)} /> : null}
      </View>
    </Sheet>
  );
}
