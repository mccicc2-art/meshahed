import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, queryClient, write } from "../api";
import { haptic } from "../haptics";
import type { Dict } from "@/core/i18n";
import type {
  CommunityFeedRow,
  CommunityPayload,
  CommunityPeopleAllPayload,
  CommunityRoom,
  FollowUserResult,
  LikeBody,
  ReplyBody,
  RoomPinBody,
} from "../contracts";

/**
 * ====== أفعالُ «المجتمع» الأصليّة — Phase 11-M · M2 ======
 *
 * 🔑 **الحالةُ في الكاش لا في البطاقة**: القلبُ والردودُ والدبّوسُ حقولٌ في حمولة `["community"]` تُعدَّل تفاؤليّاً
 * (`setQueryData`) — فالبطاقةُ ترسم ما في الكاش وحده، **ولا نسخةَ ثانيةً تتخلّف عنه** حين تُعاد البطاقةُ من القائمة
 * الافتراضيّة أو يُقرأ الكاشُ المحفوظ. والفشلُ يُرجع الحقلَ ويقول السببَ بالرسالة العابرة الواحدة (D-047).
 *
 * 🔑 **كأفعال الويب حرفاً**: القلبُ ينقلب فورَ اللمس ويُكتب (`LikeButton`)، وضغطةٌ ثانيةٌ في أثناء الكتابة تُتجاهَل
 * (`if (pending) return`) · الدبّوسُ يمتلئ ولا يعيد الترتيبَ تحت الإصبع (`RoomPinButton`، D-008) · المتابعةُ ترسم ما
 * أعاده الخادم («طلبتَ» للحساب الخاصّ، `FollowUserButton`) · الردُّ يُرسل ثمّ «أُرسل» ويزيد العدّاد (`NewsComment`).
 * **واللمسةُ الحسّيّة حيث ينادي الويبُ `tap`**: القلبُ والدبّوسُ والمتابعة (`pick`) ونجاحُ الردّ (`success`).
 */

type Say = (text: string) => void;
export type FollowState = FollowUserResult["state"];

export type CommunityActs = {
  signedIn: boolean;
  meId: string | null;
  admin: boolean;
  like: (row: CommunityFeedRow) => void;
  reply: (row: CommunityFeedRow, body: string) => Promise<boolean>;
  pin: (room: CommunityRoom) => void;
  followState: (userId: string, following: boolean) => FollowState;
  follow: (userId: string, following: boolean) => void;
};

const KEY = ["community"] as const;

function patchPayload(fn: (d: CommunityPayload) => CommunityPayload): void {
  queryClient.setQueryData<CommunityPayload>(KEY, (prev) => (prev ? fn(prev) : prev));
}

function patchRow(key: string, fn: (r: CommunityFeedRow) => CommunityFeedRow): void {
  /* D-1228 — الصفُّ قد يكون في شريحةٍ أخرى (`extra`) — يُرقَّع حيث كان */
  patchPayload((d) => ({ ...d, feed: { ...d.feed, rows: d.feed.rows.map((r) => (r.key === key ? fn(r) : r)), ...(d.feed.extra ? { extra: d.feed.extra.map((r) => (r.key === key ? fn(r) : r)) } : {}) } }));
}

/** القلبُ في الحقل الذي يرسمه ذيلُ هذا الصفّ — رأيُ العمل · رأيُ القائمة (D-370) · خبرُنا */
export function likeOf(row: CommunityFeedRow): { likes: number; liked: boolean } {
  if (row.kind === "news") return { likes: row.likes, liked: row.liked_by_me };
  if (row.item.listId) return { likes: row.list_social?.likes ?? 0, liked: row.list_social?.liked_by_me ?? false };
  return { likes: row.item.likes, liked: row.item.likedByMe };
}

function setLike(row: CommunityFeedRow, liked: boolean): CommunityFeedRow {
  const d = liked ? 1 : -1;
  if (row.kind === "news") return { ...row, liked_by_me: liked, likes: Math.max(0, row.likes + d) };
  if (row.item.listId) {
    const s = row.list_social ?? { likes: 0, replies: 0, liked_by_me: false };
    return { ...row, list_social: { ...s, liked_by_me: liked, likes: Math.max(0, s.likes + d) } };
  }
  return { ...row, item: { ...row.item, likedByMe: liked, likes: Math.max(0, row.item.likes + d) } };
}

