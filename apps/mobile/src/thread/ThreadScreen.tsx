import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, FlatList, I18nManager, Keyboard, Platform, Pressable, ScrollView, Share, StyleSheet, type TextInput, View } from "react-native";
import Svg, { Defs, LinearGradient as SvgGradient, Rect, Stop } from "react-native-svg";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigationContainerRef, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isGuest, softGet, useGuestUpgrade, write } from "../api";
import { CONFIG } from "../config";
import { useApp } from "../state";
import { shell, type NativeRoot } from "../shell";
import { Button, Text, type ToastTone } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import { haptic } from "../haptics";
import { posterFor } from "../poster";
import { ToastHost, type ToastHostRef } from "../HoldHost";
import { IdentityBadges, identityFlags } from "../IdentityBadges";
import { Sheet } from "../library/Sheet";
import { afterPaint, span } from "../perfMarks";
import { errorText } from "../community/communityActs";
import { type Draft } from "./Composer";
import { ChatDock, useKeyboardInset, usePicUpload } from "../messages/chatDock";
import { ReplyQuote } from "../messages/ReplyQuote";
import { MentionList, useMentions } from "../messages/mentions";
import { Chip } from "../library/Chip";
import { SortCycle } from "../library/SortCycle";
import { airedEpisodes, episodeBulletin, episodeRoomRows, episodeStats, episodeTitle, generalRows, latestBulletin, talkEpisodeKey, type EpisodeRef, type EpisodeStat } from "@/core/talkEpisodes";
import { seasonQuery } from "../title/SeasonAccordion";
import { rememberRoom } from "./recentRooms";
import { Segmented } from "../library/ToolsSheet";
import { formatDateShort, timeAgoShort } from "@/core/when";
import type { PersonLite } from "@/core/people";
import type { SearchTitle } from "../contracts";
import { rememberGif } from "./GifPicker";
import { ReplyItem, TEMP } from "./ReplyItem";
import { backdropUrl } from "@/core/media";
import { num } from "@/core/i18n";
import { displayNameOf, profileHref } from "@/core/people";
import { stackAboveRoots } from "../nativeStack";
import { orderThread, orderTalk, buildTree, countUnder, canReplyTo, focusView, PEEK } from "@/core/threadOrder";
import type { ThreadPayload, ThreadRow, ThreadTarget, ThreadReplyResult, LikeBody, ToggleEpisodeBody, TrackResult } from "../contracts";
import { openProfile as pushProfile, profileHandleOf } from "../member/open";

/**
 * ====== «النقاش» أصليّاً — شاشةٌ واحدةٌ لثلاثة أبواب · Phase 11-M · M3 (خطّة §٣) ======
 *
 * 🔑 **غرفةُ العمل · منشورُ لوبز · الرأيُ** من حمولةٍ واحدة (`GET /api/v1/thread`) تقرؤها صفحاتُ الويب الثلاث نفسُها،
 * **وخيطٌ واحدٌ بقواعد `ThreadReplies`** (`core/threadOrder.ts` — الترتيبُ والشجرةُ والعمقُ ٣ في الطرفين): الغرفةُ
 * متداخلةٌ بالأصوات والقلوب والصورة والـGIF و«فيها حرق»؛ المنشورُ والرأيُ ردٌّ تحت الجذر. **والرابعُ (مراجعاتُ القائمة)
 * أصليٌّ منذ L2**. الويبُ يبقى صاحبَ الرابط العامّ ووصف البحث (D-221) — والمشاركةُ تشاركه.
 *
 * 🔑 **الكتابةُ تفاؤليّةٌ في الكاش** (نهجُ `communityActs`): الردُّ يُدرج باهتاً بمعرّفٍ مؤقّتٍ ثمّ يأخذ معرّفَه وصاحبَه
 * (D-241) · القلبُ والصوتُ ينقلبان فورَ اللمس (D-305) · الحذفُ يُسحب من مكانه (D-047) — **والفشلُ يُرجع ويقول السبب**
 * بالرسالة العابرة الواحدة. **والترتيبُ لا يتحرّك تحت الإصبع**: الأصواتُ تُعيد الترتيبَ في الفتحة التالية (D-008)،
 * والردُّ الجديدُ يقع في موضعه الزمنيّ كما في الويب.
 *
 * ⚖️ **الصندوقُ ورقةٌ وسطى لا حقلٌ تحت السطر** (حجّتُها في رأس `Composer`)، **و⋯ ورقةٌ سفليّةٌ لا قائمةٌ منسدلة** —
 * الورقةُ الواحدةُ في التطبيق (القاعدة ٣).
 */
export type ThreadRoute =
  | { t: "talk"; kind: "tv" | "movie"; id: number }
  | { t: "post"; key: string }
  | { t: "review"; kind: "tv" | "movie"; id: number; user: string };

export const threadKey = (r: ThreadRoute) =>
  (r.t === "post" ? ["thread", "post", r.key] : r.t === "talk" ? ["thread", "talk", r.kind, r.id] : ["thread", "review", r.kind, r.id, r.user]) as readonly unknown[];

/** 🆕 1.12.7 — الاستعلامُ الواحد: الشاشةُ وبابُها (`openThreadPath` يبدأ الجلبَ قبل الدفع) يطلبان بالمفتاح والدالّة نفسيهما */
export const threadQuery = (r: ThreadRoute) => ({
  queryKey: threadKey(r),
  /* 🆕 R53 — **الغرفةُ لا تنتظر الجلسة** (فيديو أحمد ٢١ أكتوبر: بعد إقفال التطبيق «الدخول للنقاش جدا طوّل .. مره يطول مره لا»):
     علاماتُ جواله في الدقيقة نفسِها — `token.wait=21139 why=noack` ثمّ `thread.open=3319`: الشاشةُ انتظرت ٢١ ثانيةً رمزاً لم يصل
     (تجديدٌ علق على أوّل اتّصال، ثمّ جسرٌ لم يردّ). والنقاشُ عامٌّ يقرؤه الزائر: **`softGet`** (D-1141) يجلبه زائراً فوراً،
     و`useGuestUpgrade` يعيد الجلبَ لحظةَ يصل الرمز. وردُّ الزائر آمنٌ للحرق: لا حلقاتٍ مشاهَدة ⇒ كلُّ غرفةِ حلقةٍ مغطّاة */
  queryFn: async () => softGet<ThreadPayload>(`/api/v1/thread?${query(r)}`),
  staleTime: 30_000,
});

function query(r: ThreadRoute): string {
  if (r.t === "post") return `t=post&key=${encodeURIComponent(r.key)}`;
  if (r.t === "talk") return `t=talk&kind=${r.kind}&id=${r.id}`;
  return `t=review&kind=${r.kind}&id=${r.id}&user=${r.user}`;
}

function targetOf(r: ThreadRoute): ThreadTarget {
  if (r.t === "post") return { kind: "post", key: r.key };
  if (r.t === "talk") return { kind: "talk", tmdb_id: r.id, media_type: r.kind };
  return { kind: "review", user_id: r.user, tmdb_id: r.id, media_type: r.kind };
}

type Item =
  | { type: "row"; row: ThreadRow; depth: number; indented: boolean; toName: string | null; link?: "up" | "down" | null; open?: boolean }
  | { type: "more"; rootId: string; rest: number }
  /* 🆕 R55 — صفحةُ السطر: «ردّاً على فلان» فوقه، وعنوانُ قسم ردوده، و«عرض رد آخر» تحت ردِّ صاحبها */
  | { type: "parent"; row: ThreadRow }
  | { type: "heading"; count: number }
  | { type: "author-more"; parentId: string };

/**
 * 🆕 M3-fix — **ذاكرةُ الغرفة عند الخروج إلى بابٍ ويبيّ** (أحمد: «المفترض يرجعني مكان ما كنت بالضبط»): الشاشةُ تُنزَل
 * لتظهر الصفحة ثمّ تُدفع ثانيةً عند العودة (`nativeStack.ts`)، فحالتُها تُحفظ هنا لا في الشاشة. تُكتب عند الخروج
 * وتُستهلك في التركيب التالي، **وتشيخ بعد عشر دقائق** — فتحٌ لاحقٌ للغرفة نفسِها من مكانٍ آخر يبدأ من أعلاها.
 */
const threadView = new Map<string, { y: number; toggled: string[]; expanded: string[]; at: number }>();
const VIEW_TTL_MS = 10 * 60_000;

