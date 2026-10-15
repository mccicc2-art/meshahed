import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, FlatList, I18nManager, Keyboard, Platform, Pressable, type TextInput, View } from "react-native";
import { Image } from "expo-image";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api, queryClient, write } from "../api";
import { GifImage, GifPicker, rememberGif } from "../thread/GifPicker";
import { useApp } from "../state";
import { push } from "../push";
import { Button, Text, firstStrongRtl, type ToastTone } from "../ui";
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
import { dropBadges, patchConversation, patchKeep, presenceOf, useDoors, useMessages, type Origin } from "./common";
import { displayNameOf, profileHref } from "@/core/people";
import { timeAgo } from "@/core/when";
import type { LastSeenPayload, MessagesPayload, MsgEvent, MsgImage, MsgPeerBody, MsgReplyRef, MsgTextBody } from "../contracts";
import { ChatBackdrop, ChatBgSheet, useChatBg } from "./chatBg";
import { clockOf, copyableOf, copyTextOf, dayKeyOf, dayLabelOf } from "./chatFormat";
import { ReplyQuote, replyRefOf } from "./ReplyQuote";
import { PhotoViewer } from "./PhotoViewer";
import { AttachSheet, ChatDock, useKeyboardInset, usePicUpload } from "./chatDock";

/**
 * ====== خيطُ المحادثة أصليّاً — كالدردشة · Phase 11-M · M4 (خطّة §٣) ======
 *
 * 🔑 **`ConversationView` الويب بأفعاله كلِّها**: الفقاعاتُ (عملٌ مُشارَك · قائمة · ردّ) مصطفّةً بجهة المرسِل · الترويسةُ كلُّها
 * بابُ الملفّ مع سطر الحضور (D-765/D-767) · ⋯ ورقةٌ فيها الملفُّ ثمّ الإخفاءُ ثمّ الحظر، الأخطرُ أخيراً (D-018) · الواردُ
 * يُعلَّم مقروءاً عند الفتح وكلّما وصل جديدٌ والخيطُ مفتوح.
 *
 * 🆕 D-1380 (ينقض D-051) — **الرسالةُ نصٌّ مباشرٌ في كلِّ محادثة** (`/api/v1/me/messages/text`)، والخيطُ يُفتح لشخصٍ لا
 * محادثةَ معه بعد (من ملفّه أو من «ابدأ محادثة»): هويّتُه وحكمُ البوّاب من `?with=`، فيُرسم فارغاً بـ«قل هلا» أو بسطر
 * «لا يستقبل رسائل».
 *
 * ⚖️ **الحقلُ مثبَّتٌ أسفل الشاشة لا ورقةٌ وسطى** (خلافاً لـ`Composer`، D-1175): حجّةُ الورقة كانت حقلاً داخل قائمةٍ افتراضيّة
 * يُدوَّر وتغطّيه اللوحة — **وهنا الحقلُ خارج القائمة**، والدردشةُ تُكتب وأنت ترى آخرَ ما قيل. يمتدّ مع الكتابة حتى أربعة
 * أسطر ثمّ يمرّر داخله (D-765)، **ويرتفع فوق لوحة المفاتيح بقياس موضعه** (يعمل سواءٌ صغّر النظامُ النافذةَ أم لا).
 *
 * 🆕 D-1401/D-1402/D-1403 — **كالواتس** (تسجيلاتُ أحمد ١٥ أكتوبر): الوقتُ في زاوية كلِّ فقاعة ومعه ✓ وصلت · ✓✓ قرأها
 * على رسائلي، وفاصلُ «اليوم/أمس» بين الأيّام · ضغطةٌ طويلةٌ تحدّد الرسالة فيصير الشريطُ العلويّ أزراراً (رد · نسخ)،
 * ولمسةٌ على غيرها تضيفها · «رد» يقتبسها فوق خانة الكتابة، والاقتباسُ في الفقاعة ينزل إلى الأصل · الصورةُ تُفتح
 * بملء الشاشة (`PhotoViewer`).
 */
const PAGE_PAD = 16;
/** مفتاحُ الحدث — نوعُه ومعرّفُه، فلا يتصادم ردٌّ ومشاركةٌ بمعرّفٍ واحد */
const keyOf = (e: MsgEvent) => `${e.kind}-${e.id}`;
type Row = { type: "day"; key: string; label: string } | { type: "ev"; key: string; e: MsgEvent };