function likeBody(row: CommunityFeedRow, on: boolean): LikeBody {
  if (row.kind === "news") return { target: "post", tmdb_id: row.item.tmdb_id, media_type: row.item.media_type, on };
  if (row.item.listId) return { target: "list_review", user_id: row.item.person.id, list_id: row.item.listId, on };
  return { target: "review", user_id: row.item.person.id, tmdb_id: row.item.tmdb_id, media_type: row.item.media_type, on };
}

/** رسالةُ الخطأ من مفتاحه في القاموس (`message_key`) — نهجُ المكتبة (`savePrefs`) */
export function errorText(t: Dict, e: unknown): string {
  const key = e instanceof ApiError ? e.error.message_key : "apiInternal";
  const msg = (t as unknown as Record<string, unknown>)[key];
  return typeof msg === "string" ? msg : t.apiInternal;
}

export function useCommunityActs(d: CommunityPayload | null, t: Dict, say: Say): CommunityActs {
  const signedIn = !!d?.viewer.signed_in;
  const meId = d?.viewer.me_id ?? null;
  const admin = !!d?.viewer.admin;
  /* ما في الطريق إلى الخادم — ضغطةٌ ثانيةٌ عليه تُتجاهَل كـ`pending` في الويب */
  const busy = useRef(new Set<string>());
  /* «طلبتَ المتابعة» لا يصل في الحمولة (`following_ids` وحدَها، كالويب) — يُحفظ هنا لما طُلب في هذه الجلسة */
  const [requested, setRequested] = useState<ReadonlySet<string>>(() => new Set());
  const [followingNow, setFollowingNow] = useState<ReadonlyMap<string, boolean>>(() => new Map());
  const tRef = useRef(t);
  const sayRef = useRef(say);
  useEffect(() => {
    tRef.current = t;
    sayRef.current = say;
  }, [t, say]);

  const like = useCallback((row: CommunityFeedRow) => {
    const k = `like:${row.key}`;
    if (busy.current.has(k)) return;
    busy.current.add(k);
    haptic.pick();
    const was = likeOf(row).liked;
    patchRow(row.key, (r) => setLike(r, !was));
    write<{ done: true }>("/api/v1/community/like", likeBody(row, !was))
      .catch((e: unknown) => {
        patchRow(row.key, (r) => setLike(r, was));
        sayRef.current(errorText(tRef.current, e));
      })
      .finally(() => busy.current.delete(k));
  }, []);

  const reply = useCallback(async (row: CommunityFeedRow, body: string): Promise<boolean> => {
    const b: ReplyBody | null =
      row.kind === "news"
        ? { target: "news", post_key: row.item.key, body }
        : row.item.listId
          ? null
          : { target: "review", user_id: row.item.person.id, tmdb_id: row.item.tmdb_id, media_type: row.item.media_type, body };
    if (!b) return false;
    try {
      await write<{ reply_id: string | null }>("/api/v1/community/reply", b);
      patchRow(row.key, (r) => ({ ...r, replies: r.replies + 1 }));
      haptic.success();
      sayRef.current(tRef.current.replySentToast);
      return true;
    } catch (e) {
      sayRef.current(errorText(tRef.current, e));
      return false;
    }
  }, []);

  const pin = useCallback(
    (room: CommunityRoom) => {
      const k = `pin:${room.mediaType}-${room.tmdbId}`;
      if (busy.current.has(k)) return;
      busy.current.add(k);
      haptic.pick();
      /* الإدارةُ دبّوسُها للجميع (درجة ٢) ويحلّ محلَّ الشخصيّ (D-314)؛ وغيرُها درجةُ ١ */
      const level: 1 | 2 = admin ? 2 : 1;
      const was = room.pin;
      const on = was !== level;
      const next: CommunityRoom["pin"] = on ? level : 0;
      const setPin = (p: CommunityRoom["pin"]) =>
        patchPayload((x) => ({
          ...x,
          rooms: x.rooms.map((r) => (r.tmdbId === room.tmdbId && r.mediaType === room.mediaType ? { ...r, pin: p } : r)),
        }));
      setPin(next);
      const body: RoomPinBody = { tmdb_id: room.tmdbId, media_type: room.mediaType, on, ...(admin ? { global: true } : {}) };
      write<{ done: true }>("/api/v1/community/pin", body)
        .catch((e: unknown) => {
          setPin(was);
          sayRef.current(errorText(tRef.current, e));
        })
        .finally(() => busy.current.delete(k));
    },
    [admin],
  );

  const followState = useCallback(
    (userId: string, following: boolean): FollowState => {
      const now = followingNow.get(userId);
      if (now !== undefined) return now ? "following" : requested.has(userId) ? "requested" : "none";
      return following ? "following" : requested.has(userId) ? "requested" : "none";
    },
    [followingNow, requested],
  );

  const follow = useCallback(
    (userId: string, following: boolean) => {
      const k = `follow:${userId}`;
      if (busy.current.has(k)) return;
      busy.current.add(k);
      haptic.pick();
      const prev = followState(userId, following);
      const on = prev === "none";
      const mark = (state: FollowState) => {
        setFollowingNow((m) => new Map(m).set(userId, state === "following"));
        setRequested((s) => {
          const n = new Set(s);
          if (state === "requested") n.add(userId);
          else n.delete(userId);
          return n;
        });
      };
      /* الإلغاءُ متفائلٌ؛ والمتابعةُ تنتظر الجوابَ لأنه قد يكون «طلبتَ» لا «تتابعه» (`FollowUserButton`) */
      if (!on) mark("none");
      write<FollowUserResult>("/api/v1/community/follow", { user_id: userId, on })
        .then((r) => {
          mark(r.state);
          if (r.state === "requested") sayRef.current(tRef.current.followRequestSent);
          /* `following_ids` في الحمولتين تتبع الخادم — فالمعاينةُ و«عرض الكل» يتّفقان بعد الرجوع */
          const put = (ids: string[]) => (r.state === "following" ? [...new Set([...ids, userId])] : ids.filter((x) => x !== userId));
          patchPayload((x) => ({ ...x, following_ids: put(x.following_ids) }));
          queryClient.setQueriesData<CommunityPeopleAllPayload>({ queryKey: ["community", "people"] }, (p) => (p ? { ...p, following_ids: put(p.following_ids) } : p));
        })
        .catch((e: unknown) => {
          mark(prev);
          sayRef.current(errorText(tRef.current, e));
        })
        .finally(() => busy.current.delete(k));
    },
    [followState],
  );

  return useMemo(
    () => ({ signedIn, meId, admin, like, reply, pin, followState, follow }),
    [signedIn, meId, admin, like, reply, pin, followState, follow],
  );
}

