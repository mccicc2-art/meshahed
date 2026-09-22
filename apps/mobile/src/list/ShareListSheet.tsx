import React, { useState } from "react";
import { Pressable, ScrollView, Share, TextInput, View } from "react-native";
import { Image } from "expo-image";
import * as Clipboard from "expo-clipboard";
import { useQuery } from "@tanstack/react-query";
import { api, qk, write } from "../api";
import { CONFIG } from "../config";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import { Sheet } from "../library/Sheet";
import { haptic } from "../haptics";
import { displayNameOf } from "@/core/people";
import { num } from "@/core/i18n";
import type { CommunitiesPayload, CommunityPostBody, FriendsPayload, ListUpdateBody, ShareFriendBody } from "../contracts";

/**
 * ====== ورقةُ مشاركة القائمة — `ShareListSheet` (الويب) بالبكسل (Phase 11-G · G6) ======
 *
 * 🔑 **كانت آخرَ بابٍ ويبيٍّ في صفحة القائمة الأصليّة** (`?share=1`، D-952): قائمةٌ خاصّةٌ تُشارَك = تحميلُ مستند.
 * الآن ورقةٌ واحدةٌ بثلاثِ رؤى في حالةٍ محلّيّة (`main` · `friend` · `community`) **لا ورقاتٌ متراكبة** — وصفةُ الويب
 * حرفاً. **معلنةٌ**: إلى صديق (أساسيّ) · إلى مجتمع · مشاركةُ الرابط (ورقةُ النظام) · نسخُ الرابط. **خاصّة**: زرٌّ واحد
 * «أعلنها وانسخ الرابط» (`lists/update` بـ`isPublic:true` ثمّ الحافظة).
 *
 * 🔑 **الرابطُ الرسميّ دائماً** (`CONFIG.apiBase`، مقابلُ `siteUrl` في الويب) — لا عنوانٌ من نافذةٍ.
 * 🔑 **الأصدقاءُ = متابعةٌ متبادلة** (`/api/v1/me/friends` ⇐ `myMutualFollows`)، **والمجتمعاتُ** من `my_communities`؛
 * الإرسالُ يكتب `list_shares` (يصل صندوقَ المتلقّي) والنشرُ رسالةً نصُّها الرابط (فقاعةُ المجتمع تحوّله رابطاً).
 */
type View3 = "main" | "friend" | "community";

export function ShareListSheet({
  listId,
  name,
  isPublic,
  mine,
  onClose,
  onChanged,
  onToast,
  onError,
}: {
  listId: string;
  name: string;
  isPublic: boolean;
  /**
   * ⚖️ افتراقٌ محصورٌ عن الويب: «إلى صديق» **للمالك وحدَه** — `sendListShare` يطابق `user_id = me` فيرمي «القائمة غير
   * موجودة» لغيره؛ الويبُ يرسم الزرَّ لكلِّ معلنةٍ ويفشل عند الضغط. زرٌّ يفشل دائماً عيبٌ لا تكافؤ. المجتمعُ والرابطُ للكلّ.
   */
  mine: boolean;
  onClose: () => void;
  /** بعد الإعلان — صاحبُ الورقة يُعيد جلبَ القائمة */
  onChanged: () => void;
  onToast: (text: string) => void;
  onError: (e: unknown) => void;
}) {
  const { t, tokens } = useApp();
  const [view, setView] = useState<View3>("main");
  const [busy, setBusy] = useState(false);
  const url = `${CONFIG.apiBase}/lists/${listId}`;

  const copy = async () => {
    await Clipboard.setStringAsync(url);
    onToast(t.linkCopied);
  };
  const systemShare = async () => {
    try {
      await Share.share({ message: `${name} — ${url}`, url });
    } catch {
      /* أُغلقت ورقةُ النظام */
    }
  };
  const makePublicThenCopy = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await write<{ done: true }>("/api/v1/lists/update", { listId, name, isPublic: true } satisfies ListUpdateBody);
      onChanged();
      await Clipboard.setStringAsync(url);
      haptic.success();
      onToast(t.listMadePublicCopied);
      onClose();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };

  const title = view === "friend" ? t.listShareToFriend : view === "community" ? t.listShareToCommunity : t.listShareSheetTitle;
  return (
    <Sheet title={title} onClose={onClose}>
      {view !== "main" ? (
        <Pressable onPress={() => setView("main")} hitSlop={8} accessibilityRole="button" accessibilityLabel={t.convBackAria} style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginBottom: 8 }}>
          <View style={{ transform: [{ rotate: "90deg" }] }}>
            <Icon name="chevron-down" size={14} color={tokens.muted} />
          </View>
          <Text size={12} weight="600" muted>{t.listShareSheetTitle}</Text>
        </Pressable>
      ) : null}

      {view === "main" ? (
        <View style={{ gap: 10 }}>
          <Text size={13} muted style={{ lineHeight: 20 }}>{isPublic ? t.listSharePublicHint : t.listSharePrivateHint}</Text>
          {isPublic ? (
            <>
              {mine ? <Button label={t.listShareToFriend} onPress={() => setView("friend")} /> : null}
              <Button label={t.listShareToCommunity} variant={mine ? "ghost" : "primary"} onPress={() => setView("community")} />
              <Button label={t.listShareLinkBtn} variant="ghost" onPress={() => void systemShare()} />
              <Button label={t.shareCopyLink} variant="ghost" onPress={() => void copy()} />
            </>
          ) : (
            <Button label={t.listMakePublicShare} busy={busy} onPress={() => void makePublicThenCopy()} />
          )}
        </View>
      ) : view === "friend" ? (
        <FriendPicker listId={listId} onDone={onClose} onToast={onToast} onError={onError} />
      ) : (
        <CommunityPicker listUrl={url} onDone={onClose} onToast={onToast} onError={onError} />
      )}
    </Sheet>
  );
}

