import React, { useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api, qk } from "../api";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import { haptic } from "../haptics";
import { IdentityBadges, identityFlags } from "../IdentityBadges";
import { Avatar } from "../community/CommunityCards";
import { displayNameOf } from "@/core/people";
import { MSG_NOTE_MAX } from "@/core/contracts/messages";
import type { FriendsPayload } from "../contracts";

/**
 * ====== منتقي صديقٍ للإرسال — `FriendPicker` الواحد (G6 ثمّ Phase 11-M · M5) ======
 *
 * 🔑 **وُلد في ورقة مشاركة القائمة (G6) ونُقل هنا في M5** لأنّ «أرسِله لـ…» في صفحة العمل هو الشيءُ نفسُه: اختيارٌ واحدٌ من
 * المتابعة المتبادلة (`/api/v1/me/friends` ⇐ `myMutualFollows` — القاعدةُ تردّ ما سواهم) + ملاحظةٌ حتّى ٢٨٠ حرفاً ثمّ «أرسل».
 * **منتقٍ واحدٌ لبابين** (القاعدة ٣) — ما يُرسَل (قائمةٌ أو عمل) يقرّره `onSend` عند صاحبه.
 * والشارةُ بجانب الاسم كما في `SendShareSheet` الويب (D-773ب): من يُرسَل إليه يُعرَف كما يُعرَف في كلِّ سطح.
 */
export function FriendPicker({ onSend, onError }: { onSend: (recipientId: string, note: string | null) => Promise<void>; onError: (e: unknown) => void }) {
  const { t, tokens } = useApp();
  const q = useQuery({
    queryKey: qk.tag("me:friends"),
    queryFn: async () => (await api<FriendsPayload>("/api/v1/me/friends")).data.people,
    staleTime: 5 * 60_000,
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!selected || busy) return;
    setBusy(true);
    try {
      await onSend(selected, note.trim() || null);
      haptic.success();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };
  const people = q.data;
  return (
    <View style={{ gap: 12 }}>
      {!people ? (
        <Text size={13} muted style={{ textAlign: "center", paddingVertical: 24 }}>{q.isError ? t.apiInternal : t.shareLoadingPeople}</Text>
      ) : people.length === 0 ? (
        <Text size={13} muted style={{ textAlign: "center", paddingVertical: 24 }}>{t.shareNoMutual}</Text>
      ) : (
        <>
          <Text size={12} muted>{t.shareSendPickHint}</Text>
          <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {people.map((p, i) => {
              const on = selected === p.id;
              const label = displayNameOf(p, t.anonymousUser);
              return (
                <Pressable
                  key={p.id}
                  onPress={() => {
                    haptic.pick();
                    setSelected(on ? null : p.id);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: tokens.divider }}
                >
                  <Avatar uri={p.hide_name ? null : p.avatar_url} size={36} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Text size={14} weight="600" numberOfLines={1} style={{ flexShrink: 1 }}>{label}</Text>
                      {p.hide_name ? null : <IdentityBadges flags={identityFlags(p)} nameSize={14} />}
                    </View>
                    {p.username && !p.hide_name ? <Text size={12} muted numberOfLines={1}>@{p.username}</Text> : null}
                  </View>
                  {/* الاختيارُ: دائرةٌ بحدٍّ تمتلئ بلون التمييز — نمطُ الـradio في الويب */}
                  <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: on ? tokens.accent : tokens.border, backgroundColor: on ? tokens.accent : "transparent", alignItems: "center", justifyContent: "center" }}>
                    {on ? <Icon name="check-line" size={12} color={tokens.onAccent} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
          <NoteField value={note} onChange={setNote} />
          <Button label={t.shareSendButton} busy={busy} disabled={!selected} onPress={() => void send()} />
        </>
      )}
    </View>
  );
}

/** سطرُ الملاحظة الاختياريّ — حدُّ `sendShare`/`sendListShare` (٢٨٠) */
export function NoteField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t, tokens } = useApp();
  return (
    <TextInput
      value={value}
      onChangeText={(v) => onChange(v.slice(0, MSG_NOTE_MAX))}
      placeholder={t.shareSendNotePlaceholder}
      accessibilityLabel={t.shareSendNotePlaceholder}
      placeholderTextColor={tokens.muted}
      multiline
      maxLength={MSG_NOTE_MAX}
      textAlignVertical="top"
      style={{ minHeight: 72, backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.border, borderRadius: radius.control, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: tokens.fg, textAlign: "left" }}
    />
  );
}
