import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, FlatList, I18nManager, Keyboard, Platform, Pressable, type TextInput, View, type TextInputInstance, type ViewInstance } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { queryClient, write } from "../api";
import { rememberGif } from "../thread/GifPicker";
import { useApp } from "../state";
import { push } from "../push";
import { Button, Text, type ToastTone } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import { haptic } from "../haptics";
import { ToastHost, type ToastHostRef } from "../HoldHost";
import { Sheet } from "../library/Sheet";
import { Avatar } from "../community/CommunityCards";
import { errorText } from "../community/communityActs";
import { MESSAGES_KEY } from "./live";
import { dropBadges, useDoors, useMessages, type Origin } from "./common";
import { ChatBackdrop, useChatBg } from "./chatBg";
import { copyableOf, copyTextOf, dayKeyOf, dayLabelOf, stampOf } from "./chatFormat";
import { ReplyQuote, TitleQuote, replyRefOf } from "./ReplyQuote";
import { PhotoViewer } from "./PhotoViewer";
import { ChatDock, useKeyboardInset, usePicUpload } from "./chatDock";
import { DeleteSheet, canUnsend, deleteRemote } from "./DeleteSheet";
import { MentionList, useMentions } from "./mentions";
import { Bubble, DayChip } from "./ConversationScreen";
import { GroupAvatar, asBubbleEvent, nameIn, patchGroup, personIn, senderColor, sysLine, titleText } from "./groups";
import { displayNameOf } from "@/core/people";
import type { GroupMsgEvent, GroupSendBody, MsgEvent, MsgImage, MsgGroupConversation, SearchTitle } from "../contracts";

/**
 * ====== خيطُ القروب — الدردشةُ نفسُها بأسماء المرسِلين (الهجرة ٢٠٥، الصورُ المعتمدة ١٥ أكتوبر) ======
 *
 * 🔑 **كلُّ ما في الخاص** (`ConversationScreen`): الفقاعةُ والوقتُ وعلامتا ✓/✓✓ والاقتباسُ والنسخُ والصورةُ والـGIF والخلفيّةُ
 * وخانةُ الكتابة (`ChatDock`) — **والزيادةُ**: اسمُ المرسِل ملوّناً فوق أوّل فقاعةٍ من دفعته، وصورتُه الصغيرة بجانب آخرها،
 * وسطورُ النظام (أنشأ · أضاف · خرج …) في الوسط.
 * 🔑 **✓✓ = قرأها الكلّ**؛ وتحديدُ رسالتي يُظهر «ⓘ» فيه من قرأ ومن لم يقرأ بعد (كالواتس).
 * 🔑 **الترويسةُ بابُ معلومات القروب** (الأعضاء · الإضافة · الكتم · التعديل · الخروج).
 */
const PAGE_PAD = 16;
type Row =
  | { type: "day"; key: string; label: string }
  | { type: "sys"; key: string; text: string }
  | { type: "msg"; key: string; g: GroupMsgEvent; e: MsgEvent; first: boolean; last: boolean };

/** رسالةُ العمل في الاقتباس: نصُّها «🎬 الاسم · التعليق» — الاقتباسُ سطرٌ لا بطاقة */
const quotable = (e: GroupMsgEvent): GroupMsgEvent => (e.title ? { ...e, title: null, body: titleText(e) } : e);

