import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, FlatList, I18nManager, Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, queryClient, write } from "../api";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Icon, type IconName } from "../icons";
import { radius } from "../theme";
import { haptic } from "../haptics";
import { TabSlide } from "../TabSlide";
import { usePullRefresh } from "../pullRefresh";
import { afterPaint, span } from "../perfMarks";
import { IdentityBadges, identityFlags } from "../IdentityBadges";
import { Avatar } from "../community/CommunityCards";
import { FloatButton } from "../FloatButton";
import { ToastHost, type ToastHostRef } from "../HoldHost";
import { MESSAGES_KEY } from "./live";
import { dropBadges, patchKeep, useDoors, useMessages, type Origin } from "./common";
import { num, type Dict } from "@/core/i18n";
import { timeAgo } from "@/core/when";
import { listStampOf } from "./chatFormat";
import { displayNameOf } from "@/core/people";
import { signalHref, signalParts } from "@/core/signals";
import { curatedName } from "@/core/universes";
import type { MessagesPayload, MsgConversation, MsgEvent, MsgGroupConversation, SignalRow, SignalsPayload } from "../contracts";
import { GroupAvatar, dropGroup, groupPreview } from "./groups";
import { Sheet } from "../library/Sheet";

/**
 * ====== «الرسائل» أصليّةً — سطحٌ واحدٌ بتبويبين · Phase 11-M · M4 (خطّة §٣) ======
 *
 * 🔑 **الصفحةُ `/messages` نفسُها** (D-463): «الرسائل» و«الإشعارات» تبويبان بشارتَيهما — لكلِّ نوعٍ شارتُه فما زال «٣»
 * تقول أيَّ ثلاثة (D-187). **والعنوانُ المكتوبُ ساقطٌ كما في الويب** (D-044): التبويبُ المضيءُ يقول أين أنت.
 * **شاشةٌ مدفوعةٌ فوق الجذور لا تبويب** (خطّة §٥) — والرجوعُ إلى من فتحها. الانزلاقُ `TabSlide` نفسُه.
 *
 * 🔑 **الصندوق**: محادثةٌ واحدةٌ لكلِّ شخص (D-066) والضغطُ يدفع خيطَها (`/messages/[peer]`) · «ابدأ محادثة» ظاهرٌ دائماً
 * (D-165) وورقتُه أصليّةٌ منذ M5 (`StartConversationSheet`) · **الإشعارات** تُجلب حين يُفتح تبويبُها وحدَه (D-125) وتُختم «رأيتُها» عند
 * العرض (D-463)، والجملةُ والوجهةُ من `core/signals.ts` الذي يرسم منه الويب.
 */
type Tab = "inbox" | "alerts";
const ORDER: readonly Tab[] = ["inbox", "alerts"];
const PAGE_PAD = 16;
export const SIGNALS_KEY = ["me:signals"] as const;

