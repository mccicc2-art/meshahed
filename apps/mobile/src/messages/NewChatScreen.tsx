import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, FlatList, I18nManager, Keyboard, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api, queryClient, write } from "../api";
import { useApp } from "../state";
import { Button, Text, type ToastTone } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import { haptic } from "../haptics";
import { ToastHost, type ToastHostRef } from "../HoldHost";
import { IdentityBadges, identityFlags } from "../IdentityBadges";
import { Avatar } from "../community/CommunityCards";
import { errorText } from "../community/communityActs";
import { SYSTEM_FONT_CAP } from "../fontScale";
import { MESSAGES_KEY } from "./live";
import { useDoors, useMessages, type Origin } from "./common";
import { usePicUpload } from "./chatDock";
import { displayNameOf, type PersonLite } from "@/core/people";
import { GROUP_MAX_MEMBERS, GROUP_NAME_MAX } from "@/core/contracts/groups";
import type { FollowsPayload, GroupCreateBody, GroupCreatePayload, GroupManageBody } from "../contracts";

/**
 * ====== «محادثة جديدة» · «إنشاء قروب» · «إضافة أعضاء» — صفحةٌ واحدةٌ بثلاث حالات (الصورُ المعتمدة ١٥ أكتوبر) ======
 *
 * - **محادثة جديدة** (`mode="new"`): «إنشاء قروب» أوّلُ صفّ، ثمّ البحث، ثمّ من تتابعهم — لمستُه تفتح المحادثةَ معه
 *   (القائمةُ إن كانت بينكما، وإلّا خيطاً جديداً بخانة كتابة).
 * - **إنشاء قروب** (`mode="create"`): الأعضاءُ ممّن تتابعهم برقائق ✕ وعدّاد (١١ معك)، ثمّ الاسمُ والصورةُ الاختياريّة.
 *   لغير مشترك لوبز+ يفتح «إنشاء قروب» صفحةَ لوبز+ (`can_create_group`) — والقاعدةُ تحكم أيضاً.
 * - **إضافة أعضاء** (`mode="add"`): من صفحة معلومات القروب، للمشرف — من ليس فيه بعد، حتى يكتمل ١٢.
 */
type Mode = "new" | "create" | "add";
type Person = FollowsPayload["people"][number];

