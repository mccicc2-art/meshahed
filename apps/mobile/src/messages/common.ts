import { useCallback, useEffect, useState } from "react";
import { useNavigationContainerRef, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api, queryClient } from "../api";
import { shell, type NativeRoot } from "../shell";
import { stackAboveRoots } from "../nativeStack";
import { openThreadPath } from "../thread/route";
import { HOME_KEY } from "../home/useHome";
import { MESSAGES_KEY, retainLive } from "./live";
import type { HomePayload, MessagesPayload, MsgConversation } from "../contracts";

/**
 * ====== «الرسائل» أصليّةً — ما تتشاركه شاشتا الصندوق والمحادثة (Phase 11-M · M4) ======
 *
 * 🔑 **حمولةٌ واحدةٌ لشاشتين** (`GET /api/v1/me/messages` تحت `me:messages`): المحادثةُ فوق الصندوق تقرأ خيطَها من الكاش
 * نفسِه — فالردُّ المتفائلُ يظهر في معاينة الصندوق حين يُرجع إليه، وإشارةُ Realtime الواحدةُ تجدّد الاثنين.
 */
export type Origin = NativeRoot | "web";

/**
 * 🔴 M4-fix3 — **تعديلُ الكاش لا يجعله «طازجاً»** (بلاغُ أحمد: الشارةُ ظهرت والرسالةُ ليست في الصندوق حتى وصلت ثانية):
 * `setQueryData` يختم البياناتِ بوقت الآن، فرقمُ الشارة المكتوبُ فوق صندوقٍ محفوظٍ من فتحةٍ سابقة جعله يبدو جُلب للتوّ —
 * فلم يُعَد جلبُه عند فتح «الرسائل» (١٥ ثانيةً طزاجة)، ولا جُلبت الرئيسيّةُ عند ظهورها. هنا يُعدَّل المحتوى ويبقى ختمُه
 * الأصليّ، فما كان شائخاً يبقى شائخاً ويُجلب في موعده.
 */
export function patchKeep<T>(key: readonly unknown[], fn: (p: T) => T) {
  const at = queryClient.getQueryState(key)?.dataUpdatedAt;
  queryClient.setQueryData<T>(key, (p) => (p ? fn(p) : p), at ? { updatedAt: at } : undefined);
}

export function originOf(from: string | undefined): Origin {
  return from === "discover" || from === "search" || from === "home" || from === "community" || from === "library" ? from : "web";
}

async function fetchMessages() {
  return (await api<MessagesPayload>("/api/v1/me/messages")).data;
}