export function ThreadScreen({ route, from, compose = false, focus = null }: { route: ThreadRoute; from: NativeRoot | "web"; compose?: boolean; focus?: string | null }) {
  const { t, tokens } = useApp();
  const router = useRouter();
  const nav = useNavigationContainerRef();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const key = useMemo(() => threadKey(route), [route]);
  const q = useQuery({ ...threadQuery(route), queryKey: key });
  const d = q.data ?? null;
  const guest = isGuest(d);
  const up = useGuestUpgrade(guest, q.refetch);
  /* 🆕 D-1495/D-1496 — نقاشُ الحلقات (أحمد ٢٠ أكتوبر): الحلقةُ المختارة (`null` = «الكل» — والغرفةُ تفتح عليها: «خليها الكل»)،
     وترتيبُ «الأحدث ⌄»، ومفتاحُ «حرق الأحداث». حالةُ عرضٍ في الشاشة — التصفيةُ في اليد والخيطُ كاملٌ من الخادم */
  const [pick, setPick] = useState<EpisodeRef | null>(null);
  const [talkSort, setTalkSort] = useState<"latest" | "active">("latest");
  const [revealAll, setRevealAll] = useState(false);
  /* 🆕 D-1508 — **«عام» و«الحلقات»** (أحمد ٢١ أكتوبر): المسلسلُ وحدَه بمستويين — «عام» كلامُ الناس عنه كلِّه، و«الحلقات»
     قائمةٌ تفتح غرفةَ كلِّ حلقة (`pick`). منتقيا الموسم والحلقة (D-1495) سقطا: القائمةُ نفسُها هي المنتقي، والفيلمُ بلا تبويب */
  const [tab, setTab] = useState<"general" | "episodes">("general");
  const [epSeason, setEpSeason] = useState<number | null>(null);

  /* `thread.open`: من التركيب إلى أوّل رسمٍ فيه حمولة — `cached` يفصل الكاش عن الشبكة (نهجُ `community.open`) */
  const [endOpen] = useState(() => span("thread.open", { cached: qc.getQueryData(key) ? 1 : 0, screen: route.t }));
  const opened = useRef(false);
  useEffect(() => {
    if (!d || opened.current) return;
    opened.current = true;
    afterPaint(() => endOpen());
  }, [d, endOpen]);
  /* 🆕 R56 — «زرتها مؤخراً» في بحث «Discussions»: الغرفةُ نفسُها لا صفحاتُ أسطرها */
  const remembered = useRef(false);
  useEffect(() => {
    if (!d || remembered.current || route.t !== "talk" || focus) return;
    remembered.current = true;
    rememberRoom({ kind: route.kind, id: route.id, title: d.work.title, poster: d.work.poster_path });
  }, [d, route, focus]);

  const toastHost = useRef<ToastHostRef>(null);
  /* D-1326 — النغمةُ تُعلَن حيث يُعرف المعنى: نجاحٌ أخضر · معلومةٌ محايدة · والغائبُ خطأٌ كما كان */
  const say = useCallback((text: string, tone?: ToastTone) => toastHost.current?.say(text, undefined, undefined, tone), []);
  const fail = useCallback((e: unknown) => say(errorText(t, e)), [say, t]);

  /* ——— 🆕 D-1443 — خانةُ الرسائل في النقاش (أحمد ١٦ أكتوبر: «كل المزايا اللي عملناها في الرسائل الخاصة اعملها في المناقشات حتى
     طريقة الكيبورد»، «١ أ»): الحقلُ ثابتٌ تحت الغرفة بدل الورقة الوسطى وزرِّ ✎ (D-1032 منقوض)، و«+» يفتح لوحةً مكانَ لوحة
     المفاتيح (صورة · GIF · بحث لوبز) والحقلُ يصير بحثَها، و«رد» يضع «ردّاً على فلان» فوقه، و`@` يكمل أسماءَ من كتبوا هنا ——— */
  const rootRef = useRef<View>(null);
  const kb = useKeyboardInset(rootRef);
  const inputRef = useRef<TextInput>(null);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<ThreadRow | null>(null);
  const [spoiler, setSpoiler] = useState(false);
  const [attach, setAttach] = useState(false);
  const attachRef = useRef(false);
  attachRef.current = attach;
  const closeAttach = useCallback(() => setAttach(false), []);
  const toggleAttach = useCallback(() => {
    if (attachRef.current) {
      setAttach(false);
      inputRef.current?.focus();
    } else {
      Keyboard.dismiss();
      setAttach(true);
    }
  }, []);
  const { pic, setPic, pickImage } = usePicUpload(say, { thread: true });
  const pickRef = useRef<EpisodeRef | null>(null);
  pickRef.current = pick;

  /* ——— الملاحة ——— */
  const back = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/web");
  }, [router]);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      /* 🆕 D-1443 — لوحةُ «+» مفتوحة ⇒ الرجوعُ يغلقها أوّلاً (كالرسائل) */
      if (attachRef.current) {
        setAttach(false);
        return true;
      }
      /* 🆕 D-1508 — غرفةُ حلقةٍ مفتوحة ⇒ الرجوعُ إلى قائمة «الحلقات» لا خروجٌ من النقاش */
      if (pickRef.current) {
        setPick(null);
        return true;
      }
      back();
      return true;
    });
    return () => sub.remove();
  }, [back]);
  const leave = useCallback(() => {
    if (router.canDismiss()) router.dismissAll();
    else router.replace("/web");
  }, [router]);
  const [leaving, setLeaving] = useState(false);
  const openWeb = useCallback(
    (path: string) => {
      /* 🆕 11-N · N1 — ملفُّ الشخص أصليٌّ: رابطُه لا يفتح الويب (`member/open.ts`) */
      { const who = profileHandleOf(path); if (who) return pushProfile(router, who, from); }
      if (leaving) return;
      setLeaving(true);
      /* M3-fix — موضعُ القراءة والشجرةُ المفتوحة تُحفظ، وما فوق الجذر يُلتقط، فالرجوعُ من الصفحة يعيد الغرفةَ كما تُركت */
      threadView.set(JSON.stringify([key, focus]), { y: scrollY.current, toggled: [...openNow.current.toggled], expanded: [...openNow.current.expanded], at: Date.now() });
      const resume = from === "web" ? undefined : stackAboveRoots(nav.getRootState());
      void shell.open(path, from === "web" ? undefined : { returnTo: from, resume }).then((layered) => {
        setLeaving(false);
        /* 🆕 K3b — ظهرت طبقةً فوق الغرفة ⇒ الغرفةُ تبقى تحتها (موضعُ القراءة حيٌّ لا يُستعاد) */
        if (layered) return;
        /* 🔴 M3-fix — **تُنزَل الشاشاتُ كلُّها لا هذه وحدَها** (بلاغُ خالد بتسجيل ٢٨ سبتمبر: صورةُ الشخص في غرفةٍ فُتحت
           من «المجتمع» أعادته إلى «المجتمع» لا إلى ملفّه). الـWebView جذرُ المكدّس (D-1075)، والغرفةُ من جذرٍ فوق
           مجموعة التبويبات لا فوق الويب — `back()` كان يكشف «المجتمع» والصفحةُ فُتحت تحته لا تُرى. والعودةُ من الملفّ
           إلى الجذر بـ`returnTo` كما في كلِّ باب. */
        leave();
      });
    },
    [leaving, from, leave, key, nav, router, focus],
  );
  const openTitle = useCallback(() => {
    if (!d) return;
    router.push({ pathname: "/title/[kind]/[id]", params: { kind: d.work.media_type, id: String(d.work.tmdb_id), from: from === "web" ? "web" : from } });
  }, [router, d, from]);
  /* 🆕 R55 — صفحةُ السطر شاشةٌ فوق الغرفة (`?r=`)، فالرجوعُ خطوةٌ واحدة كتويتر؛ والمفتاحُ واحدٌ فالصفحةُ ترسم من الكاش فوراً */
  const openRow = useCallback(
    (row: ThreadRow) => {
      if (route.t !== "talk" || row.id === focus) return;
      haptic.pick();
      /* 🆕 R56 — المراجعةُ تُفتح في صفحتها (ردودُها هناك؛ أحمد: «اذا كتبت ف نقاش العمل لا يظهر في ريفيو») */
      if (row.review) {
        router.push({ pathname: "/review/[kind]/[id]/[user]", params: { kind: route.kind, id: String(route.id), user: row.review.user_id, from: from === "web" ? "web" : from } });
        return;
      }
      router.push({ pathname: "/talk/[kind]/[id]", params: { kind: route.kind, id: String(route.id), r: row.id, from: from === "web" ? "web" : from } });
    },
    [route, focus, router, from],
  );
  const share = useCallback(() => {
    if (!d) return;
    const url = `${CONFIG.apiBase}${d.share_path}`;
    void Share.share({ message: `${d.work.title} — ${url}`, url }).catch(() => {});
  }, [d]);

  /* ——— الكاش: كلُّ فعلٍ يعدّل الحمولةَ ويُرجعها عند الفشل ——— */
  const patch = useCallback((fn: (p: ThreadPayload) => ThreadPayload) => qc.setQueryData<ThreadPayload>(key, (p) => (p ? fn(p) : p)), [qc, key]);
  const patchRow = useCallback((id: string, fn: (r: ThreadRow) => ThreadRow) => patch((p) => ({ ...p, rows: p.rows.map((r) => (r.id === id ? fn(r) : r)) })), [patch]);
  const busy = useRef(new Set<string>());

  /* ——— الشجرة ——— */
  /* 🆕 M3-fix — عودةٌ من بابٍ ويبيّ (ملفُّ شخص): الشجرةُ كما تُركت وموضعُ القراءة نفسُه — تُستهلك الذاكرةُ مرّةً */
  const [restored] = useState(() => {
    const k = JSON.stringify([key, focus]);
    const v = threadView.get(k);
    threadView.delete(k);
    return v && Date.now() - v.at < VIEW_TTL_MS ? v : null;
  });
  const [toggled, setToggled] = useState<ReadonlySet<string>>(() => new Set(restored?.toggled));
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(restored?.expanded));
  /* يقرؤه `openWeb` (معرَّفٌ فوق) لحظةَ الخروج — مرجعٌ لا تبعيّة، فلا يُعاد بناءُ الباب مع كلِّ طيّ */
  const openNow = useRef({ toggled, expanded });
  openNow.current = { toggled, expanded };
  const listRef = useRef<FlatList<Item>>(null);
  const scrollY = useRef(0);
  const pendingY = useRef(restored && restored.y > 0 ? restored.y : null);
  const restoreTo = useCallback((contentH: number) => {
    const y = pendingY.current;
    if (y == null || contentH < y) return;
    pendingY.current = null;
    listRef.current?.scrollToOffset({ offset: y, animated: false });
  }, []);
  const nested = !!d?.nested;
  /* 🆕 D-1508 — مسلسلٌ في غرفته ⇒ المستويان؛ والحلقاتُ التي شاهدها القارئ تقرّر الغطاء والقفل */
  const tvTalk = d?.head.kind === "talk" && d.work.media_type === "tv" && (d.head.seasons ?? []).length > 0;
  const watchedEps = useMemo(() => new Set(d?.head.kind === "talk" ? d.head.watched_eps ?? [] : []), [d]);
  const epList = tvTalk && tab === "episodes" && !pick;
  const unwatchedRoom = !!pick && !watchedEps.has(talkEpisodeKey(pick.season, pick.episode));
  const { items, tree, nameOf, postCount } = useMemo(() => {
    const talk = d?.head.kind === "talk";
    const base = d ? (talk ? (tvTalk ? (pick ? episodeRoomRows(d.rows, pick) : tab === "general" ? generalRows(d.rows) : []) : d.rows) : d.rows) : [];
    const rows = d ? (talk ? orderTalk(base, talkSort) : orderThread(base, { votes: d.has_votes, plusFirst: !d.has_votes && d.head.kind === "review" })) : [];
    const tr = buildTree(rows, nested);
    const names = new Map(rows.map((r) => [r.id, displayNameOf(r.person, t.anonymousUser)]));
    const isOpen = (id: string) => {
      const auto = (tr.kids.get(id) ?? []).some((c) => c.mine);
      return toggled.has(id) ? !auto : auto;
    };
    const branch = (parent: string, top: string, out: { r: ThreadRow; toName: string | null }[] = []) => {
      for (const c of tr.kids.get(parent) ?? []) {
        out.push({ r: c, toName: c.parent_id === top ? null : names.get(c.parent_id ?? "") ?? null });
        if (isOpen(c.id)) branch(c.id, top, out);
      }
      return out;
    };
    const out: Item[] = [];
    /* 🆕 R55 — **صفحةُ السطر** (أحمد ٢١ أكتوبر، «١ أ»): السطرُ نفسُه، ثمّ ردودُه المباشرةُ بترتيب الغرفة، وتحت كلٍّ منها أوّلُ ردٍّ
       لصاحب الصفحة موصولاً بخطّ و«عرض رد آخر» إن زاد (`focusView`). الحمولةُ حمولةُ الغرفة نفسُها (المفتاحُ واحد)، فلا جلبَ ثانياً */
    if (nested && focus && d) {
      const all = buildTree(d.rows, true);
      const fv = focusView(d.rows, focus, (r) => r.person.id, talkSort);
      if (fv.focus) {
        /* النشرةُ أبٌ تقنيٌّ لمنشور الحلقة (`episodeRoomRows` يرفعه جذراً) — فلا «ردّاً على» فوقه */
        if (fv.parent && !fv.parent.bulletin) out.push({ type: "parent", row: fv.parent });
        out.push({ type: "row", row: fv.focus, depth: all.depth.get(fv.focus.id) ?? 0, indented: false, toName: null });
        if (fv.count) out.push({ type: "heading", count: fv.count });
        for (const x of fv.items) {
          if (x.kind === "more") out.push({ type: "author-more", parentId: x.parentId });
          else out.push({ type: "row", row: x.row, depth: all.depth.get(x.row.id) ?? 1, indented: false, toName: null, link: x.link, open: true });
        }
      }
      return { items: out, tree: all, nameOf: new Map(d.rows.map((r) => [r.id, displayNameOf(r.person, t.anonymousUser)])), postCount: 0 };
    }
    /* 🆕 R55 — والغرفةُ **جذورٌ وحدَها** بعدد ما تحتها؛ الفروعُ المطويّةُ و«عرض N ردود» سقطت إلى صفحة كلِّ سطر */
    if (nested) {
      for (const r of tr.roots) out.push({ type: "row", row: r, depth: 0, indented: false, toName: null, open: true });
      return { items: out, tree: tr, nameOf: names, postCount: base.filter((r) => !r.bulletin).length };
    }
    for (const r of tr.roots) {
      out.push({ type: "row", row: r, depth: 0, indented: false, toName: !nested && r.parent_id ? names.get(r.parent_id) ?? null : null });
      if (!nested || !isOpen(r.id)) continue;
      const flat = branch(r.id, r.id);
      const shown = expanded.has(r.id) ? flat : flat.slice(0, PEEK);
      for (const x of shown) out.push({ type: "row", row: x.r, depth: tr.depth.get(x.r.id) ?? 1, indented: true, toName: x.toName });
      if (flat.length > shown.length) out.push({ type: "more", rootId: r.id, rest: flat.length - shown.length });
    }
    return { items: out, tree: tr, nameOf: names, postCount: base.filter((r) => !r.bulletin).length };
  }, [d, nested, toggled, expanded, t.anonymousUser, pick, talkSort, tvTalk, tab, focus]);
  const toggle = useCallback((id: string) => {
    haptic.pick();
    setToggled((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  /* ——— الأفعال على السطر ——— */
  const like = useCallback(
    (row: ThreadRow) => {
      const k = `like:${row.id}`;
      if (busy.current.has(k)) return;
      busy.current.add(k);
      haptic.pick();
      const was = row.liked_by_me;
      const set = (on: boolean) => patchRow(row.id, (r) => ({ ...r, liked_by_me: on, likes: Math.max(0, r.likes + (on ? 1 : -1)) }));
      set(!was);
      /* 🆕 R56 — مراجعةُ صفحة العمل: قلبُها قلبُ المراجعة نفسِها (المسارُ الذي تكتبه صفحتُها) لا جدولُ المنشورات */
      const req = row.review && d
        ? write("/api/v1/community/like", { target: "review", user_id: row.review.user_id, tmdb_id: d.work.tmdb_id, media_type: d.work.media_type, on: !was } satisfies LikeBody)
        : write("/api/v1/thread/like", { post_id: row.id, on: !was });
      req
        .catch((e: unknown) => {
          set(was);
          fail(e);
        })
        .finally(() => busy.current.delete(k));
    },
    [patchRow, fail, d],
  );
  const vote = useCallback(
    (row: ThreadRow, v: -1 | 0 | 1) => {
      if (route.t !== "talk") return;
      const k = `vote:${row.id}`;
      if (busy.current.has(k)) return;
      busy.current.add(k);
      haptic.pick();
      const was = row.my_vote;
      const set = (to: -1 | 0 | 1, from0: -1 | 0 | 1) => patchRow(row.id, (r) => ({ ...r, my_vote: to, score: r.score + to - from0 }));
      set(v, was);
      write("/api/v1/thread/vote", { post_id: row.id, vote: v, tmdb_id: route.id, media_type: route.kind })
        .catch((e: unknown) => {
          set(was, v);
          fail(e);
        })
        .finally(() => busy.current.delete(k));
    },
    [route, patchRow, fail],
  );

  /* ——— الكتابة ——— */
  /**
   * 🆕 N2-fix — **«تعليق» يفتح حقلَ الكتابة لا الخيطَ وحدَه** (أحمد ٢٩ سبتمبر: «ضغطت كومنت.. وداني صفحة ولا أعتقد أقدر أكتب فيها»):
   * زرُّ ✎ العائم كان البابَ الوحيد، ولا يُرى أنّه للكتابة. من جاء بـ`compose` يجد الحقلَ مفتوحاً مرّةً حين يصل الخيط.
   */
  const composeOnce = useRef(compose);
  const send = useCallback(
    async (parent: ThreadRow | null, draft: Draft): Promise<boolean> => {
      if (!d) return false;
      const temp = `${TEMP}${Date.now()}`;
      const me = d.viewer.me;
      const row: ThreadRow = {
        id: temp,
        person: { id: d.viewer.me_id ?? "", nickname: me?.name ?? null, username: null, avatar_url: me?.avatar ?? null, hide_name: !me },
        parent_id: parent?.id ?? null,
        body: draft.body,
        created_at: new Date().toISOString(),
        mine: true,
        bulletin: null,
        bulletin_vote: null,
        bulletin_spoiler: null,
        has_spoiler: nested && draft.spoiler,
        image: nested ? draft.image : null,
        gif_id: nested ? draft.gif : null,
        ...(nested && draft.share ? { share: draft.share } : {}),
        translated: null,
        likes: 0,
        liked_by_me: false,
        score: 0,
        my_vote: 0,
        /* 🆕 D-1495 — الردُّ يرث حلقةَ أصله، والمشاركةُ الجديدةُ حلقةَ المنتقي — فيبقى السطرُ المتفائلُ في التصفية الحاليّة */
        season: parent ? parent.season ?? null : pick?.season ?? null,
        episode: parent ? parent.episode ?? null : pick?.episode ?? null,
      };
      patch((p) => ({ ...p, rows: [...p.rows, row] }));
      try {
        const r = await write<ThreadReplyResult>("/api/v1/thread/reply", {
          target: targetOf(route),
          body: draft.body,
          parent_id: parent?.id ?? null,
          has_spoiler: row.has_spoiler,
          image_url: row.image,
          gif_id: row.gif_id,
          ...(row.share ? { share: row.share } : {}),
          ...(route.t === "talk" && !parent && pick ? { season: pick.season, episode: pick.episode } : {}),
        });
        if (r) {
          patchRow(temp, (x) => ({ ...x, id: r.reply_id, created_at: r.created_at, person: { ...x.person, ...r.author } }));
        } else {
          patch((p) => ({ ...p, rows: p.rows.filter((x) => x.id !== temp) }));
        }
        if (row.gif_id) rememberGif(row.gif_id);
        haptic.success();
        return true;
      } catch (e) {
        patch((p) => ({ ...p, rows: p.rows.filter((x) => x.id !== temp) }));
        fail(e);
        return false;
      }
    },
    [d, nested, route, patch, patchRow, fail, pick],
  );

  /* 🆕 R55 — في صفحة السطر الكتابةُ ردٌّ عليه ما لم يُختر غيرُه؛ وسطرٌ بلغ العمقَ ٣ (حارسُ القاعدة `title_posts_depth`) يُردّ
     على أبيه — أقربُ سطرٍ فوقه يقبل الردّ — فلا تصير الكتابةُ منشوراً في الغرفة من صفحة ردّ */
  const focusTarget = useMemo(() => {
    if (!focus || !nested || !d) return null;
    const byId = new Map(d.rows.map((r) => [r.id, r]));
    let cur = byId.get(focus) ?? null;
    while (cur && !canReplyTo(cur, tree.depth.get(cur.id) ?? 0, true)) cur = cur.parent_id ? byId.get(cur.parent_id) ?? null : null;
    return cur;
  }, [focus, nested, d, tree]);
  const target = replyTo ?? focusTarget;
  /* 🆕 D-1443 — «أرسل» من الخانة: متفائلٌ (الحقلُ يُفرغ فوراً)، والفشلُ يعيد النصَّ والصورةَ والاقتباس */
  const [sending, setSending] = useState(false);
  const sendDock = useCallback(() => {
    const body = text.trim();
    if ((!body && !pic?.path) || (pic && !pic.path) || sending) return;
    const was = { text, pic, replyTo, spoiler, target };
    setText("");
    setPic(null);
    setReplyTo(null);
    setSpoiler(false);
    setSending(true);
    void send(was.target, { body, spoiler: was.spoiler, image: was.pic?.path ?? null, gif: null }).then((ok) => {
      setSending(false);
      if (ok) return;
      setText((cur) => cur || was.text);
      setPic((cur) => cur ?? was.pic);
      setReplyTo((cur) => cur ?? was.replyTo);
      setSpoiler(was.spoiler);
    });
  }, [text, pic, replyTo, spoiler, sending, send, setPic, target]);
  /* الـGIF والعملُ يُرسلان بلمستهما (كالرسائل)، ردّاً على المقتبَس إن كان — وما في الحقل يبقى لرسالةٍ بعده */
  const sendGif = useCallback(
    (id: string) => {
      const parent = replyTo;
      setReplyTo(null);
      void send(parent ?? focusTarget, { body: "", spoiler: false, image: null, gif: id }).then((ok) => {
        if (!ok) setReplyTo((cur) => cur ?? parent);
      });
    },
    [replyTo, send, focusTarget],
  );
  const sendTitle = useCallback(
    (r: SearchTitle) => {
      const parent = replyTo;
      setReplyTo(null);
      const share = { media_type: r.mediaType, tmdb_id: r.id, title: r.title, poster_path: r.posterPath ?? null };
      void send(parent ?? focusTarget, { body: "", spoiler: false, image: null, gif: null, share }).then((ok) => {
        if (!ok) setReplyTo((cur) => cur ?? parent);
      });
    },
    [replyTo, send, focusTarget],
  );
  const beginReply = useCallback((row: ThreadRow) => {
    if (row.review) return openRow(row);
    haptic.pick();
    setReplyTo(row);
    setAttach(false);
    setTimeout(() => inputRef.current?.focus(), 120);
  }, [openRow]);
  /* المنشن: من كتب هنا (غيري)، بلا تكرار */
  const people = useMemo(() => {
    const seen = new Map<string, PersonLite>();
    for (const r of d?.rows ?? []) if (!r.mine && !r.bulletin && r.person.username && !seen.has(r.person.id)) seen.set(r.person.id, r.person);
    return [...seen.values()];
  }, [d?.rows]);
  const { names: mentionNames, hits: mentionHits, pick: pickMention } = useMentions(text, setText, people, inputRef);

  /* ——— ⋯: احذف ردّي · إبلاغ ——— */
  const [menu, setMenu] = useState<ThreadRow | null>(null);
  const [reported, setReported] = useState<ReadonlySet<string>>(() => new Set());
  const remove = useCallback(
    (row: ThreadRow) => {
      const snapshot = qc.getQueryData<ThreadPayload>(key);
      patch((p) => ({ ...p, rows: p.rows.filter((x) => x.id !== row.id) }));
      write("/api/v1/thread/delete", { target: targetOf(route), reply_id: row.id }).catch((e: unknown) => {
        if (snapshot) qc.setQueryData(key, snapshot);
        fail(e);
      });
    },
    [qc, key, patch, route, fail],
  );
  const report = useCallback(
    (body: { reply_id?: string; what?: "reply" | "review" }, mark: string) => {
      setReported((s) => new Set(s).add(mark));
      write("/api/v1/thread/report", { target: targetOf(route), ...body })
        .then(() => say(t.reportDone, "success"))
        .catch(fail);
    },
    [route, say, t.reportDone, fail],
  );

  /* ——— رأسُ المنشور والرأي: القلب ——— */
  const likeHead = useCallback(() => {
    if (!d || (d.head.kind !== "post" && d.head.kind !== "review")) return;
    if (busy.current.has("head")) return;
    busy.current.add("head");
    haptic.pick();
    const h = d.head;
    const was = h.liked_by_me;
    const set = (on: boolean) =>
      patch((p) => (p.head.kind === "post" || p.head.kind === "review" ? { ...p, head: { ...p.head, liked_by_me: on, likes: Math.max(0, p.head.likes + (on ? 1 : -1)) } } : p));
    set(!was);
    const body: LikeBody =
      h.kind === "post"
        ? { target: "post", tmdb_id: d.work.tmdb_id, media_type: d.work.media_type, on: !was }
        : { target: "review", user_id: h.author.id, tmdb_id: d.work.tmdb_id, media_type: d.work.media_type, on: !was };
    write("/api/v1/community/like", body)
      .catch((e: unknown) => {
        set(was);
        fail(e);
      })
      .finally(() => busy.current.delete("head"));
  }, [d, patch, fail]);

  const [image, setImage] = useState<string | null>(null);
  const openProfile = useCallback(
    (p: { username: string | null; hide_name: boolean; id: string; nickname: string | null; avatar_url: string | null }) => {
      const path = profileHref(p);
      if (path) openWeb(path);
    },
    [openWeb],
  );

  /* ——— الرسم ——— */
  const signedIn = !!d?.viewer.signed_in;
  useEffect(() => {
    if (!composeOnce.current || !d || !signedIn) return;
    composeOnce.current = false;
    /* من جاء بـ`compose` («اكتب ردك» من إشعار) يجد الحقلَ مركَّزاً */
    setTimeout(() => inputRef.current?.focus(), 250);
  }, [d, signedIn]);
  const renderItem = useCallback(
    ({ item }: { item: Item }) => {
      if (item.type === "parent") {
        const pr = item.row;
        const snippet = (pr.body || "").replace(/\s+/g, " ").trim();
        return (
          <Pressable onPress={() => openRow(pr)} accessibilityRole="link" style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 12 }}>
            <Icon name="comment" size={14} color={tokens.muted} />
            <Text size={13} muted numberOfLines={1} style={{ flexShrink: 1 }}>
              {t.talkReplyingTo(nameOf.get(pr.id) ?? "")}
              {snippet && !pr.has_spoiler && !(pr.season != null && pr.episode != null && !watchedEps.has(talkEpisodeKey(pr.season, pr.episode))) ? `: «${snippet.slice(0, 80)}»` : ""}
            </Text>
          </Pressable>
        );
      }
      if (item.type === "heading") {
        return (
          <View style={{ paddingTop: 16, paddingBottom: 4 }}>
            <Text size={13} weight="700" muted>{t.talkRepliesHeading(item.count)}</Text>
          </View>
        );
      }
      if (item.type === "author-more") {
        const pr = d?.rows.find((x) => x.id === item.parentId);
        return (
          <Pressable
            onPress={() => pr && openRow(pr)}
            style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingStart: 42, borderBottomWidth: 1, borderBottomColor: tokens.divider }}
          >
            <Text size={12} weight="700" color={tokens.accent}>{t.talkMoreReplies(1)}</Text>
          </Pressable>
        );
      }
      if (item.type === "more") {
        return (
          <Pressable
            onPress={() => {
              haptic.pick();
              setExpanded((s) => new Set(s).add(item.rootId));
            }}
            style={{ marginStart: 20, paddingStart: 12, borderStartWidth: 1, borderStartColor: tokens.divider, flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10 }}
          >
            <Icon name="comment" size={16} color={tokens.accent} />
            <Text size={12} weight="700" color={tokens.accent}>{t.talkMoreReplies(item.rest)}</Text>
          </Pressable>
        );
      }
      const r = item.row;
      const kids = nested ? tree.kids.get(r.id) ?? [] : [];
      const open = (() => {
        const auto = kids.some((c) => c.mine);
        return toggled.has(r.id) ? !auto : auto;
      })();
      const body = (
        <ReplyItem
          row={r}
          revealAll={revealAll}
          unwatched={focus && nested ? r.season != null && r.episode != null && !watchedEps.has(talkEpisodeKey(r.season, r.episode)) : unwatchedRoom}
          signedIn={signedIn}
          replyingTo={item.toName}
          canReply={canReplyTo(r, item.depth, nested)}
          replyCount={nested ? countUnder(tree, r.id) : 0}
          fold={kids.length && !item.open && !focus ? { open, count: countUnder(tree, r.id), onToggle: () => toggle(r.id) } : null}
          onOpen={item.open ? openRow : undefined}
          link={item.link ?? null}
          showLikes={!!d?.has_likes}
          showVotes={!!d?.has_votes}
          onLike={like}
          onVote={vote}
          onReply={beginReply}
          onMenu={setMenu}
          onImage={setImage}
          onProfile={(row) => openProfile(row.person)}
          mentions={mentionNames}
          onMention={(u) => openWeb(`/u/${u}`)}
          onPath={openWeb}
          onTitle={(kind, id) => router.push({ pathname: "/title/[kind]/[id]", params: { kind, id: String(id), from: from === "web" ? "web" : from } })}
        />
      );
      return item.indented ? <View style={{ marginStart: 20, paddingStart: 12, borderStartWidth: 1, borderStartColor: tokens.divider }}>{body}</View> : body;
    },
    [tokens, t, nested, tree, toggled, signedIn, d?.has_likes, d?.has_votes, like, vote, toggle, openProfile, beginReply, mentionNames, openWeb, router, from, revealAll, unwatchedRoom, openRow, focus, nameOf, d?.rows, watchedEps],
  );

  /* 🆕 D-1508 — «شاهدتها» من غرفة الحلقة: الكتابةُ نفسُها في صفحة العمل (`track/episode`)، والغطاءُ ينزل فوراً */
  const markEpWatched = useCallback(
    (ep: EpisodeRef) => {
      if (!d || busy.current.has("ep")) return;
      busy.current.add("ep");
      haptic.success();
      const k = talkEpisodeKey(ep.season, ep.episode);
      const set = (on: boolean) =>
        patch((p) => (p.head.kind === "talk" ? { ...p, head: { ...p.head, watched_eps: on ? [...(p.head.watched_eps ?? []), k] : (p.head.watched_eps ?? []).filter((x) => x !== k) } } : p));
      set(true);
      write<TrackResult>("/api/v1/track/episode", { showTmdbId: d.work.tmdb_id, season: ep.season, episode: ep.episode, runtime: null, watched: true, title: d.work.title, posterPath: d.work.poster_path } satisfies ToggleEpisodeBody)
        .catch((e: unknown) => {
          set(false);
          fail(e);
        })
        .finally(() => busy.current.delete("ep"));
    },
    [d, patch, fail],
  );
  const stats = useMemo(() => (tvTalk && d ? episodeStats(d.rows) : new Map<string, EpisodeStat>()), [tvTalk, d]);
  const latest = useMemo(() => (tvTalk && d ? latestBulletin(d.rows) : null), [tvTalk, d]);
  const pickBulletin = useMemo(() => (d && pick ? episodeBulletin(d.rows, pick) : null), [d, pick]);

  const header = d && !(focus && nested) ? (
    <Head
      d={d}
      reportedHead={reported.has("head")}
      onTitle={openTitle}
      onLike={likeHead}
      onShare={share}
      onReport={() => d.head.kind === "review" && report({ what: "review" }, "head")}
      onProfile={openProfile}
      talk={{
        pick,
        sort: talkSort,
        onSort: setTalkSort,
        revealAll,
        onReveal: () => setRevealAll((v) => !v),
        count: postCount,
        tv: tvTalk
          ? {
              tab,
              onTab: (x) => {
                haptic.pick();
                setTab(x);
                setPick(null);
              },
              onPick: (ep) => {
                haptic.pick();
                setTab("episodes");
                setPick(ep);
              },
              stats,
              latest,
              pickBulletin,
              watchedEps,
              season: epSeason,
              onSeason: setEpSeason,
              onWatched: markEpWatched,
            }
          : null,
      }}
    />
  ) : null;

  return (
    <View ref={rootRef} style={{ flex: 1, backgroundColor: tokens.bg }}>
      <View style={{ paddingTop: insets.top, borderBottomWidth: 1, borderBottomColor: tokens.border, backgroundColor: tokens.bg }}>
        <View style={{ height: 52, flexDirection: "row", alignItems: "center", paddingHorizontal: 8, gap: 4 }}>
          <Pressable onPress={back} hitSlop={8} accessibilityRole="button" accessibilityLabel={t.backAria} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
            {/* السهمُ مُداراً مع اتّجاه الصفحة (`rotate-90 rtl:-rotate-90` — وصفةُ رأس الإعدادات) */}
            <View style={{ transform: [{ rotate: I18nManager.isRTL ? "-90deg" : "90deg" }] }}>
              <Icon name="chevron-down" size={22} color={tokens.fg} />
            </View>
          </Pressable>
          <Text size={15} weight="700" numberOfLines={1} style={{ flex: 1 }}>
            {d ? (focus && nested ? (items.some((x) => x.type === "parent") ? t.talkReplyPage : t.talkPostPage) : d.head.kind === "talk" ? t.talkRoomTitle(d.work.title, d.work.media_type === "tv") : d.work.title) : ""}
          </Text>
          <Pressable onPress={share} disabled={!d} hitSlop={8} accessibilityLabel={t.shareLinkLabel} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
            <Icon name="share" size={18} color={tokens.fg} />
          </Pressable>
        </View>
      </View>

      {!d ? (
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
          onScroll={(e) => {
            scrollY.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={64}
          onContentSizeChange={(_, h) => restoreTo(h)}
          data={epList ? [] : items}
          keyExtractor={(it) => (it.type === "row" ? it.row.id : it.type === "more" ? `more:${it.rootId}` : it.type === "parent" ? `parent:${it.row.id}` : it.type === "heading" ? "heading" : `author-more:${it.parentId}`)}
          renderItem={renderItem}
          ListHeaderComponent={header}
          ListEmptyComponent={epList ? null : <Text size={14} muted style={{ textAlign: "center", paddingVertical: 40, paddingHorizontal: 20, lineHeight: 21 }}>{pick ? t.talkEpisodeEmpty : tvTalk ? t.talkGeneralEmpty : nested ? t.talkRoomEmpty : t.postNoReplies}</Text>}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: signedIn ? 16 : insets.bottom + 24 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onTouchStart={() => attachRef.current && setAttach(false)}
          initialNumToRender={10}
          windowSize={9}
        />
      )}

      {/* 🆕 R53 — الرمزُ لم يصل بعد ردِّ الزائر: قلها وأعطِ زرّاً (D-1144) بدل خانةِ كتابةٍ غائبةٍ بلا تفسير */}
      {d && guest && up.failed ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 8, borderTopWidth: 1, borderTopColor: tokens.divider }}>
          <Text size={13} muted style={{ flex: 1 }} numberOfLines={2}>{t.myStateUnavailable}</Text>
          <Button size="sm" variant="ghost" label={t.errorRetry} onPress={up.retry} />
        </View>
      ) : null}
      {d && signedIn ? <MentionList hits={mentionHits} onPick={pickMention} /> : null}
      {d && signedIn ? (
        <ChatDock
          text={text}
          onText={setText}
          pic={pic}
          onClearPic={() => setPic(null)}
          quote={
            replyTo || (nested && (text.trim() || pic)) ? (
              <View style={{ gap: 8 }}>
                {replyTo ? (
                  <ReplyQuote
                    r={{ id: replyTo.id, mine: replyTo.mine, kind: replyTo.image ? "image" : replyTo.gif_id ? "gif" : "text", body: replyTo.body.replace(/\s+/g, " ").trim().slice(0, 140), ...(replyTo.image ? { image: { url: replyTo.image, key: replyTo.image } } : {}), ...(replyTo.gif_id ? { gif_id: replyTo.gif_id } : {}) }}
                    peerName={nameOf.get(replyTo.id) ?? ""}
                    onClear={() => setReplyTo(null)}
                  />
                ) : null}
                {/* «فيها حرق» حيث يُخزَّن (الغرفةُ وحدَها) — يظهر حين يكون في الخانة ما يُرسل */}
                {nested && (text.trim() || pic) ? (
                  <View style={{ alignSelf: "flex-start" }}>
                    <Chip label={t.spoilerMark} active={spoiler} onPress={() => setSpoiler((v) => !v)} leading={<Icon name={spoiler ? "eye-off" : "eye"} size={14} color={spoiler ? tokens.onAccent : tokens.muted} />} />
                  </View>
                ) : null}
              </View>
            ) : null
          }
          inputRef={inputRef}
          kb={kb}
          bottomInset={insets.bottom}
          sending={sending}
          canSend={(!!text.trim() || !!pic) && !(pic && !pic.path) && !sending}
          onAttach={nested ? toggleAttach : undefined}
          attach={attach}
          onAttachClose={closeAttach}
          onImage={() => void pickImage()}
          onGif={nested ? sendGif : undefined}
          onLoopz={route.t === "talk" ? sendTitle : undefined}
          onSend={sendDock}
          placeholder={target ? t.talkReplyingTo(nameOf.get(target.id) ?? "") : pick ? t.talkWriteAboutEpisode(pick.episode) : tvTalk ? t.talkWriteAboutShow : nested ? t.talkRoomPlaceholder : t.postReplyPlaceholder}
        />
      ) : null}

      {menu ? (
        <Sheet title={t.moreMenuTitle} onClose={() => setMenu(null)}>
          {menu.mine ? (
            <Pressable
              onPress={() => {
                const r = menu;
                setMenu(null);
                remove(r);
              }}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 }}
            >
              <Icon name="trash" size={18} color={tokens.error} />
              <Text size={15} color={tokens.error}>{t.talkDeleteReply}</Text>
            </Pressable>
          ) : (
            <Pressable
              disabled={reported.has(menu.id)}
              onPress={() => {
                const r = menu;
                setMenu(null);
                report({ reply_id: r.id, what: "reply" }, r.id);
              }}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48, opacity: reported.has(menu.id) ? 0.5 : 1 }}
            >
              <Icon name="shield" size={18} color={tokens.muted} />
              <Text size={15}>{reported.has(menu.id) ? t.reportDone : t.reportLabel}</Text>
            </Pressable>
          )}
        </Sheet>
      ) : null}

      {image ? (
        <Sheet title={t.talkImageAlt} onClose={() => setImage(null)} placement="center">
          <Image source={{ uri: image }} style={{ width: "100%", aspectRatio: 3 / 4 }} contentFit="contain" cachePolicy="memory-disk" />
        </Sheet>
      ) : null}

      {leaving ? (
        <View pointerEvents="auto" style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={tokens.accent} />
        </View>
      ) : null}
      <ToastHost hostRef={toastHost} bottom={insets.bottom + 84} />
    </View>
  );
}

