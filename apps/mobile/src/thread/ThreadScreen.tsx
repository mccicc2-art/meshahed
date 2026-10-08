import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, FlatList, I18nManager, Platform, Pressable, Share, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigationContainerRef, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, write } from "../api";
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
import { Composer, type Draft } from "./Composer";
import { rememberGif } from "./GifPicker";
import { ReplyItem, TEMP } from "./ReplyItem";
import { backdropUrl } from "@/core/media";
import { num } from "@/core/i18n";
import { displayNameOf, profileHref } from "@/core/people";
import { stackAboveRoots } from "../nativeStack";
import { orderThread, buildTree, countUnder, canReplyTo, PEEK } from "@/core/threadOrder";
import type { ThreadPayload, ThreadRow, ThreadTarget, ThreadReplyResult, LikeBody } from "../contracts";
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
  | { type: "row"; row: ThreadRow; depth: number; indented: boolean; toName: string | null }
  | { type: "more"; rootId: string; rest: number };

/**
 * 🆕 M3-fix — **ذاكرةُ الغرفة عند الخروج إلى بابٍ ويبيّ** (أحمد: «المفترض يرجعني مكان ما كنت بالضبط»): الشاشةُ تُنزَل
 * لتظهر الصفحة ثمّ تُدفع ثانيةً عند العودة (`nativeStack.ts`)، فحالتُها تُحفظ هنا لا في الشاشة. تُكتب عند الخروج
 * وتُستهلك في التركيب التالي، **وتشيخ بعد عشر دقائق** — فتحٌ لاحقٌ للغرفة نفسِها من مكانٍ آخر يبدأ من أعلاها.
 */
const threadView = new Map<string, { y: number; toggled: string[]; expanded: string[]; at: number }>();
const VIEW_TTL_MS = 10 * 60_000;