export function MessagesScreen({ initialTab, from }: { initialTab: Tab; from: Origin }) {
  const { t, tokens } = useApp();
  const router = useRouter();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const q = useMessages();
  const d = q.data ?? null;
  const doors = useDoors(from);

  const [tab, setTab] = useState<Tab>(initialTab);
  const toastHost = useRef<ToastHostRef>(null);
  const [lit, setLit] = useState<Tab>(initialTab);
  const goTab = useCallback((k: Tab) => {
    setTab(k);
    setLit(k);
  }, []);

  /* `messages.open`: من التركيب إلى أوّل رسمٍ فيه حمولة (نهجُ `community.open`) */
  const [endOpen] = useState(() => span("messages.open", { cached: qc.getQueryData(MESSAGES_KEY) ? 1 : 0, tab: initialTab }));
  const opened = useRef(false);
  useEffect(() => {
    if (!d || opened.current) return;
    opened.current = true;
    afterPaint(() => endOpen());
  }, [d, endOpen]);

  const back = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/web");
  }, [router]);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      back();
      return true;
    });
    return () => sub.remove();
  }, [back]);

  const openConv = useCallback(
    (peer: string) => {
      haptic.pick();
      router.push({ pathname: "/messages/[peer]", params: { peer, from } });
    },
    [router, from],
  );
  /* 🆕 القروبات (الهجرة ٢٠٥) */
  const openGroup = useCallback(
    (id: string) => {
      haptic.pick();
      router.push({ pathname: "/messages/group/[id]", params: { id, from } });
    },
    [router, from],
  );
  /* 🆕 «✎ محادثة جديدة» (الصورُ المعتمدة ١٥ أكتوبر): «إنشاء قروب» أوّلاً ثمّ من تتابعهم — بدل قسم «ابدأ محادثة» */
  const newChat = useCallback(() => {
    haptic.pick();
    router.push({ pathname: "/messages/new", params: { from } });
  }, [router, from]);

  const tabItem = (k: Tab, icon: IconName, label: string, badge: number, aria: string) => {
    const on = k === lit;
    return (
      <Pressable
        key={k}
        onPress={() => goTab(k)}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        accessibilityLabel={badge > 0 ? `${label} · ${aria}` : label}
        style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 52, borderBottomWidth: 2, borderBottomColor: on ? tokens.accent : "transparent" }}
      >
        <Icon name={icon} size={16} color={on ? tokens.fg : tokens.muted} />
        <Text size={14} weight={on ? "700" : "600"} color={on ? tokens.fg : tokens.muted}>{label}</Text>
        {badge > 0 ? <Badge n={badge} /> : null}
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg }}>
      <View style={{ paddingTop: insets.top, borderBottomWidth: 1, borderBottomColor: tokens.border, backgroundColor: tokens.bg }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8, gap: 4 }}>
          <Pressable onPress={back} hitSlop={8} accessibilityRole="button" accessibilityLabel={t.backAria} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
            <View style={{ transform: [{ rotate: I18nManager.isRTL ? "-90deg" : "90deg" }] }}>
              <Icon name="chevron-down" size={22} color={tokens.fg} />
            </View>
          </Pressable>
          {tabItem("inbox", "mail", t.communityTabInbox, d?.unread.messages ?? 0, t.messagesUnreadAria(d?.unread.messages ?? 0))}
          {tabItem("alerts", "bell", t.notifTitle, d?.unread.signals ?? 0, t.notifUnreadAria(d?.unread.signals ?? 0))}
          <View style={{ width: 40 }} />
        </View>
      </View>

      <TabSlide
        order={ORDER}
        tab={tab}
        onTab={goTab}
        onAim={setLit}
        perfScreen="messages"
        render={(k, active) =>
          k === "inbox" ? (
            /* 🆕 D-1380 — «ابدأ محادثة» يفتح الخيطَ نفسَه بخانة كتابة (كان ورقةَ اختيار عمل — D-051 المنقوضة) */
            <InboxPane d={d} error={q.isError} onRetry={() => void q.refetch()} onOpen={openConv} onOpenGroup={openGroup} onNewChat={newChat} />
          ) : (
            <AlertsPane live={active} onOpen={doors.openPath} />
          )
        }
      />

      {tab === "inbox" && d ? (
        /* الزرُّ العائمُ الواحد (`FloatButton`) — أخوه في «المجتمع» قلمٌ بلا كلمة */
        <FloatButton icon="edit" label={t.msgNewChat} onPress={newChat} style={{ bottom: insets.bottom + 20 }} />
      ) : null}
      <ToastHost hostRef={toastHost} bottom={insets.bottom + 84} />
      {doors.leaving ? (
        <View pointerEvents="auto" style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={tokens.accent} />
        </View>
      ) : null}
    </View>
  );
}

/** شارةُ العدد — حبّةُ الشارة نفسُها في صفِّ المحادثة وعلى التبويب */
function Badge({ n }: { n: number }) {
  const { tokens, locale } = useApp();
  return (
    <View style={{ minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: tokens.accent, alignItems: "center", justifyContent: "center" }}>
      <Text size={11} weight="700" color={tokens.onAccent} style={{ fontVariant: ["tabular-nums"], writingDirection: "ltr" }}>{num(n, locale)}</Text>
    </View>
  );
}

/** سطرُ المعاينة — آخرُ حدثٍ في المحادثة (`previewOf` في `Inbox`) */
export function previewOf(last: MsgEvent | undefined, t: Dict): string {
  if (!last) return "";
  const mine = last.mine ? `${t.convYou}: ` : "";
  /* 🆕 D-1387 — «GIF» أو «📷 صورة» (وتعليقُها إن وُجد) */
  /* 🆕 D-1441 — المحذوفةُ للجميع سطرُها «حُذفت» */
  if (last.kind === "reply" && last.deleted) return last.mine ? t.msgDeletedMine : t.msgDeleted;
  if (last.kind === "reply") return `${mine}${last.gif_id ? t.msgGifPreview : last.image ? (last.body ? `${t.msgImagePreview} · ${last.body}` : t.msgImagePreview) : last.body}`;
  if (last.kind === "list") return `${mine}${t.convSharedListPreview(last.list_name ?? "—")}`;
  return `${mine}${t.convSharedPreview(last.title ?? "—")}`;
}

