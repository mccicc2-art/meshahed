import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, FlatList, I18nManager, Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, write } from "../api";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Icon, type IconName } from "../icons";
import { haptic } from "../haptics";
import { TabSlide } from "../TabSlide";
import { usePullRefresh } from "../pullRefresh";
import { useBootRoot } from "../bootRoot";
import { afterPaint, span } from "../perfMarks";
import { IdentityBadges, identityFlags } from "../IdentityBadges";
import { Avatar } from "../community/CommunityCards";
import { errorText } from "../community/communityActs";
import { ToastHost, type ToastHostRef } from "../HoldHost";
import { StartConversationSheet } from "./SendSheets";
import { MESSAGES_KEY } from "./live";
import { dropBadges, useDoors, useMessages, type Origin } from "./common";
import { num, type Dict } from "@/core/i18n";
import { formatDateShort, timeAgo } from "@/core/when";
import { displayNameOf } from "@/core/people";
import { signalHref, signalParts } from "@/core/signals";
import { curatedName } from "@/core/universes";
import type { MessagesPayload, MsgConversation, MsgEvent, SignalRow, SignalsPayload } from "../contracts";
import type { PersonLite } from "@/core/people";

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
  const [startWith, setStartWith] = useState<PersonLite | null>(null);
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
            <InboxPane d={d} error={q.isError} onRetry={() => void q.refetch()} onOpen={openConv} onStart={setStartWith} />
          ) : (
            <AlertsPane live={active} onOpen={doors.openPath} />
          )
        }
      />

      {/* 🆕 M5 — «ابدأ محادثة» ورقةٌ أصليّة (كانت بابَ `/messages?start=`): عملٌ يُختار ثمّ يُرسَل ثمّ الخيطُ الجديد */}
      {startWith ? (
        <StartConversationSheet
          person={startWith}
          onClose={() => setStartWith(null)}
          onSent={() => {
            const peer = startWith.id;
            setStartWith(null);
            router.push({ pathname: "/messages/[peer]", params: { peer, from } });
          }}
          onError={(e) => toastHost.current?.say(errorText(t, e))}
        />
      ) : null}
      <ToastHost hostRef={toastHost} bottom={insets.bottom + 24} />
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
  if (last.kind === "reply") return `${mine}${last.body}`;
  if (last.kind === "list") return `${mine}${t.convSharedListPreview(last.list_name ?? "—")}`;
  return `${mine}${t.convSharedPreview(last.title ?? "—")}`;
}

type InboxItem = { type: "conv"; c: MsgConversation } | { type: "head" } | { type: "start"; p: PersonLite };

function InboxPane({
  d,
  error,
  onRetry,
  onOpen,
  onStart,
}: {
  d: MessagesPayload | null;
  error: boolean;
  onRetry: () => void;
  onOpen: (peer: string) => void;
  onStart: (p: PersonLite) => void;
}) {
  const { t, tokens } = useApp();
  const refresh = usePullRefresh([MESSAGES_KEY], 0);
  const { switchTo } = useBootRoot();
  const items = useMemo<InboxItem[]>(() => {
    if (!d) return [];
    const out: InboxItem[] = d.conversations.map((c) => ({ type: "conv", c }));
    if (d.startable.length) {
      out.push({ type: "head" });
      for (const p of d.startable) out.push({ type: "start", p });
    }
    return out;
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
      keyExtractor={(it) => (it.type === "conv" ? `c:${it.c.person_id}` : it.type === "start" ? `s:${it.p.id}` : "head")}
      renderItem={({ item }) => {
        if (item.type === "head") {
          return <Text size={12} weight="700" muted style={{ marginTop: 20, marginBottom: 4, paddingHorizontal: 4 }}>{t.convStartSection}</Text>;
        }
        if (item.type === "start") return <StartRow p={item.p} onPress={() => onStart(item.p)} />;
        return <ConvRow c={item.c} onPress={() => onOpen(item.c.person_id)} />;
      }}
      ListEmptyComponent={
        /* الفراغُ الموجَّه (`FeedEmptyCta`، D-106): الرسائلُ تحتاج متابعةً متبادلة — فأوّلُ خطوةٍ إيجادُ الأصدقاء */
        <View style={{ marginTop: 16, paddingVertical: 36, paddingHorizontal: 20, borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: tokens.border, backgroundColor: tokens.surface, alignItems: "center", gap: 14 }}>
          <Text size={14} muted style={{ textAlign: "center", lineHeight: 21 }}>{t.inboxEmpty}</Text>
          <Button label={t.feedEmptyCta} size="sm" onPress={() => switchTo("/search")} />
        </View>
      }
      contentContainerStyle={{ paddingHorizontal: PAGE_PAD, paddingTop: 4, paddingBottom: 40 }}
      refreshControl={refresh}
      initialNumToRender={12}
      windowSize={9}
    />
  );
}

function ConvRow({ c, onPress }: { c: MsgConversation; onPress: () => void }) {
  const { t, tokens } = useApp();
  const name = displayNameOf(c.person, t.anonymousUser);
  const unread = c.unread > 0;
  return (
    <Pressable
      onPress={onPress}
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
          <Text size={12} muted>{c.last_at ? formatDateShort(c.last_at, t) : ""}</Text>
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

function StartRow({ p, onPress }: { p: PersonLite; onPress: () => void }) {
  const { t, tokens } = useApp();
  const name = displayNameOf(p, t.anonymousUser);
  return (
    <Pressable
      onPress={() => {
        haptic.pick();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={t.convStartRowAria(name)}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: tokens.divider, opacity: pressed ? 0.7 : 1 })}
    >
      <Avatar uri={p.hide_name ? null : p.avatar_url} size={44} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text size={14} weight="700" numberOfLines={1} style={{ flexShrink: 1 }}>{name}</Text>
          {p.hide_name ? null : <IdentityBadges flags={identityFlags(p)} nameSize={14} />}
        </View>
        <Text size={12} muted numberOfLines={1}>{t.convStartRowHint}</Text>
      </View>
      <View style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}>
        <Icon name="share" size={16} color={tokens.muted} />
      </View>
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
      renderItem={({ item }) => <SignalItem s={item} meId={d.me_id} onOpen={onOpen} />}
      ListEmptyComponent={<Text size={14} muted style={{ textAlign: "center", paddingVertical: 64, paddingHorizontal: 20, lineHeight: 21 }}>{t.notifEmpty}</Text>}
      contentContainerStyle={{ paddingHorizontal: PAGE_PAD, paddingBottom: 40 }}
      refreshControl={refresh}
      initialNumToRender={14}
      windowSize={9}
    />
  );
}

function SignalItem({ s, meId, onOpen }: { s: SignalRow; meId: string; onOpen: (path: string) => void }) {
  const { t, tokens, locale } = useApp();
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
        {/* الشارةُ بجانب الاسم داخل الجملة (D-775) — عقدةٌ في السطر تسبح مع النصّ */}
        <Text size={14} style={{ lineHeight: 20 }}>
          {p.pre}
          <Text size={14} weight="700">{p.who}</Text>
          {s.person.hide_name ? null : (
            <>
              {" "}
              <IdentityBadges flags={identityFlags(s.person)} nameSize={14} />
            </>
          )}
          {p.post}
        </Text>
        <Text size={12} muted>{timeAgo(s.at, t)}</Text>
      </View>
      {/* النقطةُ تقول «وصل بعد آخر فتحة» — لا لونٌ يغرق السطر */}
      {s.isNew ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.accent }} /> : null}
    </Pressable>
  );
}