export function GroupScreen({ id, from }: { id: string; from: Origin }) {
  const { t, tokens, locale } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const q = useMessages();
  const d = q.data ?? null;
  const me = d?.me_id ?? "";
  const g = d?.groups?.find((x) => x.group_id === id) ?? null;
  const doors = useDoors(from);

  /* شاشةُ القروب في العين ⇒ رسائلُه والتطبيقُ أمامك لا تنزل شريطاً فوقها (D-1307) */
  useFocusEffect(
    useCallback(() => {
      push.setOpenPeer(`g:${id}`);
      return () => push.setOpenPeer(null, `g:${id}`);
    }, [id]),
  );

  const toastHost = useRef<ToastHostRef>(null);
  const say = useCallback((text: string, tone?: ToastTone) => toastHost.current?.say(text, undefined, undefined, tone), []);

  const [selected, setSelected] = useState<string[]>([]);
  const selectedRef = useRef<string[]>([]);
  selectedRef.current = selected;
  const [replyTo, setReplyTo] = useState<GroupMsgEvent | null>(null);
  const inputRef = useRef<TextInputInstance>(null);

  const back = useCallback(() => {
    Keyboard.dismiss();
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: "/messages", params: { from } });
  }, [router, from]);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      /* 🆕 D-1438 — لوحةُ «+» مفتوحة: الرجوعُ يغلقها أوّلاً */
      if (attachRef.current) {
        setAttach(false);
        return true;
      }
      if (selectedRef.current.length) {
        setSelected([]);
        return true;
      }
      back();
      return true;
    });
    return () => sub.remove();
  }, [back]);

  /* قروبٌ خرجتَ منه أو حُذفتَ أو زال ⇒ الصندوق (الحكمُ على جلبٍ حيّ) */
  const gone = !!d && !g && q.isFetchedAfterMount;
  useEffect(() => {
    if (gone) router.replace({ pathname: "/messages", params: { from } });
  }, [gone, router, from]);

  /* ——— مقروء: عند الفتح وكلّما وصل جديدٌ والقروبُ مفتوح ——— */
  const unread = g?.unread ?? 0;
  useEffect(() => {
    if (unread <= 0) return;
    patchGroup(id, (x) => ({ ...x, unread: 0 }));
    dropBadges({ messages: unread });
    void write(`/api/v1/me/groups/${id}/manage`, { action: "read" }).catch(() => {});
  }, [unread, id]);

  /* ——— الكتابة ——— */
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const tmp = useRef(0);
  const { pic, setPic, pickImage } = usePicUpload(say);
  const [attach, setAttach] = useState(false);
  const [viewer, setViewer] = useState<{ g: GroupMsgEvent; image: MsgImage } | null>(null);

  const deliver = useCallback(
    (ev: GroupMsgEvent, payload: GroupSendBody, undo: () => void, onOk?: () => void) => {
      haptic.pick();
      void queryClient.cancelQueries({ queryKey: MESSAGES_KEY });
      patchGroup(id, (x) => ({ ...x, events: [...x.events, ev], last_at: ev.created_at }));
      setSending(true);
      write(`/api/v1/me/groups/${id}`, payload)
        .then(() => {
          onOk?.();
          void queryClient.invalidateQueries({ queryKey: MESSAGES_KEY });
        })
        .catch((e: unknown) => {
          patchGroup(id, (x) => ({ ...x, events: x.events.filter((y) => y.id !== ev.id) }));
          undo();
          say(errorText(t, e));
        })
        .finally(() => setSending(false));
    },
    [id, say, t],
  );

  const quoteRef = useCallback(() => {
    if (!replyTo) return { ref: null, id: null };
    return {
      ref: { id: replyTo.id, sender_id: replyTo.sender_id, mine: replyTo.mine, kind: replyTo.image ? ("image" as const) : replyTo.gif_id ? ("gif" as const) : ("text" as const), body: titleText(replyTo).slice(0, 140), ...(replyTo.image ? { image: replyTo.image } : {}), ...(replyTo.gif_id ? { gif_id: replyTo.gif_id } : {}) },
      id: replyTo.id,
    };
  }, [replyTo]);

  const send = useCallback(() => {
    const body = text.trim();
    const image = pic;
    if ((!body && !image) || (image && !image.path) || sending || !g) return;
    const quote = quoteRef();
    const quoted = replyTo;
    const ev: GroupMsgEvent = {
      kind: "msg",
      id: `tmp-${tmp.current++}`,
      mine: true,
      sender_id: me,
      body,
      created_at: new Date().toISOString(),
      ...(image ? { image: { url: image.local, key: image.local } } : {}),
      ...(quote.ref ? { reply: quote.ref } : {}),
    };
    setText("");
    setPic(null);
    setReplyTo(null);
    deliver(ev, { body, ...(image?.path ? { image_path: image.path } : {}), ...(quote.id ? { reply_to: quote.id } : {}) }, () => {
      setText((cur) => (cur ? cur : body));
      if (image) setPic((cur) => cur ?? image);
      if (quoted) setReplyTo((cur) => cur ?? quoted);
    });
  }, [text, pic, sending, g, me, quoteRef, replyTo, deliver, setPic]);

  const sendGif = useCallback(
    (gif: string) => {
      if (!g) return;
      const quote = quoteRef();
      const quoted = replyTo;
      const ev: GroupMsgEvent = { kind: "msg", id: `tmp-${tmp.current++}`, mine: true, sender_id: me, body: "", gif_id: gif, created_at: new Date().toISOString(), ...(quote.ref ? { reply: quote.ref } : {}) };
      setReplyTo(null);
      deliver(
        ev,
        { body: "", gif_id: gif, ...(quote.id ? { reply_to: quote.id } : {}) },
        () => {
          if (quoted) setReplyTo((cur) => cur ?? quoted);
        },
        () => rememberGif(gif),
      );
    },
    [g, me, quoteRef, replyTo, deliver],
  );

  /* 🆕 R57 — «بحث لوبز»: العملُ المختار **يتعلّق فوق الخانة** ولوحةُ المفاتيح تُفتح (أحمد: «ابغى اقدر اضيف رسالة مع العمل»؛ «١ أ ٢ أ»)،
     و«أرسل» يرسله ومعه ما كُتب في الرسالة نفسِها (`body` + `title` — الحمولةُ تقبلهما معاً) والاقتباسُ إن كان. كان يُرسل بلمسته */
  const [picked, setPicked] = useState<SearchTitle | null>(null);
  const sendTitle = useCallback((r: SearchTitle) => {
    haptic.pick();
    setPicked(r);
    setAttach(false);
    setTimeout(() => inputRef.current?.focus(), 120);
  }, []);
  const sendPicked = useCallback(() => {
    const r = picked;
    if (!g || !r || sending) return;
    const body = text.trim();
    const quote = quoteRef();
    const quoted = replyTo;
    const title = { media_type: r.mediaType, tmdb_id: r.id, title: r.title, poster_path: r.posterPath ?? null };
    const ev: GroupMsgEvent = { kind: "msg", id: `tmp-${tmp.current++}`, mine: true, sender_id: me, body, title, created_at: new Date().toISOString(), ...(quote.ref ? { reply: quote.ref } : {}) };
    setPicked(null);
    setText("");
    setReplyTo(null);
    deliver(ev, { body, title, ...(quote.id ? { reply_to: quote.id } : {}) }, () => {
      setPicked((cur) => cur ?? r);
      setText((cur) => cur || body);
      if (quoted) setReplyTo((cur) => cur ?? quoted);
    });
  }, [g, picked, sending, text, me, quoteRef, replyTo, deliver]);

  /* 🆕 D-1436 — المنشن: أسماءُ الأعضاء (غيري) لرسم `@اسم` وللقائمة التي تظهر حين تكتب `@` (🆕 D-1443 — `mentions.tsx` يقرؤه النقاشُ أيضاً) */
  const mentionables = useMemo(() => {
    if (!g) return [];
    return g.members
      .filter((m) => m.id !== me)
      .map((m) => personIn(g, m.id))
      .filter((p): p is NonNullable<typeof p> => !!p);
  }, [g, me]);
  const { names: mentionSet, hits: mentionHits, pick: pickMention } = useMentions(text, setText, mentionables, inputRef);

  const chatBg = useChatBg();
  const [headH, setHeadH] = useState(0);
  const [dockH, setDockH] = useState(0);
  const rootRef = useRef<ViewInstance>(null);
  const kb = useKeyboardInset(rootRef);
  /* 🆕 D-1438 — لوحةُ «+» مكانَ لوحة المفاتيح، و«+» يبدّل بينهما كالواتس. 🆕 D-1440 — إغلاقُها حين تظهر لوحةُ المفاتيح صار في
     `ChatDock`: في بحث GIF/لوبز تبقى اللوحةُ ولوحةُ المفاتيح معاً */
  const closeAttach = useCallback(() => setAttach(false), []);
  const attachRef = useRef(false);
  attachRef.current = attach;
  const toggleAttach = useCallback(() => {
    if (attachRef.current) {
      setAttach(false);
      inputRef.current?.focus();
    } else {
      Keyboard.dismiss();
      setAttach(true);
    }
  }, []);

  /* الأحدثُ أسفل (قائمةٌ مقلوبة) · فاصلُ يوم · اسمُ المرسِل فوق أوّل فقاعةٍ من دفعته وصورتُه بجانب آخرها */
  const rows = useMemo<Row[]>(() => {
    if (!g) return [];
    const out: Row[] = [];
    let day = "";
    const evs = g.events;
    for (let i = 0; i < evs.length; i++) {
      const e = evs[i];
      const k = dayKeyOf(e.created_at);
      const newDay = !!k && k !== day;
      if (newDay) {
        day = k;
        out.push({ type: "day", key: `day-${k}`, label: dayLabelOf(k, t) });
      }
      if (e.kind === "sys") {
        out.push({ type: "sys", key: `sys-${e.id}`, text: sysLine(e, g, me, t) });
        continue;
      }
      const prev = evs[i - 1];
      const next = evs[i + 1];
      const sameAsPrev = !newDay && !!prev && prev.kind === "msg" && prev.sender_id === e.sender_id;
      const sameAsNext = !!next && next.kind === "msg" && next.sender_id === e.sender_id && dayKeyOf(next.created_at) === k;
      out.push({ type: "msg", key: `msg-${e.id}`, g: e, e: asBubbleEvent(e), first: !sameAsPrev, last: !sameAsNext });
    }
    return out.reverse();
  }, [g, me, t]);

  /* ——— التحديد ——— */
  const selecting = selected.length > 0;
  const startSelect = useCallback((e: MsgEvent) => {
    if (e.id.startsWith("tmp-")) return;
    haptic.pick();
    Keyboard.dismiss();
    setSelected((cur) => (cur.includes(e.id) ? cur : [...cur, e.id]));
  }, []);
  const toggleSelect = useCallback((e: MsgEvent) => {
    if (e.id.startsWith("tmp-")) return;
    haptic.pick();
    setSelected((cur) => (cur.includes(e.id) ? cur.filter((k) => k !== e.id) : [...cur, e.id]));
  }, []);
  const selectedMsgs = useMemo(() => (g ? g.events.filter((e): e is GroupMsgEvent => e.kind === "msg" && selected.includes(e.id)) : []), [g, selected]);
  useEffect(() => {
    if (selected.length && selectedMsgs.length !== selected.length) setSelected(selectedMsgs.map((e) => e.id));
  }, [selected, selectedMsgs]);
  const canCopy = selectedMsgs.some((e) => !!copyableOf(asBubbleEvent(e)));
  const single = selectedMsgs.length === 1 && !selectedMsgs[0].deleted ? selectedMsgs[0] : null;
  const copySelected = useCallback(() => {
    if (!g) return;
    const bySender = new Map(selectedMsgs.map((e) => [e.id, e.sender_id] as const));
    const text = copyTextOf(selectedMsgs.map(asBubbleEvent), (mine, e) => (mine ? t.convYou : nameIn(g, bySender.get(e.id) ?? null, me, t)), t);
    if (!text) return;
    void Clipboard.setStringAsync(text)
      .then(() => {
        haptic.success();
        say(t.msgCopied, "success");
      })
      .catch(() => say(t.apiInternal));
    setSelected([]);
  }, [g, selectedMsgs, me, t, say]);
  /* ——— 🆕 D-1441 — الحذف: «عندي» لأيِّ رسالة، و«للجميع» لرسائلي في المهلة (كالخاص) ——— */
  const [delOpen, setDelOpen] = useState(false);
  const canAll = canUnsend(selectedMsgs) && selectedMsgs.every((e) => !e.deleted);
  const runDelete = useCallback(
    (scope: "me" | "all") => {
      if (!g) return;
      const ids = new Set(selectedMsgs.map((e) => e.id));
      setDelOpen(false);
      setSelected([]);
      haptic.pick();
      patchGroup(g.group_id, (cur) => ({
        ...cur,
        events:
          scope === "me"
            ? cur.events.filter((e) => !ids.has(e.id))
            : cur.events.map((e) => (e.kind === "msg" && ids.has(e.id) ? { kind: "msg", id: e.id, mine: e.mine, sender_id: e.sender_id, body: "", created_at: e.created_at, deleted: true } : e)),
      }));
      deleteRemote({ scope, group_id: g.group_id, items: [...ids].map((id) => ({ kind: "group" as const, id })) })
        .then((r) => {
          if (r.refused.length) {
            say(scope === "all" ? t.apiUnsendWindow : t.apiInternal);
            void queryClient.invalidateQueries({ queryKey: MESSAGES_KEY });
          }
        })
        .catch((err: unknown) => {
          say(errorText(t, err));
          void queryClient.invalidateQueries({ queryKey: MESSAGES_KEY });
        });
    },
    [g, selectedMsgs, say, t],
  );
  const beginReply = useCallback((e: GroupMsgEvent) => {
    setSelected([]);
    setViewer(null);
    setReplyTo(e);
    setTimeout(() => inputRef.current?.focus(), 250);
  }, []);
  /* ⓘ على رسالتي: من قرأها ومن لم يقرأ بعد */
  const [readInfo, setReadInfo] = useState<GroupMsgEvent | null>(null);

  const listRef = useRef<FlatList<Row>>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const jumpTo = useCallback(
    (mid: string) => {
      const index = rows.findIndex((r) => r.type === "msg" && r.g.id === mid);
      if (index < 0) return;
      listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
      setFlash(mid);
      setTimeout(() => setFlash((f) => (f === mid ? null : f)), 1400);
    },
    [rows],
  );

  const canSend = picked ? !sending : (!!text.trim() || !!pic) && !(pic && !pic.path) && !sending;
  const openInfo = useCallback(() => {
    haptic.pick();
    router.push({ pathname: "/messages/group/[id]/info", params: { id, from } });
  }, [router, id, from]);
  const sub = g ? g.members.map((m) => (m.id === me ? t.grpYou : displayNameOf(personIn(g, m.id), t.anonymousUser))).join(locale === "en" ? ", " : "، ") : "";

  return (
    <View ref={rootRef} style={{ flex: 1, backgroundColor: tokens.bg }}>
      <ChatBackdrop bg={chatBg} top={headH} bottom={dockH} />
      <View onLayout={(e) => setHeadH(Math.round(e.nativeEvent.layout.height))} style={{ paddingTop: insets.top, borderBottomWidth: 1, borderBottomColor: tokens.border, backgroundColor: tokens.bg }}>
        {selecting ? (
          <View style={{ height: 56, flexDirection: "row", alignItems: "center", paddingHorizontal: 8, gap: 4 }}>
            <Pressable onPress={() => setSelected([])} hitSlop={8} accessibilityRole="button" accessibilityLabel={t.msgSelectCancel} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
              <View style={{ transform: [{ rotate: I18nManager.isRTL ? "-90deg" : "90deg" }] }}>
                <Icon name="chevron-down" size={22} color={tokens.fg} />
              </View>
            </Pressable>
            <Text size={17} weight="700" accessibilityLabel={t.msgSelectedCount(selected.length)} style={{ flex: 1, paddingHorizontal: 4 }}>{String(selected.length)}</Text>
            {single && single.mine ? (
              <Pressable onPress={() => { setSelected([]); setReadInfo(single); }} hitSlop={6} accessibilityRole="button" accessibilityLabel={t.grpReadBy} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? tokens.surface2 : "transparent" })}>
                <Icon name="info" size={20} color={tokens.fg} />
              </Pressable>
            ) : null}
            {single ? (
              <Pressable onPress={() => beginReply(single)} hitSlop={6} accessibilityRole="button" accessibilityLabel={t.msgReply} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? tokens.surface2 : "transparent" })}>
                <Icon name="reply" size={21} color={tokens.fg} />
              </Pressable>
            ) : null}
            <Pressable onPress={copySelected} disabled={!canCopy} hitSlop={6} accessibilityRole="button" accessibilityLabel={t.msgCopy} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", opacity: canCopy ? 1 : 0.35, backgroundColor: pressed ? tokens.surface2 : "transparent" })}>
              <Icon name="copy" size={20} color={tokens.fg} />
            </Pressable>
            {/* 🆕 D-1441 — «حذف» بعد «نسخ» */}
            <Pressable onPress={() => setDelOpen(true)} hitSlop={6} accessibilityRole="button" accessibilityLabel={t.msgDelete} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? tokens.surface2 : "transparent" })}>
              <Icon name="trash" size={20} color={tokens.fg} />
            </Pressable>
          </View>
        ) : (
          <View style={{ height: 56, flexDirection: "row", alignItems: "center", paddingHorizontal: 8, gap: 4 }}>
            <Pressable onPress={back} hitSlop={8} accessibilityRole="button" accessibilityLabel={t.convBackAria} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
              <View style={{ transform: [{ rotate: I18nManager.isRTL ? "-90deg" : "90deg" }] }}>
                <Icon name="chevron-down" size={22} color={tokens.fg} />
              </View>
            </Pressable>
            {/* الترويسةُ كلُّها بابُ معلومات القروب */}
            <Pressable
              disabled={!g}
              onPress={openInfo}
              accessibilityRole="button"
              accessibilityLabel={g ? `${g.name} · ${t.grpInfo}` : t.grpInfo}
              style={({ pressed }) => ({ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4, paddingHorizontal: 4, borderRadius: radius.md, opacity: pressed ? 0.7 : 1 })}
            >
              {g ? <GroupAvatar g={g} meId={me} size={34} /> : null}
              <View style={{ flexShrink: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text size={14} weight="700" numberOfLines={1} style={{ flexShrink: 1 }}>{g?.name ?? ""}</Text>
                  {g?.muted ? <Icon name="volume-off" size={13} color={tokens.muted} /> : null}
                </View>
                <Text size={12} muted numberOfLines={1}>{sub}</Text>
              </View>
            </Pressable>
          </View>
        )}
      </View>

      {!g ? (
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
          ref={listRef}
          /* 🆕 D-1438 — لمسُ المحادثة أو سحبُها يغلق لوحةَ «+» */
          onTouchStart={() => attachRef.current && setAttach(false)}
          inverted
          data={rows}
          keyExtractor={(r) => r.key}
          extraData={`${selected.join(",")}|${flash ?? ""}`}
          renderItem={({ item }) => {
            if (item.type === "day") return <DayChip label={item.label} />;
            if (item.type === "sys") return <SysChip text={item.text} />;
            const mine = item.g.mine;
            const quotedName = item.g.reply ? nameIn(g, item.g.reply.sender_id, me, t) : "";
            const bubble = (
              <Bubble
                e={item.e}
                peerName={quotedName}
                selecting={selecting}
                selected={selected.includes(item.g.id)}
                flash={flash === item.g.id}
                onSelect={startSelect}
                onToggle={toggleSelect}
                onQuote={jumpTo}
                onTitle={doors.openTitle}
                mentions={mentionSet}
                onMention={(u) => doors.openPath(`/u/${u}`)}
                onPath={doors.openPath}
                onList={() => {}}
                onImage={(_e, image) => {
                  Keyboard.dismiss();
                  setViewer({ g: item.g, image });
                }}
                onImageFail={() => void queryClient.invalidateQueries({ queryKey: MESSAGES_KEY })}
              />
            );
            if (mine) return bubble;
            /* رسالةُ غيري: الاسمُ ملوّناً فوق أوّل فقاعةٍ من دفعته، والصورةُ بجانب آخرها — والمسافةُ محجوزةٌ لها في البقيّة */
            const who = personIn(g, item.g.sender_id);
            return (
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6 }}>
                <View style={{ width: 28, marginBottom: 6 }}>{item.last ? <Avatar uri={who?.hide_name ? null : who?.avatar_url ?? null} size={28} /> : null}</View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  {item.first ? (
                    <Text size={12} weight="700" color={senderColor(item.g.sender_id)} numberOfLines={1} style={{ marginTop: 6, marginBottom: -1, paddingHorizontal: 4 }}>
                      {nameIn(g, item.g.sender_id, me, t)}
                    </Text>
                  ) : null}
                  {bubble}
                </View>
              </View>
            );
          }}
          onScrollToIndexFailed={(info) => {
            listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true });
            setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, viewPosition: 0.5, animated: true }), 300);
          }}
          contentContainerStyle={{ paddingHorizontal: PAGE_PAD, paddingVertical: 16 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          initialNumToRender={16}
          windowSize={11}
        />
      )}

      {/* 🆕 D-1436 — `@` في آخر الحقل ⇒ أعضاءُ القروب المطابقون فوق الخانة؛ اللمسةُ تكمل الاسمَ ومسافةً بعده */}
      {g ? <MentionList hits={mentionHits} onPick={pickMention} pad={PAGE_PAD} /> : null}

      {g ? (
        <ChatDock
          text={text}
          onText={setText}
          pic={pic}
          onClearPic={() => setPic(null)}
          quote={
            picked || (replyTo && replyRefOf(asBubbleEvent(quotable(replyTo)))) ? (
              <View style={{ gap: 6 }}>
                {replyTo && replyRefOf(asBubbleEvent(quotable(replyTo))) ? (
                  <ReplyQuote r={replyRefOf(asBubbleEvent(quotable(replyTo)))!} peerName={nameIn(g, replyTo.sender_id, me, t)} onClear={() => setReplyTo(null)} />
                ) : null}
                {picked ? <TitleQuote title={picked.title} kind={picked.mediaType} poster={picked.poster ?? null} onClear={() => setPicked(null)} /> : null}
              </View>
            ) : null
          }
          placeholder={picked ? t.msgAddNote : undefined}
          inputRef={inputRef}
          kb={kb}
          bottomInset={insets.bottom}
          sending={sending}
          canSend={canSend}
          onAttach={toggleAttach}
          attach={attach}
          onAttachClose={closeAttach}
          onImage={() => void pickImage()}
          onGif={sendGif}
          onLoopz={sendTitle}
          onSend={picked ? sendPicked : send}
          onRestingHeight={setDockH}
        />
      ) : null}

      {viewer && g ? (
        <PhotoViewer
          image={viewer.image}
          who={viewer.g.mine ? t.convYou : nameIn(g, viewer.g.sender_id, me, t)}
          at={viewer.g.created_at}
          caption={viewer.g.body}
          onClose={() => setViewer(null)}
          onReply={!viewer.g.id.startsWith("tmp-") ? () => beginReply(viewer.g) : undefined}
          onToast={(m) => say(m)}
        />
      ) : null}
      {readInfo && g ? <ReadSheet m={readInfo} g={g} me={me} onClose={() => setReadInfo(null)} /> : null}

      {doors.leaving ? (
        <View pointerEvents="auto" style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={tokens.accent} />
        </View>
      ) : null}
      {delOpen ? <DeleteSheet count={selectedMsgs.length} canAll={canAll} onMe={() => runDelete("me")} onAll={() => runDelete("all")} onClose={() => setDelOpen(false)} /> : null}
      <ToastHost hostRef={toastHost} bottom={insets.bottom + 84} />
    </View>
  );
}