/** رأسُ الباب — `TitleHero` مصغّراً ثمّ ما يخصّ كلَّ باب (نبذةُ الغرفة · جملةُ لوبز · الرأيُ بصاحبه) */
function Head({
  d,
  reportedHead,
  onTitle,
  onLike,
  onShare,
  onReport,
  onProfile,
  talk,
}: {
  d: ThreadPayload;
  /** 🆕 D-1495/D-1496 — أدواتُ الغرفة: منتقي الحلقة · «حرق الأحداث» · العددُ و«الأحدث ⌄» */
  talk: {
    pick: EpisodeRef | null;
    sort: "latest" | "active";
    onSort: (s: "latest" | "active") => void;
    revealAll: boolean;
    onReveal: () => void;
    count: number;
    /** 🆕 D-1508 — المسلسلُ بمستوييه («عام» · «الحلقات» وغرفةُ الحلقة) — `null` للفيلم */
    tv: {
      tab: "general" | "episodes";
      onTab: (x: "general" | "episodes") => void;
      onPick: (ep: EpisodeRef | null) => void;
      stats: Map<string, EpisodeStat>;
      latest: ThreadRow | null;
      pickBulletin: ThreadRow | null;
      watchedEps: ReadonlySet<string>;
      season: number | null;
      onSeason: (n: number) => void;
      onWatched: (ep: EpisodeRef) => void;
    } | null;
  };
  reportedHead: boolean;
  onTitle: () => void;
  onLike: () => void;
  onShare: () => void;
  onReport: () => void;
  onProfile: (p: ThreadPayload["rows"][number]["person"]) => void;
}) {
  const { t, tokens, locale } = useApp();
  const [reveal, setReveal] = useState(false);
  const w = d.work;
  const bg = backdropUrl(w.backdrop_path, "w780");
  const poster = posterFor(w.poster_path, d.head.kind === "talk" ? 104 : 78);
  const h = d.head;
  const signedIn = d.viewer.signed_in;

  const dateLine = (iso: string, views: number) => {
    const at = new Date(iso);
    const stamp = Number.isNaN(at.getTime())
      ? ""
      : new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", { hour: "numeric", minute: "2-digit", day: "numeric", month: "short", year: "numeric" }).format(at);
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: tokens.divider, marginTop: 12 }}>
        <Text size={12} muted>{stamp}</Text>
        {views > 0 ? (
          <>
            <Text size={12} muted>·</Text>
            <Text size={12} weight="700" style={{ fontVariant: ["tabular-nums"] }}>{num(views, locale)}</Text>
            <Text size={12} muted>{t.postViewsHint}</Text>
          </>
        ) : null}
      </View>
    );
  };
  const actionBar = (likes: number, liked: boolean, canLike: boolean, canReport: boolean) => (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: tokens.divider }}>
      {canLike ? (
        <Pressable onPress={onLike} hitSlop={4} accessibilityLabel={t.likesLabel} accessibilityState={{ selected: liked }} style={{ flexDirection: "row", alignItems: "center", gap: 6, padding: 8 }}>
          <Icon name={liked ? "heart-filled" : "heart"} size={16} color={liked ? tokens.accent : tokens.muted} />
          {likes > 0 ? <Text size={12} color={liked ? tokens.accent : tokens.muted}>{num(likes, locale)}</Text> : null}
        </Pressable>
      ) : likes > 0 ? (
        <View accessibilityLabel={`${t.likesLabel}: ${likes}`} style={{ flexDirection: "row", alignItems: "center", gap: 6, padding: 8 }}>
          <Icon name="heart" size={16} color={tokens.muted} />
          <Text size={12} muted>{num(likes, locale)}</Text>
        </View>
      ) : (
        <View />
      )}
      <Pressable onPress={onShare} hitSlop={4} accessibilityLabel={t.shareLinkLabel} style={{ padding: 8 }}>
        <Icon name="share" size={16} color={tokens.muted} />
      </Pressable>
      {canReport ? (
        <Pressable onPress={onReport} disabled={reportedHead} hitSlop={4} accessibilityLabel={t.reportLabel} style={{ flexDirection: "row", alignItems: "center", gap: 6, padding: 8, opacity: reportedHead ? 0.5 : 1 }}>
          <Icon name="shield" size={16} color={tokens.muted} />
          <Text size={12} muted>{reportedHead ? t.reportDone : t.reportLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <View>
      {h.kind === "talk" ? (
        /* 🆕 D-1495 — **غلافُ الغرفة الجديد** (لقطةُ أحمد ٢٠ أكتوبر): الغلافُ ظاهرٌ تحت ظلٍّ في البداية والقاع، بوسترٌ أكبر،
           «مسلسل» فوق الاسم، والنبذةُ سطرٌ واحدٌ داخل الغلاف مع «المزيد» — كانت ثلاثةَ أسطرٍ تحته */
        <Pressable onPress={onTitle} accessibilityRole="link" style={{ marginHorizontal: -16, overflow: "hidden", backgroundColor: tokens.surface }}>
          {bg ? (
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <Image source={{ uri: bg }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" />
              <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 100">
                <Defs>
                  <SvgGradient id="talk-cover-side" x1={I18nManager.isRTL ? "1" : "0"} y1="0" x2={I18nManager.isRTL ? "0" : "1"} y2="0">
                    <Stop offset="0" stopColor={tokens.bg} stopOpacity={0.75} />
                    <Stop offset="1" stopColor={tokens.bg} stopOpacity={0.1} />
                  </SvgGradient>
                  <SvgGradient id="talk-cover-foot" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0.45" stopColor={tokens.bg} stopOpacity={0} />
                    <Stop offset="1" stopColor={tokens.bg} stopOpacity={0.95} />
                  </SvgGradient>
                </Defs>
                <Rect x="0" y="0" width="100" height="100" fill="url(#talk-cover-side)" />
                <Rect x="0" y="0" width="100" height="100" fill="url(#talk-cover-foot)" />
              </Svg>
            </View>
          ) : null}
          {/* 🆕 R53 — **الغلافُ المتوسّط بلا نبذة** (أحمد ٢١ أكتوبر: «احذف وصف العمل ما يحتاج»، وصورتُه المعتمدة): الغلافُ
              الكبيرُ كان نصفَ الشاشة فلا يظهر كلامٌ إلّا بالنزول. بوسترٌ ٥٨ واسمٌ وسطرُ النوع والتقييم — واللمسةُ تفتح صفحةَ العمل
              كما كانت؛ وهو نفسُه في «عام» وفي غرفة الحلقة كي لا يقفز الحجمُ بين الاثنين */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 }}>
            <View style={{ width: 58, aspectRatio: 2 / 3, borderRadius: radius.poster, overflow: "hidden", backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.border }}>
              {poster ? <Image source={{ uri: poster }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" /> : null}
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <Text size={19} weight="700" numberOfLines={2}>{w.title}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                <Text size={12}>{w.media_type === "tv" ? t.typeSeries : t.typeMovie}</Text>
                {w.community.count > 0 ? (
                  <>
                    <Text size={12} muted>·</Text>
                    <Icon name="star-filled" size={12} color={tokens.accent} />
                    <Text size={12} weight="700" color={tokens.accent}>{w.community.avg.toFixed(1)}</Text>
                    <Text size={12} muted>({num(w.community.count, locale)})</Text>
                  </>
                ) : null}
              </View>
            </View>
          </View>
        </Pressable>
      ) : (
      <Pressable onPress={onTitle} accessibilityRole="link" style={{ marginHorizontal: -16, flexDirection: "row", gap: 14, padding: 16, overflow: "hidden" }}>
        {bg ? <Image source={{ uri: bg }} style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, opacity: 0.35 }} contentFit="cover" cachePolicy="memory-disk" /> : null}
        <View style={{ width: 78, aspectRatio: 2 / 3, borderRadius: radius.poster, overflow: "hidden", backgroundColor: tokens.surface2 }}>
          {poster ? <Image source={{ uri: poster }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" /> : null}
        </View>
        <View style={{ flex: 1, minWidth: 0, justifyContent: "flex-end", gap: 4 }}>
          <Text size={18} weight="700" numberOfLines={2}>{w.title}</Text>
          {w.community.count > 0 ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Icon name="star-filled" size={13} color={tokens.accent} />
              <Text size={13} weight="700" color={tokens.accent}>{w.community.avg.toFixed(1)}</Text>
              <Text size={12} muted>· {t.communityRating} ({num(w.community.count, locale)})</Text>
            </View>
          ) : null}
          <Text size={12} muted>{w.media_type === "tv" ? t.typeSeries : t.typeMovie}</Text>
        </View>
      </Pressable>
      )}

      {h.kind === "talk" ? (
        <View>
          {talk.tv ? <TvTalkHead d={d} talk={talk} tv={talk.tv} /> : null}
          {/* 🆕 R53 — **سطرٌ واحد: العددُ في البداية، و«حرق» و«الأحدث ⌄» في الطرف** (صورةُ أحمد المعتمدة ٢١ أكتوبر): كان «حرق
              الأحداث» صفّاً وحدَه فوق سطر العدد — صفٌّ كاملٌ يدفع الكلامَ للأسفل. وفي غرفة حلقةٍ لم تُشاهَد يقول العددُ «مغطّاة»
              فلا يحتاج شريطاً منفصلاً. وفي قائمة «الحلقات» لا كلامَ يُكشف ولا يُرتَّب فلا سطر */}
          {talk.tv && talk.tv.tab === "episodes" && !talk.pick ? null : (
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: tokens.divider }}>
              {/* 🆕 R54 — «في مكتبتك» / «شاهدته» في سطر العدد نفسِه (أحمد ٢١ أكتوبر بلقطة: «ادمجه مع الخط اللي فيه ٣ بوست») — كان صفّاً وحدَه تحته */}
              <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text size={13} muted numberOfLines={1} style={{ flexShrink: 1, fontVariant: ["tabular-nums"] }}>
                  {talk.tv && talk.pick && !talk.revealAll && !talk.tv.watchedEps.has(talkEpisodeKey(talk.pick.season, talk.pick.episode)) && talk.count > 0
                    ? `${t.talkRoomPosts(talk.count)} · ${t.talkCovered}`
                    : t.talkRoomPosts(talk.count)}
                </Text>
                {h.watched || h.in_library ? (
                  <>
                    <Text size={13} muted>·</Text>
                    <Icon name={h.watched ? "check" : "bookmark"} size={13} color={tokens.accent} />
                    <Text size={13} muted numberOfLines={1} style={{ flexShrink: 1 }}>{h.watched ? t.talkWatchedIt : t.talkInLibrary}</Text>
                  </>
                ) : null}
              </View>
              <Chip label={t.talkSpoilersToggle} active={talk.revealAll} onPress={talk.onReveal} leading={<Icon name={talk.revealAll ? "eye" : "eye-off"} size={13} color={talk.revealAll ? tokens.onAccent : tokens.muted} />} />
              <SortCycle
                label={t.talkSortAria}
                value={talk.sort}
                onChange={talk.onSort}
                options={[
                  { key: "latest", label: t.talkSortLatest },
                  { key: "active", label: t.talkSortActive },
                ]}
              />
            </View>
          )}
          {!signedIn && !isGuest(d) ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 8 }}>
              <Icon name="comment" size={13} color={tokens.accent} />
              <Text size={12} weight="700">{t.talkSignInToWrite}</Text>
            </View>
          ) : null}
        </View>
      ) : h.kind === "post" ? (
        <View style={{ paddingTop: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, overflow: "hidden", backgroundColor: tokens.surface2 }}>
              <Image source={require("../../assets/loopz-mark.png")} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            </View>
            <Text size={15} weight="700" style={{ writingDirection: "ltr" }}>Loopz</Text>
          </View>
          <Text size={15} weight="600" style={{ marginTop: 12, lineHeight: 23 }}>{h.line}</Text>
          {h.source ? <Text size={12} muted style={{ marginTop: 6 }}>{t.newsPerSource(h.source.name)}</Text> : null}
          {dateLine(h.published_at, h.views)}
          {actionBar(h.likes, h.liked_by_me, signedIn, false)}
        </View>
      ) : (
        <View style={{ paddingTop: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Pressable onPress={() => onProfile(h.author)} disabled={h.author.hide_name}>
              <View style={{ width: 44, height: 44, borderRadius: 22, overflow: "hidden", backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
                {h.author.avatar_url && !h.author.hide_name ? <Image source={{ uri: h.author.avatar_url }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : <Icon name="people" size={18} color={tokens.muted} />}
              </View>
            </Pressable>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text size={15} weight="700" numberOfLines={1} style={{ flexShrink: 1 }}>{displayNameOf(h.author, t.anonymousUser)}</Text>
                {h.author.hide_name ? null : <IdentityBadges flags={identityFlags(h.author)} nameSize={15} />}
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text size={12} muted numberOfLines={1} style={{ flexShrink: 1 }}>{w.title}</Text>
                {h.rating != null ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                    <Icon name="star-filled" size={12} color={tokens.accent} />
                    <Text size={14} weight="700" color={tokens.accent} style={{ writingDirection: "ltr" }}>{h.rating.toFixed(1)}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
          {h.review?.trim() ? (
            h.has_spoiler && !reveal ? (
              <Pressable onPress={() => setReveal(true)} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, alignSelf: "flex-start", paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: tokens.surface2 }}>
                <Icon name="eye-off" size={14} color={tokens.muted} />
                <Text size={13} muted>{t.spoilerShow}</Text>
              </Pressable>
            ) : (
              <Text size={15} content style={{ marginTop: 12, lineHeight: 23 }}>{h.review}</Text>
            )
          ) : null}
          {dateLine(h.updated_at, h.views)}
          {actionBar(h.likes, h.liked_by_me, signedIn && !h.mine, signedIn && !h.mine)}
        </View>
      )}
    </View>
  );
}

/**
 * 🆕 D-1508 — **رأسُ غرفة المسلسل بمستوييه** (أحمد ٢١ أكتوبر، صورتُه المعتمدة):
 * - «عام» | «الحلقات» — المتحكّمُ المقسَّم نفسُه (القاعدة: عائلتان للتحكّم).
 * - **«عام»**: سطرُ «آخر حلقة» بدل نشرات لوبز في الخيط — لمستُه تفتح غرفتَها.
 * - **«الحلقات»**: شرائحُ المواسم، ثمّ الحلقاتُ من الأحدث بعدد ما قيل وآخره؛ ما لم يشاهده القارئُ مقفل 🔒.
 * - **غرفةُ الحلقة**: «‹ كل الحلقات»، وبطاقتُها (الاسم · التقييم · المدّة) مكانَ النشرة، وشريطُ «لم تشاهدها» بزرِّ «شاهدتها».
 */
function TvTalkHead({ d, talk, tv }: { d: ThreadPayload; talk: { pick: EpisodeRef | null }; tv: NonNullable<Parameters<typeof Head>[0]["talk"]["tv"]> }) {
  const { t, tokens } = useApp();
  const seasons = d.head.kind === "talk" ? d.head.seasons ?? [] : [];
  const signedIn = d.viewer.signed_in;
  const pick = talk.pick;
  const season = tv.season ?? tv.latest?.season ?? seasons[seasons.length - 1]?.season ?? 1;
  const seasonInfo = seasons.find((x) => x.season === season) ?? null;
  /* 🆕 R56 — حلقاتُ الموسم من مسار صفحة العمل نفسِه (`seasonQuery` — الكاشُ مشترك): رقمُ TMDB والعنوانُ والصورة */
  const sq = useQuery({ ...seasonQuery(d.work.tmdb_id, season), enabled: tv.tab === "episodes" && !pick && !!seasonInfo });
  const aired = useMemo(() => (sq.data ? airedEpisodes(sq.data.episodes) : null), [sq.data]);

  if (pick) {
    const b = tv.pickBulletin;
    const watched = tv.watchedEps.has(talkEpisodeKey(pick.season, pick.episode));
    const facts = [t.talkEpShort(pick.season, pick.episode), b?.bulletin_vote ? `★ ${b.bulletin_vote}` : null, b?.bulletin_runtime ?? null].filter(Boolean).join(" · ");
    /* 🆕 R53 — **غرفةُ الحلقة صفٌّ واحد** (أحمد ٢١ أكتوبر بفيديو: «ماخذ مساحة كبيرة ولازم انزل تحت اشوف الكتابات»؛ «ب» المعتمد):
       كانت أربعةَ صفوف — «‹ كل الحلقات» وبطاقةُ الحلقة وشريطُ «لم تشاهدها» وزرُّ الحرق — ~٣٠٠ نقطة قبل أوّل تعليق.
       الآن: رجوعٌ دائريّ · «م٢ · ح٣ · ★ · المدّة» فوق الاسم · «شاهدتها» في الطرف (أو ✓ أخضر بعدها). و«مغطّاة» انتقلت لسطر العدد */
    return (
      /* 🆕 R54 — بلون الصفحة لا السطحِ الرماديّ (أحمد ٢١ أكتوبر «أ»: «لون خلفية الحلقة يناسب لون الثيم») والإطارُ الرفيع وحده — كصفوف «تابِع
         المشاهدة» (D-1089). و«شاهدتها» لا تنكمش ولا تُدفع: لقطتُه أظهرتها مقصوصةً خارج الكرت، فالوسطُ هو الذي يتنازل ويقصّ اسمَه */
      <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: tokens.border, borderRadius: radius.card, backgroundColor: tokens.bg, padding: 10, overflow: "hidden" }}>
        <Pressable
          onPress={() => tv.onPick(null)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t.talkAllEpisodes}
          style={({ pressed }) => ({ width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}
        >
          <View style={{ transform: [{ rotate: I18nManager.isRTL ? "-90deg" : "90deg" }] }}>
            <Icon name="chevron-down" size={15} color={tokens.fg} />
          </View>
        </Pressable>
        <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 2 }}>
          <Text size={11} weight="700" color={tokens.accent} numberOfLines={1}>{facts}</Text>
          <Text size={15} weight="700" numberOfLines={1}>{b?.bulletin_name ?? t.talkEpisodeLabel(pick.episode)}</Text>
        </View>
        {watched ? (
          <View style={{ flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Icon name="check" size={13} color={tokens.success} />
            <Text size={12} weight="700" color={tokens.success}>{t.talkEpWatched}</Text>
          </View>
        ) : signedIn ? (
          <View style={{ flexShrink: 0 }}>
            <Chip label={t.talkMarkEpWatched} active onPress={() => tv.onWatched(pick)} leading={<Icon name="check" size={13} color={tokens.onAccent} />} />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View>
      <View style={{ paddingTop: 12 }}>
        <Segmented
          items={[
            { id: "general", label: t.talkTabGeneral },
            { id: "episodes", label: t.talkTabEpisodes },
          ]}
          value={tv.tab}
          onChange={(v) => tv.onTab(v === "episodes" ? "episodes" : "general")}
        />
      </View>
      {tv.tab === "general" ? (
        tv.latest && tv.latest.season != null && tv.latest.episode != null ? (
          <Pressable
            onPress={() => tv.onPick({ season: tv.latest!.season!, episode: tv.latest!.episode! })}
            accessibilityRole="button"
            style={({ pressed }) => ({ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius.card, borderWidth: 1, borderColor: tokens.accent, backgroundColor: tokens.surface, opacity: pressed ? 0.8 : 1 })}
          >
            <Text size={13} numberOfLines={1} style={{ flex: 1 }}>
              <Text size={13} weight="700" color={tokens.accent}>{t.talkLatestEpisode(tv.latest.season, tv.latest.episode)}</Text>
              {tv.latest.bulletin_name ? ` «${tv.latest.bulletin_name}»` : ""}
              {tv.latest.bulletin_vote ? ` · ★ ${tv.latest.bulletin_vote}` : ""}
            </Text>
            <Text size={12} muted>{t.talkComments(tv.stats.get(talkEpisodeKey(tv.latest.season, tv.latest.episode))?.count ?? 0)}</Text>
            <View style={{ transform: [{ rotate: I18nManager.isRTL ? "90deg" : "-90deg" }] }}>
              <Icon name="chevron-down" size={14} color={tokens.muted} />
            </View>
          </Pressable>
        ) : null
      ) : (
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 12 }}>
            {[...seasons].reverse().map((x) => (
              <Chip key={x.season} size="md" label={t.talkSeasonLabel(x.season)} active={x.season === season} onPress={() => tv.onSeason(x.season)} />
            ))}
          </ScrollView>
          {/* 🆕 R56 — الحلقاتُ بأرقام TMDB وعناوينها وصورها (أحمد: «١ أ» الصورةُ مغبّشةٌ لما لم تشاهده لأنّ صورَ الحلقات تحرق،
              «٢ ب» العنوانُ المكرّرُ من الرقم لا يُعرض). وقبل وصول الموسم مؤشّرٌ لا أرقامٌ تخمينيّة؛ وإن فشل فالعددُ القديم كما كان */}
          {!seasonInfo ? null : aired ? (
            aired.map((e) => {
              const n = e.episode_number;
              const k = talkEpisodeKey(season, n);
              const st = tv.stats.get(k);
              const watched = tv.watchedEps.has(k);
              const name = episodeTitle(e.name) ?? episodeBulletin(d.rows, { season, episode: n })?.bulletin_name ?? null;
              const still = e.still_path ? backdropUrl(e.still_path, "w300") : null;
              return (
                <Pressable
                  key={k}
                  onPress={() => tv.onPick({ season, episode: n })}
                  accessibilityRole="button"
                  accessibilityLabel={[t.talkEpisodeLabel(n), name].filter(Boolean).join(" · ")}
                  style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: tokens.divider, opacity: pressed ? 0.7 : 1 })}
                >
                  <View style={{ width: 112, height: 63, borderRadius: radius.md, overflow: "hidden", backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
                    {still ? <Image source={{ uri: still }} style={{ position: "absolute", width: "100%", height: "100%" }} contentFit="cover" blurRadius={watched ? 0 : 18} cachePolicy="memory-disk" recyclingKey={k} /> : null}
                    {watched ? (
                      <View style={{ position: "absolute", bottom: 5, end: 5, width: 20, height: 20, borderRadius: 10, backgroundColor: tokens.success, alignItems: "center", justifyContent: "center" }}>
                        <Icon name="check" size={12} color={tokens.bg} />
                      </View>
                    ) : (
                      <>
                        {still ? <View style={{ position: "absolute", width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.35)" }} /> : null}
                        <Icon name="eye-off" size={18} color={still ? "#fff" : tokens.muted} />
                      </>
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text size={14} weight="700" numberOfLines={1} style={{ flexShrink: 1 }}>{t.talkEpisodeLabel(n)}</Text>
                      <Text size={12} weight="700" color={st?.count ? tokens.accent : tokens.muted} style={{ marginStart: "auto" }}>{t.talkComments(st?.count ?? 0)}</Text>
                    </View>
                    {name ? <Text size={13} numberOfLines={1}>{name}</Text> : null}
                    <Text size={12} muted numberOfLines={1}>{[e.air_date ? formatDateShort(e.air_date, t) : null, watched ? t.talkEpWatched : null, st?.last ? timeAgoShort(st.last, t) : null].filter(Boolean).join(" · ") || " "}</Text>
                  </View>
                </Pressable>
              );
            })
          ) : sq.isError ? (
            Array.from({ length: seasonInfo.episodes }, (_, i) => seasonInfo.episodes - i).map((n) => {
              const k = talkEpisodeKey(season, n);
              const st = tv.stats.get(k);
              return (
                <Pressable key={k} onPress={() => tv.onPick({ season, episode: n })} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: tokens.divider, opacity: pressed ? 0.7 : 1 })}>
                  <Text size={14} weight="700" style={{ flex: 1 }}>{t.talkEpisodeLabel(n)}</Text>
                  <Text size={12} weight="700" color={st?.count ? tokens.accent : tokens.muted}>{t.talkComments(st?.count ?? 0)}</Text>
                </Pressable>
              );
            })
          ) : (
            <ActivityIndicator color={tokens.accent} style={{ paddingVertical: 24 }} />
          )}
        </View>
      )}
    </View>
  );
}
