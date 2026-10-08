import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, FlatList, I18nManager, Keyboard, Platform, Pressable, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api, queryClient, write } from "../api";
import { useApp } from "../state";
import { push } from "../push";
import { Button, Text, type ToastTone } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import { haptic } from "../haptics";
import { posterFor } from "../poster";
import { ToastHost, type ToastHostRef } from "../HoldHost";
import { IdentityBadges, identityFlags } from "../IdentityBadges";
import { Sheet } from "../library/Sheet";
import { Avatar } from "../community/CommunityCards";
import { errorText } from "../community/communityActs";
import { MESSAGES_KEY } from "./live";
import { dropBadges, patchConversation, presenceOf, useDoors, useMessages, type Origin } from "./common";
import { displayNameOf, profileHref } from "@/core/people";
import { timeAgo } from "@/core/when";
import { MSG_REPLY_MAX } from "@/core/contracts/messages";
import type { LastSeenPayload, MsgEvent, MsgPeerBody, MsgReplyBody } from "../contracts";

/**
 * ====== خيطُ المحادثة أصليّاً — كالدردشة · Phase 11-M · M4 (خطّة §٣) ======
 *
 * 🔑 **`ConversationView` الويب بأفعاله كلِّها**: الفقاعاتُ (عملٌ مُشارَك · قائمة · ردّ) مصطفّةً بجهة المرسِل · الترويسةُ كلُّها
 * بابُ الملفّ مع سطر الحضور (D-765/D-767) · ⋯ ورقةٌ فيها الملفُّ ثمّ الإخفاءُ ثمّ الحظر، الأخطرُ أخيراً (D-018) · الواردُ
 * يُعلَّم مقروءاً عند الفتح وكلّما وصل جديدٌ والخيطُ مفتوح · الردُّ معلَّقٌ بآخر عملٍ شورك (D-051)، ومحادثةٌ بدأت بقائمةٍ
 * وحدها لها سطرٌ يشرح الطريق بدل حقلٍ يفشل بصمت.
 *
 * ⚖️ **الحقلُ مثبَّتٌ أسفل الشاشة لا ورقةٌ وسطى** (خلافاً لـ`Composer`، D-1175): حجّةُ الورقة كانت حقلاً داخل قائمةٍ افتراضيّة
 * يُدوَّر وتغطّيه اللوحة — **وهنا الحقلُ خارج القائمة**، والدردشةُ تُكتب وأنت ترى آخرَ ما قيل. يمتدّ مع الكتابة حتى أربعة
 * أسطر ثمّ يمرّر داخله (D-765)، **ويرتفع فوق لوحة المفاتيح بقياس موضعه** (يعمل سواءٌ صغّر النظامُ النافذةَ أم لا).
 */
const PAGE_PAD = 16;

