import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, I18nManager, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { queryClient, write } from "../api";
import { useApp } from "../state";
import { Button, Text, type ToastTone } from "../ui";
import { Icon, type IconName } from "../icons";
import { radius } from "../theme";
import { haptic } from "../haptics";
import { ToastHost, type ToastHostRef } from "../HoldHost";
import { Sheet } from "../library/Sheet";
import { IdentityBadges, identityFlags } from "../IdentityBadges";
import { Avatar } from "../community/CommunityCards";
import { errorText } from "../community/communityActs";
import { SYSTEM_FONT_CAP } from "../fontScale";
import { openProfile } from "../member/open";
import { MESSAGES_KEY } from "./live";
import { useMessages, type Origin } from "./common";
import { usePicUpload } from "./chatDock";
import { GroupAvatar, dropGroup, patchGroup, personIn } from "./groups";
import { displayNameOf } from "@/core/people";
import { GROUP_NAME_MAX, GROUP_RANK_LEVEL, canRemove, rankOf, rolesFor, type GroupRank } from "@/core/contracts/groups";
import type { GroupManageBody } from "../contracts";

/**
 * ====== معلوماتُ القروب (الصورةُ المعتمدة ١٥ أكتوبر) ======
 *
 * الصورةُ والاسمُ والعدد · ثلاثةُ أزرار: إضافة · كتم · تعديل (الإضافةُ والتعديلُ للمشرف) · الأعضاءُ والمشرفُ معلَّم، والمشرفُ
 * يحذف بلمسة على العضو · «الخروج من القروب» بالأحمر تحت، بتأكيدٍ وسطيّ لأنّه لا يُتراجع عنه بضغطة.
 */