type InboxItem = { type: "conv"; c: MsgConversation; at: string } | { type: "group"; g: MsgGroupConversation; at: string };

function InboxPane({
  d,
  error,
  onRetry,
  onOpen,
  onOpenGroup,
  onNewChat,
}: {
  d: MessagesPayload | null;
  error: boolean;
  onRetry: () => void;
  onOpen: (peer: string) => void;
  onOpenGroup: (id: string) => void;
  onNewChat: () => void;
}) {
  const { t, tokens } = useApp();
  const refresh = usePullRefresh([MESSAGES_KEY], 0);
  /* 🆕 D-1441 — ضغطةٌ طويلةٌ على الصفّ («٣ أ»): المحادثةُ تُحذف من عندي وحدي (`hide`)، والقروبُ يُغادَر — بتأكيدٍ وسطيّ */
  const [held, setHeld] = useState<InboxItem | null>(null);
  const dropHeld = useCallback(() => {
    const it = held;
    setHeld(null);
    if (!it) return;
    haptic.pick();
    const fail = () => void queryClient.invalidateQueries({ queryKey: MESSAGES_KEY });
    if (it.type === "conv") {
      const peer = it.c.person_id;
      patchKeep<MessagesPayload>(MESSAGES_KEY, (p) => ({ ...p, conversations: p.conversations.filter((c) => c.person_id !== peer) }));
      write("/api/v1/me/messages/hide", { person_id: peer }).catch(fail);
    } else {
      const id = it.g.group_id;
      dropGroup(id);
      write(`/api/v1/me/groups/${id}/manage`, { action: "leave" }).catch(fail);
    }
  }, [held]);
  /* 🆕 المحادثاتُ والقروباتُ قائمةٌ واحدةٌ بالأحدث (الصورةُ المعتمدة)؛ و«ابدأ محادثة» انتقل إلى «محادثة جديدة» */
  const items = useMemo<InboxItem[]>(() => {
    if (!d) return [];
    const out: InboxItem[] = [
      ...d.conversations.map((c) => ({ type: "conv" as const, c, at: c.last_at })),
      ...(d.groups ?? []).map((g) => ({ type: "group" as const, g, at: g.last_at })),
    ];
    return out.sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
  }, [d]);

  if (!d) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 }}>
        {error ? (
          <>
            <Text muted style={{ textAlign: "center" }}>{t.apiInternal}</Text>
            <Button label={t.errorRetry} onPress={onRetry} />
          </>
        ) : (
          <ActivityIndicator color={tokens.accent} />
        )}
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(it) => (it.type === "conv" ? `c:${it.c.person_id}` : `g:${it.g.group_id}`)}
      renderItem={({ item }) =>
        item.type === "group" ? (
          <GroupRow g={item.g} meId={d.me_id} onPress={() => onOpenGroup(item.g.group_id)} onLongPress={() => (haptic.pick(), setHeld(item))} />
        ) : (
          <ConvRow c={item.c} onPress={() => onOpen(item.c.person_id)} onLongPress={() => (haptic.pick(), setHeld(item))} />
        )
      }
      ListFooterComponent={
        held ? (
          <Sheet title={held.type === "conv" ? t.msgDeleteChat : t.grpLeave} onClose={() => setHeld(null)} placement="center">
            <Text size={13} muted style={{ lineHeight: 20, marginBottom: 16 }}>
              {held.type === "conv" ? t.msgDeleteChatHint(displayNameOf(held.c.person, t.anonymousUser)) : t.grpLeaveConfirm}
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button label={t.cancelLabel} variant="ghost" onPress={() => setHeld(null)} />
              <View style={{ flex: 1 }}>
                <Button label={held.type === "conv" ? t.msgDeleteChat : t.grpLeave} variant="danger" onPress={dropHeld} />
              </View>
            </View>
          </Sheet>
        ) : null
      }
      ListEmptyComponent={
        /* الفراغُ الموجَّه (`FeedEmptyCta`، D-106): أوّلُ خطوةٍ محادثةٌ جديدة */
        <View style={{ marginTop: 16, paddingVertical: 36, paddingHorizontal: 20, borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: tokens.border, backgroundColor: tokens.surface, alignItems: "center", gap: 14 }}>
          <Text size={14} muted style={{ textAlign: "center", lineHeight: 21 }}>{t.inboxEmpty}</Text>
          <Button label={t.msgNewChat} size="sm" onPress={onNewChat} />
        </View>
      }
      /* الزرُّ العائمُ «محادثة جديدة» فوق آخر صفّ — مسافةٌ تحته فلا يغطّيه */
      contentContainerStyle={{ paddingHorizontal: PAGE_PAD, paddingTop: 4, paddingBottom: 110 }}
      refreshControl={refresh}
      initialNumToRender={12}
      windowSize={9}
    />
  );
}