/** الصندوقُ مع فوريّته — الشاشةُ التي تستعمله تحجز القناةَ ما دامت مركَّبة */
export function useMessages() {
  useEffect(() => retainLive(), []);
  const q = useQuery({ queryKey: MESSAGES_KEY, queryFn: fetchMessages, staleTime: 15_000 });
  /* 🆕 M4-fix — **الرقمُ الأحدثُ من الخادم يصل الظرفَ والجرسَ في الرئيسيّة أيضاً** (تسجيلُ أحمد: بعد إقلاعٍ بارد رسمت
     الرئيسيّةُ رأسَها من الكاش المحفوظ بلا شارة، والرسالةُ في الصندوق). جلبٌ حيٌّ للصندوق (لا نسخةٌ محفوظة) هو قيمةُ
     الخادم لحظتَها — فيُكتب في رأس الرئيسيّة؛ والعكسُ يأتي حين تتجدّد الرئيسيّةُ نفسُها. */
  const at = q.dataUpdatedAt;
  const live = q.data && !q.isStale ? q.data.unread : null;
  useEffect(() => {
    if (!live) return;
    patchKeep<HomePayload>(HOME_KEY, (p) =>
      p.header.unread_shares !== live.messages || p.header.unread_signals !== live.signals
        ? { ...p, header: { ...p.header, unread_shares: live.messages, unread_signals: live.signals } }
        : p,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at]);
  return q;
}

export function prefetchMessages(): void {
  void queryClient.prefetchQuery({ queryKey: MESSAGES_KEY, queryFn: fetchMessages, staleTime: 15_000 });
}

/**
 * **الشارةُ تسقط في الموضعين معاً** — الصندوقُ ورأسُ الرئيسيّة (الظرفُ والجرس): الخادمُ صاحبُ الرقم (خطّة §٧)، وهذا
 * تصفيرٌ متفائلٌ لما صفّره الخادمُ للتوّ، والجلبُ التالي يأتي بقيمته. `messages` يُطرح منه، و`signals` يُصفَّر.
 */
export function dropBadges(d: { messages?: number; signals?: true }) {
  const sub = (n: number) => Math.max(0, n - (d.messages ?? 0));
  patchKeep<MessagesPayload>(MESSAGES_KEY, (p) => ({ ...p, unread: { messages: sub(p.unread.messages), signals: d.signals ? 0 : p.unread.signals } }));
  patchKeep<HomePayload>(HOME_KEY, (p) => ({ ...p, header: { ...p.header, unread_shares: sub(p.header.unread_shares), unread_signals: d.signals ? 0 : p.header.unread_signals } }));
}

export function patchConversation(peer: string, fn: (c: MsgConversation) => MsgConversation) {
  patchKeep<MessagesPayload>(MESSAGES_KEY, (p) => ({ ...p, conversations: p.conversations.map((c) => (c.person_id === peer ? fn(c) : c)) }));
}

/**
 * **الأبوابُ من «الرسائل»**: العملُ والقائمةُ والنقاشُ أصليّة؛ الملفُّ بابٌ ويبيّ —
 * **تُنزَل الشاشاتُ كلُّها وما فوق الجذر يُلتقط** فالرجوعُ من الصفحة يعيد الصندوقَ أو المحادثةَ كما تُركت (D-1177).
 */
export function useDoors(from: Origin) {
  const router = useRouter();
  const nav = useNavigationContainerRef();
  const [leaving, setLeaving] = useState(false);
  const openWeb = useCallback(
    (path: string) => {
      if (leaving) return;
      setLeaving(true);
      const resume = from === "web" ? undefined : stackAboveRoots(nav.getRootState());
      void shell.open(path, from === "web" ? undefined : { returnTo: from, resume }).then((layered) => {
        setLeaving(false);
        /* 🆕 K3b — ظهرت طبقةً ⇒ هذه الشاشةُ تبقى تحتها كما هي (لا نزعَ ولا بناء) */
        if (layered) return;
        if (router.canDismiss()) router.dismissAll();
        else router.replace("/web");
      });
    },
    [leaving, from, nav, router],
  );
  const openTitle = useCallback(
    (kind: "tv" | "movie", id: number) => router.push({ pathname: "/title/[kind]/[id]", params: { kind, id: String(id), from } }),
    [router, from],
  );
  const openList = useCallback((id: string) => router.push({ pathname: "/list/[id]", params: { id, from } }), [router, from]);
  /** مسارُ ويبٍ (وجهةُ إشعار) ⇐ الشاشةُ الأصليّةُ إن كانت له، وإلّا بابٌ ويبيّ */
  const openPath = useCallback(
    (path: string) => {
      const list = /^\/lists\/([^/?#]+)\/?$/.exec(path);
      if (list) return openList(decodeURIComponent(list[1]));
      const title = /^\/(show|movie)\/(\d+)\/?$/.exec(path);
      if (title) return openTitle(title[1] === "show" ? "tv" : "movie", Number(title[2]));
      if (openThreadPath(router, path, from)) return;
      openWeb(path);
    },
    [openList, openTitle, openWeb, router, from],
  );
  return { openWeb, openTitle, openList, openPath, leaving };
}

/** 🆕 D-765 — سطرُ الحضور: «متصل الآن» خلال خمس دقائق وإلّا «آخر ظهور …» (صيغةُ `presenceOf` في `Inbox` حرفاً) */
export function presenceOf(lastSeen: string | null | undefined, t: { convOnline: string; convLastSeen: (w: string) => string }, ago: (iso: string) => string): string | null {
  if (!lastSeen) return null;
  const at = new Date(lastSeen).getTime();
  if (!Number.isFinite(at)) return null;
  if (Date.now() - at < 5 * 60_000) return t.convOnline;
  return t.convLastSeen(ago(lastSeen));
}