/**
 * ====== عدُّ المشاهدات — `PostViews` الويب ======
 * البطاقةُ تُعدّ مرّةً حين يظهر نصفُها (`itemVisiblePercentThreshold: 50` = `threshold: 0.5`)، والدفعةُ تُرسل بعد
 * سكونٍ ثانيةً ونصفاً وعند المغادرة. **صفُّ القائمة لا يُعدّ** (D-237 — لا خانةَ له)، **والزائرُ لا يكتب**.
 * **والعدُّ في عمر التطبيق لا الشاشة**: الخادمُ يعدّ الشخصَ مرّةً على أيّ حال، فإرسالُ ما أُرسل هدرٌ صافٍ.
 */
const counted = new Set<string>();

export function useViewCounter(enabled: boolean) {
  const pending = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!pending.current.size) return;
    const keys = [...pending.current];
    pending.current.clear();
    /* لا انتظارَ ولا رسالة: عدّادٌ ضائعٌ لا يوقف القارئ */
    void write("/api/v1/community/views", { keys }).catch(() => {});
  }, []);
  useEffect(() => flush, [flush]);
  /* آخرُ ما ظهر — يُعدّ حين يصير اللوحُ هو المفتوح: الجارُ المسخَّن (K2) يُرسم خارج الشاشة أفقيّاً، والقائمةُ لا تعرف ذلك */
  const last = useRef<{ item: CommunityFeedRow }[]>([]);
  const enabledRef = useRef(enabled);
  const take = useCallback(() => {
    for (const v of last.current) {
      const row = v.item;
      if (row.views == null || (row.kind === "comment" && row.item.listId)) continue;
      if (counted.has(row.view_key)) continue;
      counted.add(row.view_key);
      pending.current.add(row.view_key);
    }
    if (pending.current.size) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, 1500);
    }
  }, [flush]);
  useEffect(() => {
    enabledRef.current = enabled;
    if (enabled) take();
  }, [enabled, take]);
  /* ثابتُ المرجع لزاماً: `FlatList` يرفض تبديلَ `onViewableItemsChanged` بعد التركيب */
  const takeRef = useRef(take);
  useEffect(() => {
    takeRef.current = take;
  }, [take]);
  const [onViewableItemsChanged] = useState(() => ({ viewableItems }: { viewableItems: { item: CommunityFeedRow }[] }) => {
    last.current = viewableItems;
    if (enabledRef.current) takeRef.current();
  });
  return { onViewableItemsChanged, viewabilityConfig: VIEWABILITY };
}

const VIEWABILITY = { itemVisiblePercentThreshold: 50 } as const;