export function ConversationScreen({ peer, from }: { peer: string; from: Origin }) {
  const { t, tokens } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const q = useMessages();
  const d = q.data ?? null;
  const conv = d?.conversations.find((c) => c.person_id === peer) ?? null;
  /* 🆕 D-1380 — خيطٌ لم يبدأ: هويّةُ صاحبه وحكمُ البوّاب (`can_message`) من الحمولة نفسِها بـ`?with=` */
  const fresh = useQuery({
    queryKey: [...MESSAGES_KEY, "with", peer],
    queryFn: async () => (await api<MessagesPayload>(`/api/v1/me/messages?with=${peer}`)).data,
    enabled: !!d && !conv,
    staleTime: 15_000,
  });
  const person = conv?.person ?? fresh.data?.peer ?? null;
  const canMsg = fresh.data?.can_message ?? null;
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

  /* ——— 🆕 D-1401 — التحديدُ كالواتس: مفاتيحُ الرسائل المحدَّدة؛ والمرجعُ يقرؤه زرُّ الرجوع بلا إعادة اشتراك ——— */
  const [selected, setSelected] = useState<string[]>([]);
  const selectedRef = useRef<string[]>([]);
  selectedRef.current = selected;
  /* 🆕 D-1403 — الرسالةُ المقتبَسة فوق خانة الكتابة */
  const [replyTo, setReplyTo] = useState<MsgEvent | null>(null);
  const inputRef = useRef<TextInput>(null);

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
      /* 🆕 D-1401 — زرُّ الرجوع يلغي التحديدَ أوّلاً ولا يخرج من المحادثة (كالواتس) */
      if (selectedRef.current.length) {
        setSelected([]);
        return true;
      }
      back();
      return true;
    });
    return () => sub.remove();
  }, [back]);
  /* خيطٌ زال (أُخفي · حُظر صاحبه · رابطٌ قديم) ⇐ الصندوقُ لا شاشةٌ فارغة — كما يسقط `?with=` الميّت إلى القائمة في الويب */
  /* M4-fix — الحكمُ على جلبٍ حيٍّ لا على الصندوق المحفوظ من فتحةٍ سابقة (محادثةٌ جديدةٌ لا تكون فيه بعد) */
  /* 🆕 D-1380 — ولا خيطٌ يبدأ: لا محادثةَ ولا هويّةَ لصاحبها (حسابٌ زال · حظر · رابطٌ ميّت) */
  const gone = !!d && !conv && q.isFetchedAfterMount && fresh.isFetched && !fresh.data?.peer;
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
  /* 🆕 D-1387 — صورةُ الرسالة: تُصغَّر وتُرفع فورَ اختيارها (`path` حين يعود الخادم)، وتُرى فوق الحقل بـ✕ قبل الإرسال (`chatDock`) */
  const { pic, setPic, pickImage } = usePicUpload(say);
  const [attach, setAttach] = useState(false);
  const [gifOpen, setGifOpen] = useState(false);
  /* 🆕 D-1402 — العارضُ يعرف الرسالةَ كلَّها: صاحبُها ووقتُها وتعليقُها، و«رد…» يقتبسها */
  const [viewer, setViewer] = useState<{ e: MsgEvent; image: MsgImage } | null>(null);

  /** الإرسالُ الواحد — نصٌّ أو صورةٌ بتعليقٍ أو GIF: فقاعةٌ متفائلةٌ فوراً، والفشلُ يسحبها ويُرجع ما كان (`undo`) */
  const deliver = useCallback(
    (ev: MsgEvent, payload: MsgTextBody, undo: () => void, onOk?: () => void) => {
      haptic.pick();
      /* جلبٌ في الطريق بدأ قبل الردّ لا يمحو الفقاعةَ المتفائلة حين يصل */
      void queryClient.cancelQueries({ queryKey: MESSAGES_KEY });
      if (conv) patchConversation(peer, (c) => ({ ...c, events: [...c.events, ev], last_at: ev.created_at }));
      else
        /* 🆕 D-1380 — أوّلُ رسالةٍ تصنع المحادثةَ في الكاش (ويخرج صاحبُها من «ابدأ محادثة») — الخيطُ لا ينتظر جلباً */
        patchKeep<MessagesPayload>(MESSAGES_KEY, (p) => ({
          ...p,
          conversations: [{ person_id: peer, person, events: [ev], last_at: ev.created_at, unread: 0, latest_share_id: "" }, ...p.conversations],
          startable: p.startable.filter((x) => x.id !== peer),
        }));
      setSending(true);
      write("/api/v1/me/messages/text", payload)
        .then(() => {
          onOk?.();
          void queryClient.invalidateQueries({ queryKey: MESSAGES_KEY });
        })
        .catch((e: unknown) => {
          /* الفشلُ يُرجع: الفقاعةُ تُسحب وما كُتب أو أُرفق يعود، والسببُ يُقال (D-1179) */
          patchConversation(peer, (c) => ({ ...c, events: c.events.filter((x) => x.id !== ev.id) }));
          undo();
          say(errorText(t, e));
        })
        .finally(() => setSending(false));
    },
    [conv, person, peer, say, t],
  );

  /* 🆕 D-1403 — المقتبَسُ: مختصرُه في الفقاعة المتفائلة (الشكلُ الذي سيعود به من الخادم)، ومعرّفُه للخادم */
  const quoteOf = useCallback((): { ref: MsgReplyRef | null; id: string | null } => {
    const r = replyTo ? replyRefOf(replyTo) : null;
    return { ref: r, id: r ? r.id : null };
  }, [replyTo]);

  const send = useCallback(() => {
    const body = text.trim();
    const image = pic;
    /* الصورةُ ما زالت تُرفع ⇒ «أرسل» ينتظرها (معطّلٌ في الرسم) */
    if ((!body && !image) || (image && !image.path) || sending || (!conv && !person)) return;
    const id = `tmp-${tmp.current++}`;
    const quote = quoteOf();
    const quoted = replyTo;
    const ev: MsgEvent = {
      kind: "reply",
      id,
      mine: true,
      body,
      created_at: new Date().toISOString(),
      dm: true,
      ...(image ? { image: { url: image.local, key: image.local } } : {}),
      ...(quote.ref ? { reply: quote.ref } : {}),
    };
    setText("");
    setPic(null);
    setReplyTo(null);
    deliver(ev, { recipient_id: peer, body, ...(image?.path ? { image_path: image.path } : {}), ...(quote.id ? { reply_to: quote.id } : {}) }, () => {
      setText((cur) => (cur ? cur : body));
      if (image) setPic((cur) => cur ?? image);
      if (quoted) setReplyTo((cur) => cur ?? quoted);
    });
  }, [text, pic, sending, conv, person, peer, deliver, quoteOf, replyTo, setPic]);

  /* 🆕 D-1387 — الـGIF يُرسَل بضغطته (بلا خطوة تأكيد)، ويدخل «الأخيرة» في المنتقي حين يُقبل */
  const sendGif = useCallback(
    (gif: string) => {
      if (!conv && !person) return;
      const quote = quoteOf();
      const quoted = replyTo;
      const ev: MsgEvent = {
        kind: "reply",
        id: `tmp-${tmp.current++}`,
        mine: true,
        body: "",
        gif_id: gif,
        created_at: new Date().toISOString(),
        dm: true,
        ...(quote.ref ? { reply: quote.ref } : {}),
      };
      setReplyTo(null);
      deliver(
        ev,
        { recipient_id: peer, body: "", gif_id: gif, ...(quote.id ? { reply_to: quote.id } : {}) },
        () => {
          if (quoted) setReplyTo((cur) => cur ?? quoted);
        },
        () => rememberGif(gif),
      );
    },
    [conv, person, peer, deliver, quoteOf, replyTo],
  );

  /* ——— ⋯: الملفّ · الإخفاء · الحظر ——— */
  const [menu, setMenu] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  /* 🆕 D-1382 — خلفيّةٌ واحدةٌ لكلِّ المحادثات، ومنتقيها من ⋯ */
  const chatBg = useChatBg();
  const [bgSheet, setBgSheet] = useState(false);
  /* 🆕 D-1385 — ارتفاعُ الترويسة: الملصقُ يبدأ تحتها مباشرةً (لا فراغ فوق ولا جزءَ مخفيٌّ خلفها) */
  const [headH, setHeadH] = useState(0);
  /* 🆕 D-1386 — ارتفاعُ خانة الكتابة **بلا لوحة مفاتيح وبسطرٍ واحد**: الملصقُ يُمطّ إلى حافّتها العليا، ولا يتبدّل مقاسُه كلّما
     فُتحت اللوحةُ أو طال النصّ (الحقلُ يكبر فوقه ويغطّيه — ولا يُعاد مطُّه تحت الإصبع) */
  const [dockH, setDockH] = useState(0);
  const [busy, setBusy] = useState(false);
  const name = displayNameOf(person, t.anonymousUser);
  const profile = person && !person.hide_name ? profileHref(person) : null;
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
  const kb = useKeyboardInset(rootRef);

  /* الأحدثُ أسفل: قائمةٌ مقلوبة — تبدأ من آخر ما قيل ويبقى تحت الإصبع حين يصل جديد.
     🆕 D-1401 — وفاصلُ يومٍ قبل أوّل رسالةٍ من كلِّ يوم («اليوم» · «أمس» · اسمُ اليوم · التاريخ)، بيوم الجهاز */
  const rows = useMemo<Row[]>(() => {
    if (!conv) return [];
    const out: Row[] = [];
    let day = "";
    for (const e of conv.events) {
      const k = dayKeyOf(e.created_at);
      if (k && k !== day) {
        day = k;
        out.push({ type: "day", key: `day-${k}`, label: dayLabelOf(k, t) });
      }
      out.push({ type: "ev", key: keyOf(e), e });
    }
    return out.reverse();
  }, [conv, t]);

  /* ——— 🆕 D-1401 — التحديد: الرسالةُ المؤقّتة (لم تصل الخادمَ) لا تُحدَّد ——— */
  const selecting = selected.length > 0;
  const startSelect = useCallback((e: MsgEvent) => {
    if (e.id.startsWith("tmp-")) return;
    haptic.pick();
    Keyboard.dismiss();
    setSelected((cur) => (cur.includes(keyOf(e)) ? cur : [...cur, keyOf(e)]));
  }, []);
  const toggleSelect = useCallback((e: MsgEvent) => {
    if (e.id.startsWith("tmp-")) return;
    haptic.pick();
    setSelected((cur) => (cur.includes(keyOf(e)) ? cur.filter((k) => k !== keyOf(e)) : [...cur, keyOf(e)]));
  }, []);
  const selectedEvents = useMemo(() => (conv ? conv.events.filter((e) => selected.includes(keyOf(e))) : []), [conv, selected]);
  /* خيطٌ تغيّر تحت التحديد (رسالةٌ أُخفيت) ⇒ يسقط ما لم يعد موجوداً */
  useEffect(() => {
    if (selected.length && selectedEvents.length !== selected.length) setSelected(selectedEvents.map(keyOf));
  }, [selected, selectedEvents]);
  const canCopy = selectedEvents.some((e) => !!copyableOf(e));
  /* الردُّ على رسالةٍ مباشرةٍ واحدة — الردودُ القديمة في خيوط الأعمال والبطاقاتُ لا يُقتبس منها (الهجرة ٢٠٣ على `direct_messages`) */
  const replyable = selectedEvents.length === 1 && selectedEvents[0].kind === "reply" && !!selectedEvents[0].dm ? selectedEvents[0] : null;
  const copySelected = useCallback(() => {
    const text = copyTextOf(selectedEvents, (mine) => (mine ? t.convYou : displayNameOf(person, t.anonymousUser)), t);
    if (!text) return;
    void Clipboard.setStringAsync(text)
      .then(() => {
        haptic.success();
        say(t.msgCopied, "success");
      })
      .catch(() => say(t.apiInternal));
    setSelected([]);
  }, [selectedEvents, person, t, say]);
  const beginReply = useCallback((e: MsgEvent) => {
    setSelected([]);
    setViewer(null);
    setReplyTo(e);
    /* الكتابةُ تبدأ فوراً كالواتس — بعد أن يُغلق العارضُ إن كان مفتوحاً */
    setTimeout(() => inputRef.current?.focus(), 250);
  }, []);

  /* ——— 🆕 D-1403 — لمسةُ الاقتباس تنزل إلى الأصل وتومضه ——— */
  const listRef = useRef<FlatList<Row>>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const jumpTo = useCallback(
    (id: string) => {
      const index = rows.findIndex((r) => r.type === "ev" && r.e.kind === "reply" && r.e.id === id);
      if (index < 0) return;
      listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
      setFlash(`reply-${id}`);
      setTimeout(() => setFlash((f) => (f === `reply-${id}` ? null : f)), 1400);
    },
    [rows],
  );
  const presence = presenceOf(seen.data?.last_seen, t, (iso) => timeAgo(iso, t));
  const canSend = (!!text.trim() || !!pic) && !(pic && !pic.path) && !sending;

  return (
    <View ref={rootRef} style={{ flex: 1, backgroundColor: tokens.bg }}>
      {/* 🆕 D-1382 — الخلفيّةُ تحت كلِّ شيء؛ الترويسةُ والحقلُ بسطحهما فوقها، والخيطُ شفّافٌ عليها */}
      <ChatBackdrop bg={chatBg} top={headH} bottom={dockH} />
      <View onLayout={(e) => setHeadH(Math.round(e.nativeEvent.layout.height))} style={{ paddingTop: insets.top, borderBottomWidth: 1, borderBottomColor: tokens.border, backgroundColor: tokens.bg }}>
        {selecting ? (
          /* 🆕 D-1401 — شريطُ التحديد مكانَ الترويسة كالواتس: رجوعٌ يلغي، والعدد، ثمّ «رد» و«نسخ» */
          <View style={{ height: 56, flexDirection: "row", alignItems: "center", paddingHorizontal: 8, gap: 4 }}>
            <Pressable onPress={() => setSelected([])} hitSlop={8} accessibilityRole="button" accessibilityLabel={t.msgSelectCancel} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
              <View style={{ transform: [{ rotate: I18nManager.isRTL ? "-90deg" : "90deg" }] }}>
                <Icon name="chevron-down" size={22} color={tokens.fg} />
              </View>
            </Pressable>
            <Text size={17} weight="700" accessibilityLabel={t.msgSelectedCount(selected.length)} style={{ flex: 1, paddingHorizontal: 4 }}>{String(selected.length)}</Text>
            {replyable ? (
              <Pressable onPress={() => beginReply(replyable)} hitSlop={6} accessibilityRole="button" accessibilityLabel={t.msgReply} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? tokens.surface2 : "transparent" })}>
                <Icon name="reply" size={21} color={tokens.fg} />
              </Pressable>
            ) : null}
            <Pressable onPress={copySelected} disabled={!canCopy} hitSlop={6} accessibilityRole="button" accessibilityLabel={t.msgCopy} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", opacity: canCopy ? 1 : 0.35, backgroundColor: pressed ? tokens.surface2 : "transparent" })}>
              <Icon name="copy" size={20} color={tokens.fg} />
            </Pressable>
          </View>
        ) : (
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
              <Avatar uri={person?.hide_name ? null : person?.avatar_url ?? null} size={34} />
              <View style={{ flexShrink: 1, minWidth: 0 }}>
                <Text size={14} weight="700" numberOfLines={1}>{person ? name : ""}</Text>
                {presence ? <Text size={12} muted numberOfLines={1}>{presence}</Text> : null}
              </View>
            </Pressable>
            {/* الشارةُ أختٌ للباب لا ابنةٌ له (D-773ب) */}
            {person && !person.hide_name ? <IdentityBadges flags={identityFlags(person)} nameSize={14} /> : null}
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
        )}
      </View>

      {!conv && person ? (
        /* 🆕 D-1380 — خيطٌ لم يبدأ: دعوةٌ لا فراغ، أو سطرُ الإغلاق حين لا يقبل صاحبُه رسائل */
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 6, padding: 24 }}>
          <Icon name={canMsg === false ? "lock" : "comment"} size={26} color={tokens.muted} />
          <Text size={14} weight="700" style={{ textAlign: "center" }}>{canMsg === false ? t.msgNotAcceptingOf(name) : t.convSayHi(name)}</Text>
          {canMsg === false ? null : <Text size={12} muted style={{ textAlign: "center" }}>{t.convSayHiSub}</Text>}
        </View>
      ) : !conv ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 }}>
          {q.isError || fresh.isError ? (
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
          inverted
          data={rows}
          keyExtractor={(r) => r.key}
          extraData={`${selected.join(",")}|${flash ?? ""}`}
          renderItem={({ item }) =>
            item.type === "day" ? (
              <DayChip label={item.label} />
            ) : (
              <Bubble
                e={item.e}
                peerName={name}
                selecting={selecting}
                selected={selected.includes(item.key)}
                flash={flash === item.key}
                onSelect={startSelect}
                onToggle={toggleSelect}
                onQuote={jumpTo}
                onTitle={doors.openTitle}
                onList={doors.openList}
                onImage={(e, image) => {
                  Keyboard.dismiss();
                  setViewer({ e, image });
                }}
                onImageFail={refreshLinks}
              />
            )
          }
          onScrollToIndexFailed={(info) => {
            /* الأصلُ خارجَ ما رُسم بعد: يُقرَّب بمتوسّط الارتفاع ثمّ يُعاد الطلب */
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

      {/* 🆕 D-1380 — الحقلُ في كلِّ محادثة، وفي خيطٍ لم يبدأ ما لم يقفل صاحبُه الخاص */}
      {conv || (person && canMsg !== false) ? (
        <ChatDock
          text={text}
          onText={setText}
          pic={pic}
          onClearPic={() => setPic(null)}
          quote={replyTo && replyRefOf(replyTo) ? <ReplyQuote r={replyRefOf(replyTo)!} peerName={name} onClear={() => setReplyTo(null)} /> : null}
          inputRef={inputRef}
          kb={kb}
          bottomInset={insets.bottom}
          sending={sending}
          canSend={canSend}
          onAttach={() => setAttach(true)}
          onSend={send}
          onRestingHeight={setDockH}
        />
      ) : null}

      {attach ? <AttachSheet onClose={() => setAttach(false)} onImage={() => void pickImage()} onGif={() => setGifOpen(true)} /> : null}
      {gifOpen ? <GifPicker onPick={sendGif} onClose={() => setGifOpen(false)} /> : null}
      {viewer ? (
        <PhotoViewer
          image={viewer.image}
          who={viewer.e.mine ? t.convYou : name}
          at={viewer.e.created_at}
          caption={viewer.e.kind === "reply" ? viewer.e.body : ""}
          onClose={() => setViewer(null)}
          onReply={viewer.e.kind === "reply" && viewer.e.dm && !viewer.e.id.startsWith("tmp-") && (conv || person) ? () => beginReply(viewer.e) : undefined}
          onToast={(m) => say(m)}
        />
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
          <Pressable
            onPress={() => {
              setMenu(false);
              setBgSheet(true);
            }}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 }}
          >
            <Icon name="palette" size={18} color={tokens.accent} />
            <Text size={15}>{t.chatBgTitle}</Text>
          </Pressable>
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

      {bgSheet ? (
        <ChatBgSheet
          onClose={() => setBgSheet(false)}
          onPlus={() => {
            setBgSheet(false);
            doors.openWeb("/plus");
          }}
        />
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

/** 🆕 D-1401 — فاصلُ اليوم: شارةٌ صغيرةٌ وسطَ الخيط فوق أوّل رسالةٍ منه */
export function DayChip({ label }: { label: string }) {
  const { tokens } = useApp();
  return (
    <View style={{ alignSelf: "center", marginVertical: 8, paddingHorizontal: 11, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: tokens.surface }}>
      <Text size={12} muted>{label}</Text>
    </View>
  );
}

/** 🆕 D-1401 — حالةُ رسالتي: ساعةٌ وهي تُرسل · ✓ وصلت الخادم · ✓✓ قرأها صاحبُها — ورسالةُ الطرف الآخر بلا علامة */
function tickOf(e: MsgEvent): "clock" | "check-line" | "check-double" | null {
  if (!e.mine) return null;
  if (e.id.startsWith("tmp-")) return "clock";
  if (typeof e.read !== "boolean") return null;
  return e.read ? "check-double" : "check-line";
}

/**
 * 🆕 D-1401 — الوقتُ في زاوية الفقاعة كالواتس: سطرٌ صغيرٌ باهت (١١ مقابل ١٤ للنصّ) في الزاوية السفلى من جهة نهاية
 * الكلام، **ويُحجز له مكانٌ في آخر سطرٍ** بمسافاتٍ لا تنكسر (`NBSP`) فلا يركب على النصّ؛ وإن لم يتّسع السطرُ نزلت
 * الكلمةُ الأخيرةُ ومسافاتُها معاً فصار الوقتُ تحتها.
 */
function Meta({ e, onDark, onAccent }: { e: MsgEvent; onDark?: boolean; onAccent: boolean }) {
  const { t, tokens } = useApp();
  const tick = tickOf(e);
  const ink = onDark ? "#fff" : onAccent ? tokens.onAccent : tokens.fg;
  const label = tick === "check-double" ? t.msgRead : tick === "check-line" ? t.msgDelivered : tick === "clock" ? t.msgSending : undefined;
  return (
    <View accessible accessibilityLabel={label ? `${clockOf(e.created_at, t)} · ${label}` : clockOf(e.created_at, t)} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
      <Text size={11} color={ink} style={{ opacity: onDark ? 0.95 : 0.55 }}>{clockOf(e.created_at, t)}</Text>
      {tick ? (
        <View style={{ opacity: onDark ? 0.95 : tick === "check-double" ? 1 : 0.55 }}>
          <Icon name={tick} size={tick === "clock" ? 11 : 14} color={ink} />
        </View>
      ) : null}
    </View>
  );
}
/** مكانُ الوقت في آخر السطر: عرضُ الساعة والعلامة بمسافاتٍ لا تنكسر */
function metaPad(e: MsgEvent, t: ReturnType<typeof useApp>["t"]): string {
  const n = Math.ceil(clockOf(e.created_at, t).length * 1.6) + (tickOf(e) ? 5 : 0) + 2;
  return "\u00A0".repeat(n);
}
/** جهةُ الوقت: نهايةُ الكلام — يسارُ العربيّ ويمينُ الإنجليزيّ أيّاً كانت لغةُ الواجهة (`start`/`end` منطقيّتان فتُقلبان في RTL) */
function metaSide(body: string): { end: number } | { start: number } {
  const rtl = firstStrongRtl(body) ?? I18nManager.isRTL;
  return rtl === I18nManager.isRTL ? { end: 10 } : { start: 10 };
}

/** 🆕 D-1407 — صورةٌ فشلت ⇒ المحادثةُ تُجلب بروابطَ موقَّعةٍ جديدة؛ مرّةً كلَّ عشر ثوانٍ مهما فشل من صور (لا عاصفةَ طلبات) */
let linksAt = 0;
function refreshLinks() {
  if (Date.now() - linksAt < 10_000) return;
  linksAt = Date.now();
  void queryClient.invalidateQueries({ queryKey: MESSAGES_KEY });
}

/** فقاعةٌ واحدة: عملٌ مُشارَك (بطاقة) · قائمة · ردٌّ نصّيّ — والملاحظةُ فقاعةٌ تحت البطاقة (`ConvBubble`) */
export function Bubble({
  e,
  peerName,
  selecting,
  selected,
  flash,
  onSelect,
  onToggle,
  onQuote,
  onTitle,
  onList,
  onImage,
  onImageFail,
}: {
  e: MsgEvent;
  peerName: string;
  selecting: boolean;
  selected: boolean;
  flash: boolean;
  onSelect: (e: MsgEvent) => void;
  onToggle: (e: MsgEvent) => void;
  onQuote: (id: string) => void;
  onTitle: (kind: "tv" | "movie", id: number) => void;
  onList: (id: string) => void;
  onImage: (e: MsgEvent, img: { url: string; key: string }) => void;
  /** صورةٌ لم تُرسم ⇒ روابطُ جديدةٌ للمحادثة (الرابطُ موقَّعٌ مؤقّت) */
  onImageFail: () => void;
}) {
  const { t, tokens } = useApp();
  /* نسبةُ الصورة من الصورة نفسِها حين تُحمَّل — قبلها ٤:٣ */
  const [ratio, setRatio] = useState(4 / 3);
  /*
   * 🆕 D-1407 (لقطةُ أحمد ١٥ أكتوبر، أوّلُ فتحٍ لبناء 82): صورتان بقيتا مربّعاً أسود — ذاكرةُ الصور مُسحت بعد التحديث
   * (`imageCacheGuard`) فنزلت الصورُ كلُّها معاً، وفشلت رسمةٌ ولم يكن بعدها شيء. الآن: الفشلُ الأوّلُ يطلب روابطَ جديدة ويعيد
   * المحاولة وحدَه، والثاني يُظهر «إعادة التحميل» مكانَ السواد — لمستُه تعيد الدورة.
   */
  const [fails, setFails] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const side = { alignSelf: e.mine ? ("flex-end" as const) : ("flex-start" as const), maxWidth: "80%" as const, marginVertical: 3 };
  /* 🆕 D-1401 — اللمسةُ في وضع التحديد تضيف/تزيل؛ والضغطةُ الطويلةُ تبدأ التحديد — على الفقاعة كلِّها وعلى بطاقاتها */
  const tap = (open: () => void) => () => (selecting ? onToggle(e) : open());
  const hold = () => onSelect(e);
  const quote =
    e.kind === "reply" && e.reply ? (
      <View style={{ marginBottom: 6 }}>
        <ReplyQuote r={e.reply} onAccent={e.mine} peerName={peerName} onPress={tap(() => e.reply && e.reply.kind !== "gone" && onQuote(e.reply.id))} />
      </View>
    ) : null;
  const textBubble = (body: string, withMeta: boolean, withQuote = false) => (
    <View style={{ borderRadius: 18, paddingHorizontal: 14, paddingTop: withQuote ? 6 : 7, paddingBottom: 7, backgroundColor: e.mine ? tokens.accent : tokens.surface2, alignSelf: e.mine ? "flex-end" : "flex-start", minWidth: withQuote ? 180 : undefined }}>
      {withQuote ? quote : null}
      <Text size={14} content color={e.mine ? tokens.onAccent : tokens.fg} style={{ lineHeight: 21 }}>{withMeta ? body + metaPad(e, t) : body}</Text>
      {withMeta ? (
        <View style={[{ position: "absolute", bottom: 6 }, metaSide(body)]}>
          <Meta e={e} onAccent={e.mine} />
        </View>
      ) : null}
    </View>
  );

  let inner: React.ReactNode;
  /* 🆕 D-1387 — GIF أو صورةٌ في إطارٍ بلون صاحبها (٣ حول الصورة)، والتعليقُ تحتها داخل الإطار؛ الصورةُ تُفتح بملء الشاشة */
  if (e.kind === "reply" && (e.gif_id || e.image)) {
    const img = e.image ?? null;
    const w = 234;
    inner = (
      <View style={[side, { maxWidth: w + 6 }]}>
        <Pressable
          onPress={tap(() => img && onImage(e, img))}
          onLongPress={hold}
          delayLongPress={300}
          accessibilityRole={img ? "imagebutton" : undefined}
          accessibilityLabel={img ? t.msgPickImage : "GIF"}
          style={{ padding: 3, borderRadius: 16, backgroundColor: e.mine ? tokens.accent : tokens.surface2 }}
        >
          {quote ? <View style={{ padding: 3, paddingBottom: 0, maxWidth: w }}>{quote}</View> : null}
          <View>
            {e.gif_id ? (
              <View style={{ width: 220, height: 165, borderRadius: 13, overflow: "hidden", backgroundColor: tokens.surface }}>
                <GifImage id={e.gif_id} />
              </View>
            ) : img ? (
              <View>
                <Image
                  key={`${img.key}:${attempt}`}
                  source={{ uri: img.url, cacheKey: img.key }}
                  onLoad={(ev) => {
                    const { width, height } = ev.source;
                    if (width > 0 && height > 0) setRatio(Math.max(0.6, Math.min(2, width / height)));
                    setFails(0);
                  }}
                  onError={() => {
                    setFails((n) => n + 1);
                    if (fails === 0) {
                      onImageFail();
                      setAttempt((a) => a + 1);
                    }
                  }}
                  style={{ width: w, aspectRatio: ratio, borderRadius: 13, backgroundColor: tokens.surface }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
                {fails >= 2 ? (
                  <Pressable
                    onPress={() => {
                      setFails(0);
                      onImageFail();
                      setAttempt((a) => a + 1);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t.msgImageReload}
                    style={{ position: "absolute", top: 0, bottom: 0, start: 0, end: 0, alignItems: "center", justifyContent: "center", gap: 6 }}
                  >
                    <Icon name="repeat" size={20} color={tokens.fg} />
                    <Text size={12} weight="700" color={tokens.fg}>{t.msgImageReload}</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            {/* بلا تعليق: الوقتُ على الصورة نفسِها في شريطٍ غامقٍ صغير — لا يصغّرها سطرٌ تحتها */}
            {!e.body ? (
              <View style={{ position: "absolute", bottom: 7, end: 7, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 9, backgroundColor: "rgba(0,0,0,0.5)" }}>
                <Meta e={e} onDark onAccent={false} />
              </View>
            ) : null}
          </View>
          {e.body ? (
            <View>
              <Text size={14} content color={e.mine ? tokens.onAccent : tokens.fg} style={{ lineHeight: 21, paddingHorizontal: 11, paddingTop: 6, paddingBottom: 6, maxWidth: w }}>
                {e.body + metaPad(e, t)}
              </Text>
              <View style={[{ position: "absolute", bottom: 6 }, metaSide(e.body)]}>
                <Meta e={e} onAccent={e.mine} />
              </View>
            </View>
          ) : null}
        </Pressable>
      </View>
    );
  } else if (e.kind === "reply") {
    inner = (
      <Pressable onPress={selecting ? () => onToggle(e) : undefined} onLongPress={hold} delayLongPress={300} style={side}>
        {textBubble(e.body, true, !!e.reply)}
      </Pressable>
    );
  } else {
    const card = (onPress: () => void, art: React.ReactNode, title: string, sub: string) => (
      <Pressable
        onPress={tap(onPress)}
        onLongPress={hold}
        delayLongPress={300}
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
    /* البطاقةُ بلا ملاحظة: الوقتُ سطرٌ صغيرٌ تحتها من جهة صاحبها */
    const tail = e.note ? (
      <Pressable onPress={selecting ? () => onToggle(e) : undefined} onLongPress={hold} delayLongPress={300}>
        {textBubble(e.note, true)}
      </Pressable>
    ) : (
      <View style={{ alignSelf: e.mine ? "flex-end" : "flex-start", paddingHorizontal: 6 }}>
        <Meta e={e} onAccent={false} />
      </View>
    );
    if (e.kind === "list") {
      inner = (
        <View style={[side, { gap: 4 }]}>
          {card(() => onList(e.list_id), art(<Icon name="list" size={15} color={tokens.muted} />), e.list_name ?? "—", e.item_count ? `${t.convListBadge} · ${t.personWorksCount(e.item_count)}` : t.convListBadge)}
          {tail}
        </View>
      );
    } else {
      const poster = posterFor(e.poster_path, 40);
      inner = (
        <View style={[side, { gap: 4 }]}>
          {card(
            () => onTitle(e.media_type, e.tmdb_id),
            art(poster ? <Image source={{ uri: poster }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" /> : <Icon name="film" size={13} color={tokens.muted} />),
            e.title ?? "—",
            e.media_type === "tv" ? t.typeSeries : t.typeMovie,
          )}
          {tail}
        </View>
      );
    }
  }
  /* 🆕 D-1401 — المحدَّدةُ يتلوّن سطرُها كلُّه كالواتس (لونُ التطبيق خفيفاً)؛ والأصلُ الذي نزل إليه الاقتباسُ يومض مثلَه */
  return (
    <Pressable
      onPress={selecting ? () => onToggle(e) : undefined}
      onLongPress={hold}
      delayLongPress={300}
      accessibilityState={selecting ? { selected } : undefined}
      style={{ marginHorizontal: -PAGE_PAD, paddingHorizontal: PAGE_PAD, paddingVertical: 2, backgroundColor: selected || flash ? `${tokens.accent}2e` : "transparent" }}
    >
      {inner}
    </Pressable>
  );
}