/** 🆕 صفُّ القروب: صورتُه أو صورُ أعضائه · الاسمُ ووسمُ «قروب» · «فلان: آخرُ سطر» · الوقتُ والشارة */
function GroupRow({ g, meId, onPress, onLongPress }: { g: MsgGroupConversation; meId: string; onPress: () => void; onLongPress?: () => void }) {
  const { t, tokens } = useApp();
  const unread = g.unread > 0;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityLabel={`${g.name} · ${t.grpTag}`}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: tokens.divider, opacity: pressed ? 0.7 : 1 })}
    >
      <GroupAvatar g={g} meId={meId} size={44} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text size={14} weight="700" numberOfLines={1} style={{ flexShrink: 1 }}>{g.name}</Text>
            <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.pill, backgroundColor: tokens.surface2 }}>
              <Text size={10} weight="700" muted>{t.grpTag}</Text>
            </View>
            {g.muted ? <Icon name="volume-off" size={12} color={tokens.muted} /> : null}
          </View>
          <Text size={12} muted>{g.last_at ? listStampOf(g.last_at, t) : ""}</Text>
        </View>
        <Text size={12} weight={unread ? "600" : "400"} color={unread ? tokens.fg : tokens.muted} numberOfLines={1} content>
          {groupPreview(g, meId, t)}
        </Text>
      </View>
      {unread ? (
        <View accessibilityLabel={t.communityUnreadAria(g.unread)}>
          <Badge n={g.unread} />
        </View>
      ) : null}
    </Pressable>
  );
}

function ConvRow({ c, onPress, onLongPress }: { c: MsgConversation; onPress: () => void; onLongPress?: () => void }) {
  const { t, tokens } = useApp();
  const name = displayNameOf(c.person, t.anonymousUser);
  const unread = c.unread > 0;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityLabel={t.convOpenAria(name)}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: tokens.divider, opacity: pressed ? 0.7 : 1 })}
    >
      <Avatar uri={c.person?.hide_name ? null : c.person?.avatar_url ?? null} size={44} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text size={14} weight="700" numberOfLines={1} style={{ flexShrink: 1 }}>{name}</Text>
            {c.person && !c.person.hide_name ? <IdentityBadges flags={identityFlags(c.person)} nameSize={14} /> : null}
          </View>
          <Text size={12} muted>{c.last_at ? listStampOf(c.last_at, t) : ""}</Text>
        </View>
        <Text size={12} weight={unread ? "600" : "400"} color={unread ? tokens.fg : tokens.muted} numberOfLines={1} content>
          {previewOf(c.events[c.events.length - 1], t)}
        </Text>
      </View>
      {unread ? (
        <View accessibilityLabel={t.communityUnreadAria(c.unread)}>
          <Badge n={c.unread} />
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * لوحُ الإشعارات — **يُجلب حين يُرسم** (التبويبُ المفتوح، أو الجارُ لحظةَ السحب — D-125 روحاً)، **ويُختم «رأيتُها» حين
 * يكون المفتوحَ وفيه جديد** (`MarkSignalsSeen`): مرّةً للّوح، والنقطةُ تبقى في هذه الزيارة ليُرى ما وصل.
 */
function AlertsPane({ live, onOpen }: { live: boolean; onOpen: (path: string) => void }) {
  const { t, tokens } = useApp();
  const q = useQuery({ queryKey: SIGNALS_KEY, queryFn: async () => (await api<SignalsPayload>("/api/v1/me/signals")).data, staleTime: 30_000 });
  const refresh = usePullRefresh([SIGNALS_KEY], 0);
  const d = q.data ?? null;
  const sealed = useRef(false);
  useEffect(() => {
    if (!live || !d || sealed.current || !d.rows.some((r) => r.isNew)) return;
    sealed.current = true;
    dropBadges({ signals: true });
    /* الختمُ ليس حَمْلَ اللوح: فشلُه يُبقي الشارةَ للجلب التالي ولا يمنع القراءة */
    void write("/api/v1/me/signals/seen", {}).catch(() => {});
  }, [live, d]);

  if (!d) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 }}>
        {q.isError ? (
          <>
            <Text muted style={{ textAlign: "center" }}>{t.apiInternal}</Text>
            <Button label={t.errorRetry} onPress={() => void q.refetch()} />
          </>
        ) : (
          <ActivityIndicator color={tokens.accent} />
        )}
      </View>
    );
  }
  return (
    <FlatList
      data={d.rows}
      keyExtractor={(s, i) => `${s.kind}-${s.person.id}-${s.at}-${i}`}
      renderItem={({ item }) => <SignalItem s={item} meId={d.me_id} onOpen={onOpen} pending={item.kind === "request" && (d.pending_requests ?? []).includes(item.person.id)} />}
      ListEmptyComponent={<Text size={14} muted style={{ textAlign: "center", paddingVertical: 64, paddingHorizontal: 20, lineHeight: 21 }}>{t.notifEmpty}</Text>}
      contentContainerStyle={{ paddingHorizontal: PAGE_PAD, paddingBottom: 40 }}
      refreshControl={refresh}
      initialNumToRender={14}
      windowSize={9}
    />
  );
}