export function NewChatScreen({ mode, groupId, from }: { mode: Mode; groupId?: string; from: Origin }) {
  const { t, tokens } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const doors = useDoors(from);
  const msgs = useMessages();
  const d = msgs.data ?? null;
  const group = mode === "add" ? d?.groups?.find((g) => g.group_id === groupId) ?? null : null;
  const toastHost = useRef<ToastHostRef>(null);
  const say = useCallback((text: string, tone?: ToastTone) => toastHost.current?.say(text, undefined, undefined, tone), []);

  const following = useQuery({
    queryKey: ["me:follows", "following", "me"],
    queryFn: async () => (await api<FollowsPayload>("/api/v1/me/follows?dir=following")).data.people,
    staleTime: 60_000,
  });
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Person[]>([]);
  const [step, setStep] = useState<"pick" | "name">("pick");
  const [name, setName] = useState("");
  /* 🆕 صورةُ القروب تمرّ بشاشة القصّ (تكبير · تحريك · لفّ) */
  const { pic, setPic, pickImage, cropUi } = usePicUpload(say, { crop: "circle" });
  const [busy, setBusy] = useState(false);

  const inGroup = useMemo(() => new Set(group?.members.map((m) => m.id) ?? []), [group]);
  const room = mode === "add" ? Math.max(0, GROUP_MAX_MEMBERS - (group?.members.length ?? 0)) : GROUP_MAX_MEMBERS - 1;
  const withChat = useMemo(() => new Set(d?.conversations.map((c) => c.person_id) ?? []), [d]);

  const people = useMemo(() => {
    const all = (following.data ?? []).filter((p) => !inGroup.has(p.id));
    const k = query.trim().toLowerCase();
    if (!k) return all;
    return all.filter((p) => `${p.nickname ?? ""} ${p.username ?? ""}`.toLowerCase().includes(k));
  }, [following.data, inGroup, query]);

  const back = useCallback(() => {
    Keyboard.dismiss();
    if (mode === "create" && step === "name") return setStep("pick");
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: "/messages", params: { from } });
  }, [router, from, mode, step]);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      back();
      return true;
    });
    return () => sub.remove();
  }, [back]);

  const togglePick = (p: Person) => {
    haptic.pick();
    setPicked((cur) => {
      if (cur.some((x) => x.id === p.id)) return cur.filter((x) => x.id !== p.id);
      if (cur.length >= room) {
        say(t.apiGroupFull);
        return cur;
      }
      return [...cur, p];
    });
  };

  const openGroupCreate = () => {
    haptic.pick();
    if (d && d.can_create_group === false) {
      say(t.grpPlusOnly);
      doors.openWeb("/plus");
      return;
    }
    router.push({ pathname: "/messages/create-group", params: { from } });
  };

  const create = () => {
    const clean = name.replace(/\s+/g, " ").trim();
    if (!clean || !picked.length || busy || (pic && !pic.path)) return;
    setBusy(true);
    const body: GroupCreateBody = { name: clean, member_ids: picked.map((p) => p.id), ...(pic?.path ? { photo_path: pic.path } : {}) };
    write<GroupCreatePayload>("/api/v1/me/groups", body)
      .then(async (r) => {
        haptic.success();
        await queryClient.invalidateQueries({ queryKey: MESSAGES_KEY });
        router.replace({ pathname: "/messages/group/[id]", params: { id: r.group_id, from } });
      })
      .catch((e: unknown) => say(errorText(t, e)))
      .finally(() => setBusy(false));
  };

  const add = () => {
    if (!groupId || !picked.length || busy) return;
    setBusy(true);
    const body: GroupManageBody = { action: "add", member_ids: picked.map((p) => p.id) };
    write(`/api/v1/me/groups/${groupId}/manage`, body)
      .then(() => {
        haptic.success();
        void queryClient.invalidateQueries({ queryKey: MESSAGES_KEY });
        back();
      })
      .catch((e: unknown) => say(errorText(t, e)))
      .finally(() => setBusy(false));
  };

  const title = mode === "new" ? t.msgNewChat : mode === "add" ? t.grpPickTitle : step === "name" ? t.grpNameTitle : t.grpCreate;
  const nameOf = (p: PersonLite) => displayNameOf(p, t.anonymousUser);

  const header = (
    <View style={{ paddingTop: insets.top, borderBottomWidth: 1, borderBottomColor: tokens.border, backgroundColor: tokens.bg }}>
      <View style={{ height: 56, flexDirection: "row", alignItems: "center", paddingHorizontal: 8, gap: 4 }}>
        <Pressable onPress={back} hitSlop={8} accessibilityRole="button" accessibilityLabel={t.backAria} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
          <View style={{ transform: [{ rotate: I18nManager.isRTL ? "-90deg" : "90deg" }] }}>
            <Icon name="chevron-down" size={22} color={tokens.fg} />
          </View>
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text size={16} weight="700" numberOfLines={1}>{title}</Text>
          {mode !== "new" && step === "pick" ? <Text size={12} muted>{t.grpCount(picked.length, room)}</Text> : null}
        </View>
        {mode === "create" && step === "pick" ? (
          <Button size="sm" label={t.grpNext} disabled={!picked.length} onPress={() => { haptic.pick(); setStep("name"); }} />
        ) : mode === "create" ? (
          <Button size="sm" label={t.grpCreateBtn} busy={busy} disabled={!name.trim() || (!!pic && !pic.path)} onPress={create} />
        ) : mode === "add" ? (
          <Button size="sm" label={t.grpAdd} busy={busy} disabled={!picked.length} onPress={add} />
        ) : null}
      </View>
    </View>
  );

  /* الخطوةُ الثانية: الاسمُ والصورة */
  if (mode === "create" && step === "name") {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.bg }}>
        {header}
        <ScrollView contentContainerStyle={{ padding: 16, gap: 18 }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: "center", gap: 10 }}>
            <Pressable
              onPress={() => void pickImage()}
              accessibilityRole="button"
              accessibilityLabel={pic ? t.grpPhotoChange : t.grpPhotoAdd}
              style={{ width: 96, height: 96, borderRadius: 48, overflow: "hidden", backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}
            >
              {pic ? <Image source={{ uri: pic.local }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : <Icon name="image" size={28} color={tokens.muted} />}
              {pic && !pic.path ? (
                <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.35)" }}>
                  <ActivityIndicator color="#fff" />
                </View>
              ) : null}
            </Pressable>
            <View style={{ flexDirection: "row", gap: 14 }}>
              <Pressable onPress={() => void pickImage()} hitSlop={6}>
                <Text size={13} weight="700" color={tokens.accent}>{pic ? t.grpPhotoChange : t.grpPhotoAdd}</Text>
              </Pressable>
              {pic ? (
                <Pressable onPress={() => setPic(null)} hitSlop={6}>
                  <Text size={13} weight="700" color={tokens.error}>{t.grpPhotoRemove}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
          <View style={{ gap: 6 }}>
            <Text size={13} weight="700">{t.grpNameTitle}</Text>
            <TextInput
              maxFontSizeMultiplier={SYSTEM_FONT_CAP}
              value={name}
              onChangeText={(v) => setName(v.slice(0, GROUP_NAME_MAX))}
              maxLength={GROUP_NAME_MAX}
              placeholder={t.grpNamePlaceholder}
              placeholderTextColor={tokens.muted}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={create}
              style={{ height: 46, borderRadius: radius.md, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface2, paddingHorizontal: 14, fontSize: 15, color: tokens.fg, textAlign: I18nManager.isRTL ? "right" : "left" }}
            />
            <Text size={11} muted style={{ alignSelf: "flex-end", writingDirection: "ltr" }}>{`${name.length}/${GROUP_NAME_MAX}`}</Text>
          </View>
          <View style={{ gap: 8 }}>
            <Text size={13} weight="700">{`${t.grpMembersTitle} · ${t.grpMembersCount(picked.length + 1)}`}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {picked.map((p) => (
                <View key={p.id} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4, paddingStart: 4, paddingEnd: 10, borderRadius: radius.pill, backgroundColor: tokens.surface2 }}>
                  <Avatar uri={p.hide_name ? null : p.avatar_url} size={24} />
                  <Text size={13} numberOfLines={1}>{nameOf(p)}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
        {cropUi}
        <ToastHost hostRef={toastHost} bottom={insets.bottom + 24} />
      </View>
    );
  }

  const picking = mode !== "new";
  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg }}>
      {header}
      <FlatList
        data={people}
        keyExtractor={(p) => p.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: 12, paddingTop: 12, paddingBottom: 4 }}>
            {mode === "new" ? (
              <Pressable
                onPress={openGroupCreate}
                accessibilityRole="button"
                accessibilityLabel={t.grpCreate}
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, backgroundColor: tokens.surface, opacity: pressed ? 0.7 : 1 })}
              >
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: tokens.accent, alignItems: "center", justifyContent: "center" }}>
                  <Icon name="people" size={20} color={tokens.onAccent} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text size={15} weight="700">{t.grpCreate}</Text>
                  <Text size={12} muted numberOfLines={1}>{t.grpCreateSub}</Text>
                </View>
                {d && d.can_create_group === false ? (
                  <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: tokens.surface2 }}>
                    <Text size={11} weight="800" color={tokens.accent}>PLUS</Text>
                  </View>
                ) : (
                  <View style={{ transform: [{ rotate: I18nManager.isRTL ? "90deg" : "-90deg" }] }}>
                    <Icon name="chevron-down" size={18} color={tokens.muted} />
                  </View>
                )}
              </Pressable>
            ) : null}
            {picking && picked.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {picked.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => togglePick(p)}
                    accessibilityRole="button"
                    accessibilityLabel={`${nameOf(p)} ✕`}
                    style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4, paddingStart: 4, paddingEnd: 10, borderRadius: radius.pill, backgroundColor: tokens.surface2 }}
                  >
                    <Avatar uri={p.hide_name ? null : p.avatar_url} size={24} />
                    <Text size={13} numberOfLines={1} style={{ maxWidth: 120 }}>{nameOf(p)}</Text>
                    <Icon name="close" size={12} color={tokens.muted} />
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, height: 42, borderRadius: radius.pill, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface2, paddingHorizontal: 14 }}>
              <Icon name="search" size={16} color={tokens.muted} />
              <TextInput
                maxFontSizeMultiplier={SYSTEM_FONT_CAP}
                value={query}
                onChangeText={setQuery}
                placeholder={t.grpSearchFollowing}
                placeholderTextColor={tokens.muted}
                style={{ flex: 1, fontSize: 14, color: tokens.fg, textAlign: I18nManager.isRTL ? "right" : "left" }}
              />
            </View>
            <Text size={12} weight="700" muted style={{ paddingHorizontal: 4 }}>{t.grpFollowingTitle}</Text>
          </View>
        }
        renderItem={({ item: p }) => {
          const on = picked.some((x) => x.id === p.id);
          return (
            <Pressable
              onPress={() => {
                if (picking) return togglePick(p);
                haptic.pick();
                router.push({ pathname: "/messages/[peer]", params: { peer: p.id, from } });
              }}
              accessibilityRole={picking ? "checkbox" : "button"}
              accessibilityState={picking ? { checked: on } : undefined}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: tokens.divider, opacity: pressed ? 0.7 : 1 })}
            >
              <Avatar uri={p.hide_name ? null : p.avatar_url} size={44} />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Text size={14} weight="700" numberOfLines={1} style={{ flexShrink: 1 }}>{nameOf(p)}</Text>
                  {p.hide_name ? null : <IdentityBadges flags={identityFlags(p)} nameSize={14} />}
                </View>
                {picking ? null : <Text size={12} muted numberOfLines={1}>{withChat.has(p.id) ? t.grpHasChat : t.grpStartChat}</Text>}
              </View>
              {picking ? (
                <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: on ? tokens.accent : tokens.border, backgroundColor: on ? tokens.accent : "transparent", alignItems: "center", justifyContent: "center" }}>
                  {on ? <Icon name="check" size={13} color={tokens.onAccent} /> : null}
                </View>
              ) : (
                <Icon name="mail" size={16} color={tokens.muted} />
              )}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          following.isLoading ? (
            <ActivityIndicator color={tokens.accent} style={{ marginTop: 32 }} />
          ) : (
            <Text size={13} muted style={{ textAlign: "center", paddingVertical: 32 }}>{following.isError ? t.apiInternal : t.grpNoFollowing}</Text>
          )
        }
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40 }}
      />
      {doors.leaving ? (
        <View pointerEvents="auto" style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={tokens.accent} />
        </View>
      ) : null}
      <ToastHost hostRef={toastHost} bottom={insets.bottom + 24} />
    </View>
  );
}
