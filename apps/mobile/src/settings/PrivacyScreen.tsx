import React, { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { IdentityBadges } from "../IdentityBadges";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "../state";
import { Text, Button } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import { haptic } from "../haptics";
import { Sheet } from "../library/Sheet";
import { api, queryClient, write } from "../api";
import type { ToastHostRef } from "../HoldHost";
import { SettingsScreen, Group, Row, Toggle, RowsSkeleton } from "./ui";
import { useSettings, saveSetting, patchSettings, messageOf, useOpenWeb } from "./api";
import { displayNameOf, type PersonLite } from "@/core/people";
import type { FollowsPayload, PeoplePayload, PrivacyBody, LibraryGrantBody, UnblockBody } from "../contracts";

/**
 * ====== الخصوصيّة (Phase 11-I · I2) — `privacy/page.tsx` ======
 *
 * المفاتيحُ الثلاثة (`AccountSettings`) كتابةٌ واحدةٌ لكلِّ ضغطة والفشلُ يعيد
 * الثلاثةَ معاً — مفتاحُ خصوصيّةٍ يبقى مقلوباً بعد فشلٍ يقول إنّ حسابَك أُقفل وهو
 * مفتوح. ثمّ «الناس»: من مُنحوا مكتبتي (منحٌ من متابِعيّ · سحب) والمحظورون (رفعُ
 * الحظر) — ورقتان من `Sheet` الواحدة كما في الويب (`SettingsBottomSheet`).
 */
export function PrivacyScreen() {
  const { t } = useApp();
  const q = useSettings();
  const s = q.data;
  const toast = useRef<ToastHostRef>(null);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<"grants" | "blocked" | null>(null);

  async function commit(next: PrivacyBody) {
    if (!s || busy) return;
    haptic.pick();
    setBusy(true);
    const out = await saveSetting<PrivacyBody>("/api/v1/me/settings/privacy", next, (x) => ({ ...x, privacy: { ...x.privacy, ...next } }));
    setBusy(false);
    if (!out) toast.current?.say(t.errSaveShort);
  }
  const pv = s?.privacy;
  return (
    <SettingsScreen title={t.setPrivacy} toast={toast}>
      {!pv ? (
        <RowsSkeleton rows={3} />
      ) : (
        <>
          <Group>
            <Toggle icon="eye-off" label={t.hideNameSection} hint={t.hideNameHint} checked={pv.hide_name} disabled={busy} onChange={() => void commit({ hide_name: !pv.hide_name, is_private: pv.is_private, hide_follow_lists: pv.hide_follow_lists })} />
            <Toggle icon="shield" label={t.privateSection} hint={t.privateHint} checked={pv.is_private} disabled={busy} onChange={() => void commit({ hide_name: pv.hide_name, is_private: !pv.is_private, hide_follow_lists: pv.hide_follow_lists })} />
            <Toggle icon="people" label={t.followListsSection} hint={t.followListsHint} checked={pv.hide_follow_lists} disabled={busy} onChange={() => void commit({ hide_name: pv.hide_name, is_private: pv.is_private, hide_follow_lists: !pv.hide_follow_lists })} />
          </Group>
          <Group label={t.setGroupPeople}>
            <Row icon="library" title={t.libraryAccessTitle} value={String(pv.library_grants)} onPress={() => setSheet("grants")} />
            <Row icon="shield" title={t.blockedListTitle} value={String(pv.blocked)} onPress={() => setSheet("blocked")} />
          </Group>
        </>
      )}
      {sheet === "grants" ? <GrantsSheet onClose={() => setSheet(null)} say={(m) => toast.current?.say(m)} /> : null}
      {sheet === "blocked" ? <BlockedSheet onClose={() => setSheet(null)} say={(m) => toast.current?.say(m)} /> : null}
    </SettingsScreen>
  );
}

const GRANTS_KEY = ["me:settings", "library-access"] as const;
const BLOCKED_KEY = ["me:settings", "blocked"] as const;

function PersonRow({ p, action, i, onOpen }: { p: PersonLite; action: React.ReactNode; i: number; onOpen?: () => void }) {
  const { t, tokens } = useApp();
  const name = displayNameOf(p, t.anonymousUser);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: tokens.divider }}>
      <Pressable onPress={onOpen} disabled={!onOpen} style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, overflow: "hidden", backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
          {!p.hide_name && p.avatar_url ? <Image source={{ uri: p.avatar_url }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Icon name="people" size={16} color={tokens.muted} />}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text size={14} weight="600" numberOfLines={1} style={{ flexShrink: 1 }}>{name}</Text>
            {/* الشاراتُ جزءٌ ممّا يُبنى عليه قرارُ الثقة (D-773ب) */}
            {/* D-1142 — الختمُ الذهبيُّ نفسُه (`IdentityBadges`) لا ✓ رفيع — للآخرين التوثيقُ وحدَه (الخطّةُ ليست في الصفّ) */}
            {!p.hide_name && p.verified_at ? <IdentityBadges flags={{ partner: false, plus: false, founder: false, verified: true }} nameSize={14} /> : null}
          </View>
          {p.username && !p.hide_name ? <Text size={12} muted numberOfLines={1}>@{p.username}</Text> : null}
        </View>
      </Pressable>
      {action}
    </View>
  );
}