export function ConversationScreen({ peer, from }: { peer: string; from: Origin }) {
  const { t, tokens } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const q = useMessages();
  const d = q.data ?? null;
  const conv = d?.conversations.find((c) => c.person_id === peer) ?? null;
  const doors = useDoors(from);
  /* 🆕 D-1307 — **الشاشةُ في العين؟** يعلن الخيطَ المفتوح لـ`push` (لا شريطَ إشعارٍ فوق محادثةٍ أقرؤها) ويشغّل تجديدَ
     سطر الحضور. بالتركيز لا بالتركيب: شاشةٌ مدفونةٌ تحت أخرى ليست «مفتوحة»، وكتمُ رسائل صاحبها هناك يُضيّعها. */
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      push.setOpenPeer(peer);
      return () => {
        setFocused(false);
        push.setOpenPeer(null, peer);
      };
    }, [peer]),
  );
  /* 🆕 D-1307 (تسجيلُ خالد: «آخر ظهور قبل ٧ دقائق» وصاحبُه يكتب له): السطرُ كان يُقرأ مرّةً عند الفتح ثمّ يشيخ على
     الشاشة. يتجدّد كلَّ ٢٠ث والشاشةُ في العين (إيقاعُ الويب، D-765)، وفورَ وصول رسالةٍ منه (أسفل). */
  const seen = useQuery({
    queryKey: [...MESSAGES_KEY, "seen", peer],
    queryFn: async () => (await api<LastSeenPayload>(`/api/v1/me/messages/seen?with=${peer}`)).data,
    staleTime: 15_000,
    refetchInterval: focused ? 20_000 : false,
  });
  const incoming = conv ? conv.events.reduce((n, e) => n + (e.mine ? 0 : 1), 0) : 0;
  const refetchSeen = seen.refetch;
  const incomingRef = useRef(incoming);
  useEffect(() => {
    if (incoming > incomingRef.current) void refetchSeen();
    incomingRef.current = incoming;
  }, [incoming, refetchSeen]);

  const toastHost = useRef<ToastHostRef>(null);
  /* D-1326 — النغمةُ تُعلَن حيث يُعرف المعنى: نجاحٌ أخضر · معلومةٌ محايدة · والغائبُ خطأٌ كما كان */
  const say = useCallback((text: string, tone?: ToastTone) => toastHost.current?.say(text, undefined, undefined, tone), []);

  /* ——— الملاحة ——— */
  const back = useCallback(() => {
    /* 🆕 D-1307 (تسجيلُ خالد، ٦ أكتوبر): الرجوعُ كان يترك لوحةَ المفاتيح مفتوحةً فوق قائمة الرسائل — تُغلق قبل الانتقال */
    Keyboard.dismiss();
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
  /* خيطٌ زال (أُخفي · حُظر صاحبه · رابطٌ قديم) ⇐ الصندوقُ لا شاشةٌ فارغة — كما يسقط `?with=` الميّت إلى القائمة في الويب */
  /* M4-fix — الحكمُ على جلبٍ حيٍّ لا على الصندوق المحفوظ من فتحةٍ سابقة (محادثةٌ جديدةٌ لا تكون فيه بعد) */
  const gone = !!d && !conv && q.isFetchedAfterMount;
  /* الإخفاءُ والحظرُ يغادران بأنفسهما — وزوالُ الخيط بعدهما لا يُطلق مغادرةً ثانية */
  const closing = useRef(false);
  useEffect(() => {
    if (gone && !closing.current) router.replace({ pathname: "/messages", params: { from } });
  }, [gone, router, from]);

  /* ——— مقروء: عند الفتح وكلّما وصل جديدٌ والخيطُ مفتوح ——— */
  const unread = conv?.unread ?? 0;
  useEffect(() => {
    if (unread <= 0) return;
    patchConversation(peer, (c) => ({ ...c, unread: 0 }));
    dropBadges({ messages: unread });
    void write("/api/v1/me/messages/read", { person_id: peer } satisfies MsgPeerBody).catch(() => {});
  }, [unread, peer]);

  /* ——— الردّ ——— */
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const tmp = useRef(0);
  const send = useCallback(() => {
    const body = text.trim();
    if (!body || sending || !conv?.latest_share_id) return;
    haptic.pick();
    const id = `tmp-${tmp.current++}`;
    const ev: MsgEvent = { kind: "reply", id, mine: true, body, created_at: new Date().toISOString() };
    /* جلبٌ في الطريق بدأ قبل الردّ لا يمحو الفقاعةَ المتفائلة حين يصل */
    void queryClient.cancelQueries({ queryKey: MESSAGES_KEY });
    patchConversation(peer, (c) => ({ ...c, events: [...c.events, ev], last_at: ev.created_at }));
    setText("");
    setSending(true);
    write("/api/v1/me/messages/reply", { share_id: conv.latest_share_id, body } satisfies MsgReplyBody)
      .catch((e: unknown) => {
        /* الفشلُ يُرجع: الفقاعةُ تُسحب والنصُّ يعود إلى الحقل، والسببُ يُقال (D-1179) */
        patchConversation(peer, (c) => ({ ...c, events: c.events.filter((x) => x.id !== id) }));
        setText((cur) => (cur ? cur : body));
        say(errorText(t, e));
      })
      .finally(() => setSending(false));
  }, [text, sending, conv?.latest_share_id, peer, say, t]);

  /* ——— ⋯: الملفّ · الإخفاء · الحظر ——— */
  const [menu, setMenu] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [busy, setBusy] = useState(false);
  const name = displayNameOf(conv?.person ?? null, t.anonymousUser);
  const profile = conv?.person && !conv.person.hide_name ? profileHref(conv.person) : null;
  const leaveToInbox = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: "/messages", params: { from } });
  }, [router, from]);
  const hide = useCallback(() => {
    setMenu(false);
    haptic.pick();
    setBusy(true);
    closing.current = true;
    write("/api/v1/me/messages/hide", { person_id: peer } satisfies MsgPeerBody)
      .then(leaveToInbox)
      .catch((e: unknown) => {
        closing.current = false;
        say(errorText(t, e));
      })
      .finally(() => setBusy(false));
  }, [peer, leaveToInbox, say, t]);
  const block = useCallback(() => {
    setConfirmBlock(false);
    haptic.pick();
    setBusy(true);
    closing.current = true;
    write("/api/v1/me/messages/block", { person_id: peer } satisfies MsgPeerBody)
      .then(() => {
        haptic.success();
        leaveToInbox();
      })
      .catch((e: unknown) => {
        closing.current = false;
        say(errorText(t, e));
      })
      .finally(() => setBusy(false));
  }, [peer, leaveToInbox, say, t]);

  /* ——— لوحةُ المفاتيح: الحشوةُ ما يغطّيه منها أسفلَ الشاشة فعلاً ——— */
  const rootRef = useRef<View>(null);
  const [kb, setKb] = useState(0);
  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const s = Keyboard.addListener(showEvt, (e) => {
      const top = e.endCoordinates.screenY;
      rootRef.current?.measureInWindow((_x, y, _w, h) => setKb(Math.max(0, Math.round(y + h - top))));
    });
    const h = Keyboard.addListener(hideEvt, () => setKb(0));
    return () => {
      s.remove();
      h.remove();
    };
  }, []);

  /* الأحدثُ أسفل: قائمةٌ مقلوبة — تبدأ من آخر ما قيل ويبقى تحت الإصبع حين يصل جديد */
  const events = useMemo(() => (conv ? [...conv.events].reverse() : []), [conv]);
  const presence = presenceOf(seen.data?.last_seen, t, (iso) => timeAgo(iso, t));
  const [grow, setGrow] = useState(22);

  return (
    <View ref={rootRef} style={{ flex: 1, backgroundColor: tokens.bg }}>
      <View style={{ paddingTop: insets.top, borderBottomWidth: 1, borderBottomColor: tokens.border, backgroundColor: tokens.bg }}>
        <View style={{ height: 56, flexDirection: "row", alignItems: "center", paddingHorizontal: 8, gap: 4 }}>
          <Pressable onPress={back} hitSlop={8} accessibilityRole="button" accessibilityLabel={t.convBackAria} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
            <View style={{ transform: [{ rotate: I18nManager.isRTL ? "-90deg" : "90deg" }] }}>
              <Icon name="chevron-down" size={22} color={tokens.fg} />
            </View>
          </Pressable>
          {/* الهويّةُ كلُّها — صورةٌ واسمٌ وسطرُ الحضور — بابُ الملفّ (D-767)؛ والمخفيُّ لا صفحةَ له فيبقى نصّاً */}
          <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Pressable
              disabled={!profile}
              onPress={() => profile && doors.openWeb(profile)}
              accessibilityRole={profile ? "link" : undefined}
              accessibilityLabel={profile ? t.viewProfileOf(name) : name}
              style={({ pressed }) => ({ flexShrink: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4, paddingHorizontal: 4, borderRadius: radius.md, opacity: pressed ? 0.7 : 1 })}
            >
              <Avatar uri={conv?.person?.hide_name ? null : conv?.person?.avatar_url ?? null} size={34} />
              <View style={{ flexShrink: 1, minWidth: 0 }}>
                <Text size={14} weight="700" numberOfLines={1}>{conv ? name : ""}</Text>
                {presence ? <Text size={12} muted numberOfLines={1}>{presence}</Text> : null}
              </View>
            </Pressable>
            {/* الشارةُ أختٌ للباب لا ابنةٌ له (D-773ب) */}
            {conv?.person && !conv.person.hide_name ? <IdentityBadges flags={identityFlags(conv.person)} nameSize={14} /> : null}
          </View>
          <Pressable
            onPress={() => {
              haptic.pick();
              setMenu(true);
            }}
            disabled={!conv}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t.moreMenuTitle}
            style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
          >
            <Icon name="dots" size={18} color={tokens.muted} />
          </Pressable>
        </View>
      </View>

      {!conv ? (
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
      ) : (
        <FlatList
          inverted
          data={events}
          keyExtractor={(e) => `${e.kind}-${e.id}`}
          renderItem={({ item }) => <Bubble e={item} onTitle={doors.openTitle} onList={doors.openList} />}
          contentContainerStyle={{ paddingHorizontal: PAGE_PAD, paddingVertical: 16 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          initialNumToRender={16}
          windowSize={11}
        />
      )}

      {conv ? (
        conv.latest_share_id ? (
          /* يلزم الزرُّ قاعَ الحقل وهو ينمو (`items-end`) */
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: PAGE_PAD, paddingTop: 10, paddingBottom: (kb > 0 ? kb : insets.bottom) + 10, borderTopWidth: 1, borderTopColor: tokens.divider, backgroundColor: tokens.bg }}>
            <TextInput
              value={text}
              onChangeText={(v) => setText(v.slice(0, MSG_REPLY_MAX))}
              multiline
              maxLength={MSG_REPLY_MAX}
              placeholder={t.shareReplyPlaceholder}
              placeholderTextColor={tokens.muted}
              accessibilityLabel={t.shareReplyPlaceholder}
              onContentSizeChange={(e) => setGrow(Math.min(4 * 22, Math.max(22, Math.round(e.nativeEvent.contentSize.height))))}
              style={{ flex: 1, minWidth: 0, height: grow + 18, maxHeight: 4 * 22 + 18, borderRadius: 20, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface2, paddingHorizontal: 14, paddingVertical: 9, fontSize: 15, lineHeight: 22, color: tokens.fg, textAlign: "left", textAlignVertical: "center" }}
            />
            <Pressable
              onPress={send}
              disabled={!text.trim() || sending}
              accessibilityRole="button"
              accessibilityLabel={t.shareReplySend}
              style={({ pressed }) => ({ height: 40, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: tokens.accent, alignItems: "center", justifyContent: "center", opacity: !text.trim() || sending ? 0.4 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] })}
            >
              <Text size={12} weight="700" color={tokens.onAccent}>{t.shareReplySend}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ paddingHorizontal: PAGE_PAD, paddingTop: 12, paddingBottom: insets.bottom + 12, borderTopWidth: 1, borderTopColor: tokens.divider }}>
            <Text size={12} muted style={{ textAlign: "center" }}>{t.convReplyNeedsTitle}</Text>
          </View>
        )
      ) : null}

      {menu ? (
        <Sheet title={t.moreMenuTitle} onClose={() => setMenu(false)}>
          {profile ? (
            <Pressable
              onPress={() => {
                setMenu(false);
                doors.openWeb(profile);
              }}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 }}
            >
              <Icon name="people" size={18} color={tokens.accent} />
              <Text size={15}>{t.viewProfileOf(name)}</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={hide} style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 }}>
            <Icon name="eye-off" size={18} color={tokens.muted} />
            <Text size={15}>{t.convHide}</Text>
          </Pressable>
          <View style={{ height: 1, backgroundColor: tokens.divider, marginVertical: 4 }} />
          <Pressable
            onPress={() => {
              setMenu(false);
              setConfirmBlock(true);
            }}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 }}
          >
            <Icon name="close" size={18} color={tokens.error} />
            <Text size={15} color={tokens.error}>{t.blockOption}</Text>
          </Pressable>
        </Sheet>
      ) : null}

      {confirmBlock ? (
        /* الحظرُ من داخل المحادثة يُخفي الخيطَ أيضاً (`BlockConfirmSheet` ⇐ `hideConversation`) — تأكيدٌ وسطيّ لأنّه لا يُتراجع عنه بضغطة */
        <Sheet title={t.blockConfirmTitle} onClose={() => setConfirmBlock(false)} placement="center">
          <Text size={13} muted style={{ lineHeight: 20, marginBottom: 16 }}>{t.blockConfirmBody}</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button label={t.cancelLabel} variant="ghost" onPress={() => setConfirmBlock(false)} />
            <View style={{ flex: 1 }}>
              <Button label={t.blockConfirmButton} variant="danger" onPress={block} />
            </View>
          </View>
        </Sheet>
      ) : null}

      {busy || doors.leaving ? (
        <View pointerEvents="auto" style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={tokens.accent} />
        </View>
      ) : null}
      <ToastHost hostRef={toastHost} bottom={insets.bottom + 84} />
    </View>
  );
}