/** اختيارٌ واحدٌ من المتابعة المتبادلة + ملاحظةٌ حتّى ٢٨٠ حرفاً ثمّ «أرسل» — `FriendPicker` الويب */
function FriendPicker({ listId, onDone, onToast, onError }: { listId: string; onDone: () => void; onToast: (s: string) => void; onError: (e: unknown) => void }) {
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
      await write<{ done: true }>("/api/v1/lists/share-friend", { listId, recipientId: selected, note: note.trim() || null } satisfies ShareFriendBody);
      haptic.success();
      onToast(t.shareSentToast);
      onDone();
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
                  <View style={{ width: 36, height: 36, borderRadius: 18, overflow: "hidden", backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
                    {!p.hide_name && p.avatar_url ? <Image source={{ uri: p.avatar_url }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : <Icon name="people" size={16} color={tokens.muted} />}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text size={14} weight="600" numberOfLines={1}>{label}</Text>
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
          <TextInput
            value={note}
            onChangeText={(v) => setNote(v.slice(0, 280))}
            placeholder={t.shareSendNotePlaceholder}
            placeholderTextColor={tokens.muted}
            multiline
            textAlignVertical="top"
            style={{ minHeight: 72, backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.border, borderRadius: radius.control, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: tokens.fg, textAlign: "left" }}
          />
          <Button label={t.shareSendButton} busy={busy} disabled={!selected} onPress={() => void send()} />
        </>
      )}
    </View>
  );
}

/** مجتمعاتي — الضغطُ ينشر الرابطَ في المجتمع فوراً (كالويب: لا خطوةَ تأكيدٍ ثانية) */
function CommunityPicker({ listUrl, onDone, onToast, onError }: { listUrl: string; onDone: () => void; onToast: (s: string) => void; onError: (e: unknown) => void }) {
  const { t, tokens, locale } = useApp();
  const q = useQuery({
    queryKey: qk.tag("me:communities"),
    queryFn: async () => (await api<CommunitiesPayload>("/api/v1/me/communities")).data.rooms,
    staleTime: 5 * 60_000,
  });
  const [busyId, setBusyId] = useState<string | null>(null);
  const post = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    try {
      await write<{ done: true }>("/api/v1/communities/post", { communityId: id, body: listUrl } satisfies CommunityPostBody);
      haptic.success();
      onToast(t.listSharePostedToast);
      onDone();
    } catch (e) {
      onError(e);
    } finally {
      setBusyId(null);
    }
  };
  const rooms = q.data;
  return (
    <View style={{ gap: 12 }}>
      {!rooms ? (
        <Text size={13} muted style={{ textAlign: "center", paddingVertical: 24 }}>{q.isError ? t.apiInternal : t.loadingLabel}</Text>
      ) : rooms.length === 0 ? (
        <Text size={13} muted style={{ textAlign: "center", paddingVertical: 24 }}>{t.listShareNoCommunities}</Text>
      ) : (
        <>
          <Text size={12} muted>{t.listSharePickCommunity}</Text>
          <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
            {rooms.map((c, i) => (
              <Pressable key={c.id} onPress={() => void post(c.id)} accessibilityRole="button" disabled={!!busyId} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: tokens.divider, opacity: pressed || busyId === c.id ? 0.6 : 1 })}>
                <View style={{ width: 36, height: 36, borderRadius: 18, overflow: "hidden", backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
                  {c.photo_url ? <Image source={{ uri: c.photo_url }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : <Icon name="people" size={16} color={tokens.muted} />}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text size={14} weight="600" numberOfLines={1}>{c.name}</Text>
                  <Text size={12} muted numberOfLines={1}>{t.commMembers(num(c.member_count, locale))}</Text>
                </View>
                <Icon name="send" size={16} color={tokens.muted} />
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}
    </View>
  );
}