/** سطرُ النظام وسطَ الخيط — شكلُ فاصل اليوم نفسُه */
function SysChip({ text }: { text: string }) {
  const { tokens } = useApp();
  return (
    <View style={{ alignSelf: "center", maxWidth: "85%", marginVertical: 6, paddingHorizontal: 11, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: tokens.surface }}>
      <Text size={12} muted style={{ textAlign: "center" }}>{text}</Text>
    </View>
  );
}

/** ⓘ — من قرأ رسالتي ومن لم يقرأ بعد (من كان عضواً حين أُرسلت) */
function ReadSheet({ m, g, me, onClose }: { m: GroupMsgEvent; g: MsgGroupConversation; me: string; onClose: () => void }) {
  const { t, tokens } = useApp();
  const readers = m.read_by ?? [];
  const others = g.members.filter((x) => x.id !== me);
  const pending = others.filter((x) => !readers.includes(x.id));
  const row = (id: string) => {
    const p = personIn(g, id);
    return (
      <View key={id} style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 }}>
        <Avatar uri={p?.hide_name ? null : p?.avatar_url ?? null} size={34} />
        <Text size={15} numberOfLines={1} style={{ flex: 1 }}>{displayNameOf(p, t.anonymousUser)}</Text>
      </View>
    );
  };
  return (
    <Sheet title={stampOf(m.created_at, t)} onClose={onClose}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <Icon name="check-double" size={16} color={tokens.accent} />
        <Text size={13} weight="700">{t.grpReadBy}</Text>
      </View>
      {readers.length ? readers.map(row) : <Text size={13} muted style={{ paddingVertical: 8 }}>—</Text>}
      {pending.length ? (
        <>
          <View style={{ height: 1, backgroundColor: tokens.divider, marginVertical: 8 }} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <Icon name="check-line" size={16} color={tokens.muted} />
            <Text size={13} weight="700" muted>{t.grpNotReadYet}</Text>
          </View>
          {pending.map((x) => row(x.id))}
        </>
      ) : null}
    </Sheet>
  );
}