/** فقاعةٌ واحدة: عملٌ مُشارَك (بطاقة) · قائمة · ردٌّ نصّيّ — والملاحظةُ فقاعةٌ تحت البطاقة (`ConvBubble`) */
function Bubble({ e, onTitle, onList }: { e: MsgEvent; onTitle: (kind: "tv" | "movie", id: number) => void; onList: (id: string) => void }) {
  const { t, tokens } = useApp();
  const side = { alignSelf: e.mine ? ("flex-end" as const) : ("flex-start" as const), maxWidth: "80%" as const, marginVertical: 5 };
  const textBubble = (body: string) => (
    <View style={{ borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: e.mine ? tokens.accent : tokens.surface2, alignSelf: e.mine ? "flex-end" : "flex-start" }}>
      <Text size={14} content color={e.mine ? tokens.onAccent : tokens.fg} style={{ lineHeight: 21 }}>{body}</Text>
    </View>
  );
  if (e.kind === "reply") return <View style={side}>{textBubble(e.body)}</View>;

  const card = (onPress: () => void, art: React.ReactNode, title: string, sub: string) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, padding: 8, borderRadius: 16, borderWidth: 1, borderColor: tokens.border, backgroundColor: pressed ? tokens.surface2 : tokens.surface, minWidth: 180 })}
    >
      {art}
      <View style={{ flexShrink: 1, minWidth: 0 }}>
        <Text size={14} weight="700" numberOfLines={1}>{title}</Text>
        <Text size={12} muted>{sub}</Text>
      </View>
    </Pressable>
  );
  const art = (child: React.ReactNode) => (
    <View style={{ width: 40, aspectRatio: 2 / 3, borderRadius: radius.sm, overflow: "hidden", backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>{child}</View>
  );

  if (e.kind === "list") {
    return (
      <View style={[side, { gap: 4 }]}>
        {card(() => onList(e.list_id), art(<Icon name="list" size={15} color={tokens.muted} />), e.list_name ?? "—", e.item_count ? `${t.convListBadge} · ${t.personWorksCount(e.item_count)}` : t.convListBadge)}
        {e.note ? textBubble(e.note) : null}
      </View>
    );
  }
  const poster = posterFor(e.poster_path, 40);
  return (
    <View style={[side, { gap: 4 }]}>
      {card(
        () => onTitle(e.media_type, e.tmdb_id),
        art(poster ? <Image source={{ uri: poster }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" /> : <Icon name="film" size={13} color={tokens.muted} />),
        e.title ?? "—",
        e.media_type === "tv" ? t.typeSeries : t.typeMovie,
      )}
      {e.note ? textBubble(e.note) : null}
    </View>
  );
}