export function ThreadScreen({ route, from, compose = false }: { route: ThreadRoute; from: NativeRoot | "web"; compose?: boolean }) {
  const { t, tokens } = useApp();
  const router = useRouter();
  const nav = useNavigationContainerRef();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const key = useMemo(() => threadKey(route), [route]);
  const q = useQuery({ queryKey: key, queryFn: async () => (await api<ThreadPayload>(`/api/v1/thread?${query(route)}`)).data, staleTime: 30_000 });
  const d = q.data ?? null;

  /* `thread.open`: من التركيب إلى أوّل رسمٍ فيه حمولة — `cached` يفصل الكاش عن الشبكة (نهجُ `community.open`) */
  const [endOpen] = useState(() => span("thread.open", { cached: qc.getQueryData(key) ? 1 : 0, screen: route.t }));
  const opened = useRef(false);
  useEffect(() => {
    if (!d || opened.current) return;
    opened.current = true;
    afterPaint(() => endOpen());
  }, [d, endOpen]);

  const toastHost = useRef<ToastHostRef>(null);
  /* D-1326 — النغمةُ تُعلَن حيث يُعرف المعنى: نجاحٌ أخضر · معلومةٌ محايدة · والغائبُ خطأٌ كما كان */
  const say = useCallback((text: string, tone?: ToastTone) => toastHost.current?.say(text, undefined, undefined, tone), []);
  const fail = useCallback((e: unknown) => say(errorText(t, e)), [say, t]);

  /* ——— الملاحة ——— */
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
      threadView.set(JSON.stringify(key), { y: scrollY.current, toggled: [...openNow.current.toggled], expanded: [...openNow.current.expanded], at: Date.now() });
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
    [leaving, from, leave, key, nav, router],
  );
  const openTitle = useCallback(() => {
    if (!d) return;
    router.push({ pathname: "/title/[kind]/[id]", params: { kind: d.work.media_type, id: String(d.work.tmdb_id), from: from === "web" ? "web" : from } });
  }, [router, d, from]);
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
    const k = JSON.stringify(key);
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
  const { items, tree, nameOf } = useMemo(() => {
    const rows = d ? orderThread(d.rows, { votes: d.has_votes, plusFirst: !d.has_votes && d.head.kind === "review" }) : [];
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
    for (const r of tr.roots) {
      out.push({ type: "row", row: r, depth: 0, indented: false, toName: !nested && r.parent_id ? names.get(r.parent_id) ?? null : null });
      if (!nested || !isOpen(r.id)) continue;
      const flat = branch(r.id, r.id);
      const shown = expanded.has(r.id) ? flat : flat.slice(0, PEEK);
      for (const x of shown) out.push({ type: "row", row: x.r, depth: tr.depth.get(x.r.id) ?? 1, indented: true, toName: x.toName });
      if (flat.length > shown.length) out.push({ type: "more", rootId: r.id, rest: flat.length - shown.length });
    }
    return { items: out, tree: tr, nameOf: names };
  }, [d, nested, toggled, expanded, t.anonymousUser]);
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
      write("/api/v1/thread/like", { post_id: row.id, on: !was })
        .catch((e: unknown) => {
          set(was);
          fail(e);
        })
        .finally(() => busy.current.delete(k));
    },
    [patchRow, fail],
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
  const [composing, setComposing] = useState<{ parent: ThreadRow | null } | null>(null);
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
        translated: null,
        likes: 0,
        liked_by_me: false,
        score: 0,
        my_vote: 0,
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
    [d, nested, route, patch, patchRow, fail],
  );

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
    setComposing({ parent: null });
  }, [d, signedIn]);
  const renderItem = useCallback(
    ({ item }: { item: Item }) => {
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
          signedIn={signedIn}
          replyingTo={item.toName}
          canReply={canReplyTo(r, item.depth, nested)}
          replyCount={nested ? countUnder(tree, r.id) : 0}
          fold={kids.length ? { open, count: countUnder(tree, r.id), onToggle: () => toggle(r.id) } : null}
          showLikes={!!d?.has_likes}
          showVotes={!!d?.has_votes}
          onLike={like}
          onVote={vote}
          onReply={(row) => setComposing({ parent: row })}
          onMenu={setMenu}
          onImage={setImage}
          onProfile={(row) => openProfile(row.person)}
        />
      );
      return item.indented ? <View style={{ marginStart: 20, paddingStart: 12, borderStartWidth: 1, borderStartColor: tokens.divider }}>{body}</View> : body;
    },
    [tokens, t, nested, tree, toggled, signedIn, d?.has_likes, d?.has_votes, like, vote, toggle, openProfile],
  );

  const header = d ? (
    <Head
      d={d}
      reportedHead={reported.has("head")}
      onTitle={openTitle}
      onLike={likeHead}
      onShare={share}
      onReport={() => d.head.kind === "review" && report({ what: "review" }, "head")}
      onProfile={openProfile}
    />
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg }}>
      <View style={{ paddingTop: insets.top, borderBottomWidth: 1, borderBottomColor: tokens.border, backgroundColor: tokens.bg }}>
        <View style={{ height: 52, flexDirection: "row", alignItems: "center", paddingHorizontal: 8, gap: 4 }}>
          <Pressable onPress={back} hitSlop={8} accessibilityRole="button" accessibilityLabel={t.backAria} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
            {/* السهمُ مُداراً مع اتّجاه الصفحة (`rotate-90 rtl:-rotate-90` — وصفةُ رأس الإعدادات) */}
            <View style={{ transform: [{ rotate: I18nManager.isRTL ? "-90deg" : "90deg" }] }}>
              <Icon name="chevron-down" size={22} color={tokens.fg} />
            </View>
          </Pressable>
          <Text size={15} weight="700" numberOfLines={1} style={{ flex: 1 }}>
            {d ? (d.head.kind === "talk" ? t.talkRoomTitle(d.work.title, d.work.media_type === "tv") : d.work.title) : ""}
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
          data={items}
          keyExtractor={(it) => (it.type === "row" ? it.row.id : `more:${it.rootId}`)}
          renderItem={renderItem}
          ListHeaderComponent={header}
          ListEmptyComponent={<Text size={14} muted style={{ textAlign: "center", paddingVertical: 40, paddingHorizontal: 20, lineHeight: 21 }}>{nested ? t.talkRoomEmpty : t.postNoReplies}</Text>}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 96 }}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={10}
          windowSize={9}
        />
      )}

      {d && signedIn ? (
        /* زرُّ الكتابة العائم (`ThreadReplies`): «شارِك في النقاش» للغرفة و«اكتب ردّك» لغيرها */
        <Pressable
          onPress={() => {
            haptic.pick();
            setComposing({ parent: null });
          }}
          accessibilityRole="button"
          accessibilityLabel={nested ? t.talkRoomPlaceholder : t.postReplyPlaceholder}
          style={({ pressed }) => ({ position: "absolute", end: 16, bottom: insets.bottom + 20, width: 52, height: 52, borderRadius: 26, backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.border, alignItems: "center", justifyContent: "center", transform: [{ scale: pressed ? 0.95 : 1 }], elevation: 6 })}
        >
          <Icon name="edit" size={20} color={tokens.fg} />
        </Pressable>
      ) : null}

      {composing ? (
        <Composer
          title={composing.parent ? t.talkReply : nested ? t.talkRoomPlaceholder : t.postReplyPlaceholder}
          hint={composing.parent ? t.talkReplyingTo(nameOf.get(composing.parent.id) ?? "") : undefined}
          allowSpoiler={nested}
          allowImage={nested}
          allowGif={nested}
          onSend={(draft) => send(composing.parent, draft)}
          onClose={() => setComposing(null)}
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
}: {
  d: ThreadPayload;
  reportedHead: boolean;
  onTitle: () => void;
  onLike: () => void;
  onShare: () => void;
  onReport: () => void;
  onProfile: (p: ThreadPayload["rows"][number]["person"]) => void;
}) {
  const { t, tokens, locale } = useApp();
  const [more, setMore] = useState(false);
  const [reveal, setReveal] = useState(false);
  const w = d.work;
  const bg = backdropUrl(w.backdrop_path, "w780");
  const poster = posterFor(w.poster_path, 78);
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
          <Text size={12} color={liked ? tokens.accent : tokens.muted}>{t.likesLabel}</Text>
          {likes > 0 ? <Text size={12} color={liked ? tokens.accent : tokens.muted}>{num(likes, locale)}</Text> : null}
        </Pressable>
      ) : likes > 0 ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, padding: 8 }}>
          <Icon name="heart" size={16} color={tokens.muted} />
          <Text size={12} muted>{t.likesLabel}</Text>
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

      {h.kind === "talk" ? (
        <View style={{ gap: 8, paddingTop: 8, paddingBottom: 8 }}>
          {h.overview ? (
            <Pressable onPress={() => setMore((v) => !v)}>
              <Text size={13} muted numberOfLines={more ? undefined : 3} style={{ lineHeight: 20 }}>{h.overview}</Text>
              <Text size={12} weight="700" color={tokens.accent} style={{ marginTop: 2 }}>{more ? t.showLess : t.showMore}</Text>
            </Pressable>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            {!signedIn ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Icon name="comment" size={13} color={tokens.accent} />
                <Text size={12} weight="700">{t.talkSignInToWrite}</Text>
              </View>
            ) : null}
            {h.watched ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Icon name="check" size={13} color={tokens.accent} />
                <Text size={12} muted>{t.talkWatchedIt}</Text>
              </View>
            ) : h.in_library ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Icon name="bookmark" size={13} color={tokens.accent} />
                <Text size={12} muted>{t.talkInLibrary}</Text>
              </View>
            ) : null}
          </View>
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