function SignalItem({ s, meId, onOpen, pending }: { s: SignalRow; meId: string; onOpen: (path: string) => void; pending: boolean }) {
  const { t, tokens, locale } = useApp();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<"accept" | "reject" | null>(null);
  /**
   * 🆕 N2-fix — **قبولُ طلب المتابعة ورفضُه من الإشعار نفسِه** (أحمد ٢٩ سبتمبر: «جاني طلب إضافة لأني مقفل.. الإشعار وصل بس يدخلني
   * عالحساب ليش ما يخليني أقبل؟»). الزرّان لطلبٍ قائمٍ وحدَه (`pending_requests`)، وبعد القرار يسقطان من الكاش فوراً.
   */
  const decide = (accept: boolean) => {
    if (busy) return;
    haptic.pick();
    setBusy(accept ? "accept" : "reject");
    write<{ done: true }>("/api/v1/me/follow-requests", { person_id: s.person.id, accept })
      .then(() => {
        qc.setQueryData<SignalsPayload>(SIGNALS_KEY, (x) => (x ? { ...x, pending_requests: (x.pending_requests ?? []).filter((id) => id !== s.person.id) } : x));
        void qc.invalidateQueries({ queryKey: [`profile:${(s.person.username ?? s.person.id).toLowerCase()}`] });
      })
      .catch(() => {})
      .finally(() => setBusy(null));
  };
  const listName = curatedName(s.listSlug, s.title ?? "", locale === "en" ? "en" : "ar");
  const p = signalParts(s, t, listName);
  const href = signalHref(s, meId);
  return (
    <Pressable
      disabled={!href}
      onPress={() => href && onOpen(href)}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: tokens.divider, opacity: pressed ? 0.7 : 1 })}
    >
      <Avatar uri={s.person.hide_name ? null : s.person.avatar_url} size={40} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        {/* الشارةُ بجانب الاسم داخل الجملة (D-775) — عقدةٌ في السطر تسبح مع النصّ.
            🆕 D-1454 — **ختمُ التوثيق وحدَه** (لا حبّةَ PARTNER/PLUS في التنبيهات)، **والاسمُ وختمُه معزولان** (FSI…PDI):
            اسمٌ لاتينيٌّ في جملةٍ عربيّة كان يرتّبه iOS بعد أن يضع العقدةَ، فتقع الشارةُ فوق الاسم (لقطةُ أحمد). */}
        <Text size={14} style={{ lineHeight: 20 }}>
          {p.pre}
          {"\u2068"}
          <Text size={14} weight="700">{p.who}</Text>
          {s.person.hide_name || !identityFlags(s.person).verified ? null : (
            <>
              {" "}
              <IdentityBadges flags={identityFlags(s.person)} nameSize={14} sealOnly />
            </>
          )}
          {"\u2069"}
          {p.post}
        </Text>
        <Text size={12} muted>{timeAgo(s.at, t)}</Text>
      </View>
      {/* النقطةُ تقول «وصل بعد آخر فتحة» — لا لونٌ يغرق السطر */}
      {pending ? (
        <View style={{ flexDirection: "row", gap: 6 }}>
          <Button size="sm" label={t.requestAccept} busy={busy === "accept"} onPress={() => decide(true)} />
          <Button size="sm" variant="ghost" label={t.requestReject} busy={busy === "reject"} onPress={() => decide(false)} />
        </View>
      ) : s.isNew ? (
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.accent }} />
      ) : null}
    </Pressable>
  );
}