export function GroupInfoScreen({ id, from }: { id: string; from: Origin }) {
  const { t, tokens } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const q = useMessages();
  const d = q.data ?? null;
  const me = d?.me_id ?? "";
  const g = d?.groups?.find((x) => x.group_id === id) ?? null;
  /* 🆕 D-1453 — رتبتي: الخادمُ الأحدث يرسل `me_rank`، والأقدمُ `me_role` وحده */
  const myRank: GroupRank = g?.me_rank ?? (g?.me_role === "admin" ? "admin" : "member");
  const admin = GROUP_RANK_LEVEL[myRank] >= 1;
  const rankIn = (uid: string): GroupRank => {
    const m = g?.members.find((x) => x.id === uid);
    return m ? m.rank ?? rankOf(m.role) : "member";
  };
  const toastHost = useRef<ToastHostRef>(null);
  const say = useCallback((text: string, tone?: ToastTone) => toastHost.current?.say(text, undefined, undefined, tone), []);
  const [busy, setBusy] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [member, setMember] = useState<string | null>(null);
  /* 🆕 D-1453 — الإخراجُ بتأكيدٍ وسطيّ (لا يُتراجع عنه بضغطة) */
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [edit, setEdit] = useState(false);

  const back = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: "/messages", params: { from } });
  }, [router, from]);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      back();
      return true;
    });
    return () => sub.remove();
  }, [back]);
  const leaving = useRef(false);
  useEffect(() => {
    if (d && !g && q.isFetchedAfterMount && !leaving.current) router.replace({ pathname: "/messages", params: { from } });
  }, [d, g, q.isFetchedAfterMount, router, from]);

  const manage = useCallback(
    (body: GroupManageBody, onOk?: () => void) => {
      setBusy(true);
      return write(`/api/v1/me/groups/${id}/manage`, body)
        .then(() => {
          onOk?.();
          void queryClient.invalidateQueries({ queryKey: MESSAGES_KEY });
        })
        .catch((e: unknown) => say(errorText(t, e)))
        .finally(() => setBusy(false));
    },
    [id, say, t],
  );

  const toggleMute = () => {
    if (!g) return;
    haptic.pick();
    const next = !g.muted;
    patchGroup(id, (x) => ({ ...x, muted: next }));
    void manage({ action: "mute", muted: next });
  };
  const leave = () => {
    setConfirmLeave(false);
    haptic.pick();
    leaving.current = true;
    void manage({ action: "leave" }, () => {
      dropGroup(id);
      /* القروبُ وصفحتُه تحت ⇒ تُنزلان معاً إلى الصندوق */
      router.dismissTo({ pathname: "/messages", params: { from } });
    });
  };
  const remove = (uid: string) => {
    setConfirmRemove(null);
    setMember(null);
    haptic.pick();
    void manage({ action: "remove", person_id: uid }, () => patchGroup(id, (x) => ({ ...x, members: x.members.filter((m) => m.id !== uid) })));
  };
  const setRole = (uid: string, role: "co_owner" | "admin" | "member") => {
    setMember(null);
    haptic.pick();
    void manage({ action: "role", person_id: uid, role }, () =>
      patchGroup(id, (x) => ({ ...x, members: x.members.map((m) => (m.id === uid ? { ...m, rank: role, role: role === "member" ? "member" : "admin" } : m)) })),
    );
  };

  if (!g) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={tokens.accent} />
      </View>
    );
  }

  const action = (icon: IconName, label: string, onPress: () => void, enabled = true) => (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ flex: 1, alignItems: "center", gap: 6, paddingVertical: 12, borderRadius: 14, backgroundColor: tokens.surface, opacity: !enabled ? 0.4 : pressed ? 0.7 : 1 })}
    >
      <Icon name={icon} size={20} color={tokens.accent} />
      <Text size={12} weight="700">{label}</Text>
    </Pressable>
  );
  const picked = member ? personIn(g, member) : null;

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg }}>
      <View style={{ paddingTop: insets.top, borderBottomWidth: 1, borderBottomColor: tokens.border }}>
        <View style={{ height: 56, flexDirection: "row", alignItems: "center", paddingHorizontal: 8, gap: 4 }}>
          <Pressable onPress={back} hitSlop={8} accessibilityRole="button" accessibilityLabel={t.backAria} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
            <View style={{ transform: [{ rotate: I18nManager.isRTL ? "-90deg" : "90deg" }] }}>
              <Icon name="chevron-down" size={22} color={tokens.fg} />
            </View>
          </Pressable>
          <Text size={16} weight="700">{t.grpInfo}</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: insets.bottom + 40 }}>
        <View style={{ alignItems: "center", gap: 6 }}>
          <GroupAvatar g={g} meId={me} size={88} />
          <Text size={20} weight="700" style={{ textAlign: "center" }}>{g.name}</Text>
          <Text size={13} muted>{`${t.grpTag} · ${t.grpMembersCount(g.members.length)}`}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {action("person-plus", t.grpAdd, () => {
            haptic.pick();
            router.push({ pathname: "/messages/create-group", params: { group: id, from } });
          }, admin && g.members.length < 12)}
          {action(g.muted ? "volume" : "volume-off", g.muted ? t.grpUnmute : t.grpMute, toggleMute)}
          {action("edit", t.grpEdit, () => {
            haptic.pick();
            setEdit(true);
          }, admin)}
        </View>
        <View style={{ gap: 2 }}>
          <Text size={12} weight="700" muted style={{ marginBottom: 4 }}>{`${t.grpMembersTitle} · ${t.grpMembersCount(g.members.length)}`}</Text>
          {g.members.map((m) => {
            const p = personIn(g, m.id);
            const mine = m.id === me;
            return (
              <Pressable
                key={m.id}
                onPress={() => {
                  if (mine) return;
                  haptic.pick();
                  setMember(m.id);
                }}
                /* 🆕 D-1453 — الضغطةُ المطوّلة تفتح الورقةَ والإصبعُ ما زال على الشاشة (فيديو أحمد ١٧ أكتوبر: «لازم أرفع إصبعي») */
                onLongPress={() => {
                  if (mine) return;
                  haptic.pick();
                  setMember(m.id);
                }}
                delayLongPress={350}
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: tokens.divider, opacity: pressed ? 0.7 : 1 })}
              >
                <Avatar uri={p?.hide_name ? null : p?.avatar_url ?? null} size={40} />
                <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Text size={14} weight="700" numberOfLines={1} style={{ flexShrink: 1 }}>{mine ? t.grpYou : displayNameOf(p, t.anonymousUser)}</Text>
                  {p && !p.hide_name ? <IdentityBadges flags={identityFlags(p)} nameSize={14} /> : null}
                </View>
                {/* 🆕 D-1453 — «المؤسس» · «مؤسس شريك» · «مشرف» */}
                {rankIn(m.id) !== "member" ? (
                  <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: tokens.surface2 }}>
                    <Text size={11} weight="700" color={tokens.accent}>{rankIn(m.id) === "owner" ? t.grpOwner : rankIn(m.id) === "co_owner" ? t.grpCoOwner : t.grpAdmin}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
        <Pressable
          onPress={() => {
            haptic.pick();
            setConfirmLeave(true);
          }}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingHorizontal: 14, borderRadius: 14, backgroundColor: tokens.surface, opacity: pressed ? 0.7 : 1 })}
        >
          <Icon name="close" size={18} color={tokens.error} />
          <Text size={15} weight="700" color={tokens.error}>{t.grpLeave}</Text>
        </Pressable>
      </ScrollView>

      {member ? (
        <Sheet title={displayNameOf(picked, t.anonymousUser)} onClose={() => setMember(null)}>
          {picked && !picked.hide_name && picked.username ? (
            <Pressable
              onPress={() => {
                setMember(null);
                openProfile(router, picked.username!, from);
              }}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 }}
            >
              <Icon name="people" size={18} color={tokens.accent} />
              <Text size={15}>{t.viewProfileOf(displayNameOf(picked, t.anonymousUser))}</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => {
              const peer = member;
              setMember(null);
              router.push({ pathname: "/messages/[peer]", params: { peer, from } });
            }}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 }}
          >
            <Icon name="mail" size={18} color={tokens.accent} />
            <Text size={15}>{t.grpStartChat}</Text>
          </Pressable>
          {/* 🆕 D-1453 — ما تسمح به رتبتي على رتبته وحدَه (مرآةُ القاعدة: `rolesFor` · `canRemove`) */}
          {rolesFor(myRank, rankIn(member)).length || canRemove(myRank, rankIn(member)) ? (
            <View style={{ height: 1, backgroundColor: tokens.divider, marginVertical: 4 }} />
          ) : null}
          {rolesFor(myRank, rankIn(member))
            .filter((r): r is "co_owner" | "admin" => r === "co_owner" || r === "admin")
            .map((r) => (
              <Pressable key={r} onPress={() => setRole(member, r)} style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 }}>
                <Icon name="shield" size={18} color={tokens.accent} />
                <Text size={15}>{r === "co_owner" ? t.grpMakeCoOwner : t.grpMakeAdmin}</Text>
              </Pressable>
            ))}
          {rolesFor(myRank, rankIn(member)).includes("member") ? (
            <Pressable onPress={() => setRole(member, "member")} style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 }}>
              <Icon name="shield" size={18} color={tokens.muted} />
              <Text size={15}>{rankIn(member) === "co_owner" ? t.grpUnCoOwner : t.grpUnAdmin}</Text>
            </Pressable>
          ) : null}
          {canRemove(myRank, rankIn(member)) ? (
            <Pressable
              onPress={() => {
                const uid = member;
                setMember(null);
                setConfirmRemove(uid);
              }}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 }}
            >
              <Icon name="trash" size={18} color={tokens.error} />
              <Text size={15} color={tokens.error}>{t.grpRemove}</Text>
            </Pressable>
          ) : null}
        </Sheet>
      ) : null}

      {confirmRemove ? (
        <Sheet title={t.grpRemove} onClose={() => setConfirmRemove(null)} placement="center">
          <Text size={13} muted style={{ lineHeight: 20, marginBottom: 16 }}>{t.grpRemoveConfirm(displayNameOf(personIn(g, confirmRemove), t.anonymousUser))}</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button label={t.cancelLabel} variant="ghost" onPress={() => setConfirmRemove(null)} />
            <View style={{ flex: 1 }}>
              <Button label={t.grpRemoveAction} variant="danger" onPress={() => remove(confirmRemove)} />
            </View>
          </View>
        </Sheet>
      ) : null}

      {confirmLeave ? (
        <Sheet title={t.grpLeave} onClose={() => setConfirmLeave(false)} placement="center">
          <Text size={13} muted style={{ lineHeight: 20, marginBottom: 16 }}>{t.grpLeaveConfirm}</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button label={t.cancelLabel} variant="ghost" onPress={() => setConfirmLeave(false)} />
            <View style={{ flex: 1 }}>
              <Button label={t.grpLeave} variant="danger" onPress={leave} />
            </View>
          </View>
        </Sheet>
      ) : null}

      {edit ? <EditSheet id={id} name={g.name} hasPhoto={!!g.photo} onClose={() => setEdit(false)} say={say} /> : null}

      {busy ? (
        <View pointerEvents="auto" style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={tokens.accent} />
        </View>
      ) : null}
      <ToastHost hostRef={toastHost} bottom={insets.bottom + 24} />
    </View>
  );
}