/** الممنوحون — `LibraryAccessList`: المنتقي (متابِعيّ ممّن لم يُمنحوا) يلتفّ داخل الورقة لا ورقةً فوق ورقة */
function GrantsSheet({ onClose, say }: { onClose: () => void; say: (m: string) => void }) {
  const { t, tokens } = useApp();
  const openWeb = useOpenWeb();
  const list = useQuery({ queryKey: GRANTS_KEY, queryFn: async () => (await api<PeoplePayload>("/api/v1/me/settings/library-access")).data.people, staleTime: 0 });
  const [picking, setPicking] = useState(false);
  const followers = useQuery({ queryKey: ["me:follows", "followers"], queryFn: async () => (await api<FollowsPayload>("/api/v1/me/follows?dir=followers")).data.people, enabled: picking, staleTime: 60_000 });
  const items = list.data;
  const grantedIds = new Set((items ?? []).map((p) => p.id));
  const candidates = (followers.data ?? []).filter((p) => !grantedIds.has(p.id));
  const dict = t as unknown as Record<string, unknown>;

  async function setGrant(p: PersonLite, grant: boolean) {
    haptic.pick();
    const prev = items ?? [];
    queryClient.setQueryData<PersonLite[]>(GRANTS_KEY, grant ? [p, ...prev] : prev.filter((x) => x.id !== p.id));
    patchSettings((x) => ({ ...x, privacy: { ...x.privacy, library_grants: Math.max(0, x.privacy.library_grants + (grant ? 1 : -1)) } }));
    setPicking(false);
    try {
      await write<{ done: true }>("/api/v1/me/settings/library-access", { user_id: p.id, grant } satisfies LibraryGrantBody);
      if (grant) haptic.success();
      say(grant ? t.libraryGrantedToast : t.libraryRevokedToast);
    } catch (e) {
      queryClient.setQueryData(GRANTS_KEY, prev);
      patchSettings((x) => ({ ...x, privacy: { ...x.privacy, library_grants: prev.length } }));
      say(messageOf(e, dict, t.errSaveShort));
    }
  }
  return (
    <Sheet title={t.libraryAccessTitle} onClose={onClose}>
      <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
        <Button label={`+ ${t.libraryAccessAdd}`} variant="ghost" onPress={() => setPicking((v) => !v)} style={{ marginBottom: 12 }} />
        {picking ? (
          followers.isLoading ? (
            <View style={{ height: 48, borderRadius: radius.control, backgroundColor: tokens.surface2, marginBottom: 12 }} />
          ) : candidates.length === 0 ? (
            <Text size={12} muted style={{ marginBottom: 12 }}>{t.libraryAccessNoCandidates}</Text>
          ) : (
            <View style={{ borderWidth: 1, borderColor: tokens.border, borderRadius: radius.control, paddingHorizontal: 12, marginBottom: 12, maxHeight: 256 }}>
              <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                {candidates.map((p, i) => (
                  <PersonRow key={p.id} p={p} i={i} onOpen={() => void setGrant(p, true)} action={<Pressable onPress={() => void setGrant(p, true)} hitSlop={8} accessibilityLabel={t.libraryAccessAdd}><Icon name="plus" size={16} color={tokens.accent} /></Pressable>} />
                ))}
              </ScrollView>
            </View>
          )
        ) : null}
        {!items ? (
          <Text size={13} muted style={{ textAlign: "center", paddingVertical: 24 }}>{list.isError ? t.apiInternal : t.shareLoadingPeople}</Text>
        ) : items.length === 0 ? (
          <Text size={12} muted>{t.libraryAccessEmpty}</Text>
        ) : (
          items.map((p, i) => (
            <PersonRow key={p.id} p={p} i={i} onOpen={!p.hide_name && p.username ? () => { onClose(); openWeb(`/u/${p.username}`); } : undefined} action={<Button size="sm" variant="ghost" label={t.libraryRevokeButton} onPress={() => void setGrant(p, false)} />} />
          ))
        )}
      </ScrollView>
    </Sheet>
  );
}

/** المحظورون — `BlockedList`: رفعُ الحظر فقط؛ الحظرُ من صفحة الشخص */
function BlockedSheet({ onClose, say }: { onClose: () => void; say: (m: string) => void }) {
  const { t } = useApp();
  const list = useQuery({ queryKey: BLOCKED_KEY, queryFn: async () => (await api<PeoplePayload>("/api/v1/me/settings/blocked")).data.people, staleTime: 0 });
  const items = list.data;
  const dict = t as unknown as Record<string, unknown>;
  async function unblock(p: PersonLite) {
    haptic.pick();
    const prev = items ?? [];
    queryClient.setQueryData<PersonLite[]>(BLOCKED_KEY, prev.filter((x) => x.id !== p.id));
    patchSettings((x) => ({ ...x, privacy: { ...x.privacy, blocked: Math.max(0, x.privacy.blocked - 1) } }));
    try {
      await write<{ done: true }>("/api/v1/me/settings/blocked", { user_id: p.id } satisfies UnblockBody);
      say(t.unblockedToast);
    } catch (e) {
      queryClient.setQueryData(BLOCKED_KEY, prev);
      patchSettings((x) => ({ ...x, privacy: { ...x.privacy, blocked: prev.length } }));
      say(messageOf(e, dict, t.errSaveShort));
    }
  }
  return (
    <Sheet title={t.blockedListTitle} onClose={onClose}>
      <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
        {!items ? (
          <Text size={13} muted style={{ textAlign: "center", paddingVertical: 24 }}>{list.isError ? t.apiInternal : t.shareLoadingPeople}</Text>
        ) : items.length === 0 ? (
          <Text size={12} muted>{t.blockedEmpty}</Text>
        ) : (
          items.map((p, i) => <PersonRow key={p.id} p={p} i={i} action={<Button size="sm" variant="ghost" label={t.unblockButton} onPress={() => void unblock(p)} />} />)
        )}
      </ScrollView>
    </Sheet>
  );
}