/** تعديلُ الاسم والصورة — المشرفُ وحدَه */
function EditSheet({ id, name, hasPhoto, onClose, say }: { id: string; name: string; hasPhoto: boolean; onClose: () => void; say: (m: string) => void }) {
  const { t, tokens } = useApp();
  const [value, setValue] = useState(name);
  const [clear, setClear] = useState(false);
  const { pic, setPic, pickImage, cropUi } = usePicUpload(say, { crop: "circle" });
  const [busy, setBusy] = useState(false);
  const clean = value.replace(/\s+/g, " ").trim();
  const changed = (clean && clean !== name) || !!pic?.path || clear;
  const save = () => {
    if (!changed || busy || (pic && !pic.path)) return;
    setBusy(true);
    const body: GroupManageBody = { action: "edit", name: clean && clean !== name ? clean : null, photo_path: pic?.path ?? null, clear_photo: clear && !pic };
    write(`/api/v1/me/groups/${id}/manage`, body)
      .then(() => {
        haptic.success();
        void queryClient.invalidateQueries({ queryKey: MESSAGES_KEY });
        onClose();
      })
      .catch((e: unknown) => say(errorText(t, e)))
      .finally(() => setBusy(false));
  };
  return (
    <Sheet title={t.grpEdit} onClose={onClose}>
      <View style={{ gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, overflow: "hidden", backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
            {pic ? <Image source={{ uri: pic.local }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : <Icon name="image" size={22} color={tokens.muted} />}
            {pic && !pic.path ? (
              <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.35)" }}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : null}
          </View>
          <Pressable
            onPress={() => {
              setClear(false);
              void pickImage();
            }}
            hitSlop={6}
          >
            <Text size={14} weight="700" color={tokens.accent}>{hasPhoto || pic ? t.grpPhotoChange : t.grpPhotoAdd}</Text>
          </Pressable>
          {(hasPhoto && !clear) || pic ? (
            <Pressable
              onPress={() => {
                setPic(null);
                setClear(hasPhoto);
              }}
              hitSlop={6}
            >
              <Text size={14} weight="700" color={tokens.error}>{t.grpPhotoRemove}</Text>
            </Pressable>
          ) : null}
        </View>
        <TextInput
          maxFontSizeMultiplier={SYSTEM_FONT_CAP}
          value={value}
          onChangeText={(v) => setValue(v.slice(0, GROUP_NAME_MAX))}
          maxLength={GROUP_NAME_MAX}
          placeholder={t.grpNamePlaceholder}
          placeholderTextColor={tokens.muted}
          style={{ height: 46, borderRadius: radius.md, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface2, paddingHorizontal: 14, fontSize: 15, color: tokens.fg, textAlign: I18nManager.isRTL ? "right" : "left" }}
        />
        <Button label={t.grpSave} busy={busy} disabled={!changed || (!!pic && !pic.path)} onPress={save} />
      </View>
      {cropUi}
    </Sheet>
  );
}
