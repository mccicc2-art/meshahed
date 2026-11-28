import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, FlatList, Platform, Pressable, StyleSheet, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { Image } from "expo-image";
import { avatarSource } from "../avatarSource";
import { useNavigationContainerRef, useRouter } from "expo-router";
import { stackAboveRoots } from "../nativeStack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, qk, write } from "../api";
import { useApp } from "../state";
import { shell, type NativeRoot } from "../shell";
import { Button, Text, TopBar, TOP_BAR_H, type ToastTone } from "../ui";
import { Icon, type IconName } from "../icons";
import { radius } from "../theme";
import { num } from "@/core/i18n";
import { backdropUrl } from "@/core/media";
import { LIST_MEMBERS_MAX } from "@/core/contracts/library";
import { gridCards, RailCard } from "../discover/RailCard";
import { HoldHost, ToastHost, type HoldHostRef, type ToastHostRef } from "../HoldHost";
import { CardStoreContext, createCardStore } from "../cardStore";
import { marksOf, toWatchState, useCardActs } from "../cardActs";
import { ListReviewSheet, type MyReview } from "../library/ListReviewSheet";
import { ReorderSheet } from "../library/ReorderSheet";
import { ListEditSheet } from "./ListEditSheet";
import { ListCoverSheet } from "./ListCoverSheet";
import { ListMoreSheet, hasListMore, type ListMoreAction } from "./ListMoreSheet";
import { ListReviews } from "./ListReviews";
import { ShareListSheet } from "./ShareListSheet";
import { ListMembersSheet } from "./ListMembersSheet";
import { ListInviteSheet } from "./ListInviteSheet";
import { haptic } from "../haptics";
import type { HoldAction } from "../library/HoldMenu";
import type { CardAnchor, CardItem } from "../library/PosterCard";
import type { CuratedCard } from "../contracts";
import type {
  LibraryPayload, ListCoverBody, ListDeleteBody, ListDetailItem, ListDetailPayload, ListPlaylistBody, ListReorderBody, ListReplyDeleteBody,
  ListReviewLikeBody, ListReviewReplyBody, ListToggleItemBody, ListUpdateBody, QueueItem, SaveListBody, LikeListBody,
  ListMember, ListMembersBody, ListMembersPayload,
} from "../contracts";
import { openProfile, profileHandleOf } from "../member/open";
import { profileHref } from "@/core/people";
import { useHomeDoor } from "../homeDoor";

/**
 * ====== صفحةُ القائمة — شاشةٌ أصليّة (D-1036 · الشريحةُ الأولى: القراءة) ======
 *
 * **لماذا** (طلبُ أحمد بعد بلاغ D-1035: «اجعل صفحة القائمة تطبيق أصليّة»): أكثرُ صفحة ويب تُفتح من
 * داخل شاشتين أصليّتين — برأسٍ آخر وانتقالٍ أبطأ وضوءِ شريطٍ يُخمَّن. الآن تُدفع في المكدّس فوق
 * «المكتبة»/«اكتشف» كصفحة العمل (D-956)، والرجوعُ يعيد ما تحتها كما تُرك.
 *
 * 🆕 **T578 — التخطيطُ «أ» من ت٣** (أحمد ٢٦ نوفمبر ٢٠٢٦، يطوي D-678): **الغلافُ يحمل الاسمَ والنبذةَ وصاحبَها وعددَ
 * الأعمال** · **الأعمالُ كلُّها شبكةٌ** مرقَّمةٌ (أو بسنة الفوز — D-995) · **شريطُ الحال** ♥ 💬 ★ · ثمّ الآراء. سقط سطرُ الحقائق
 * («مرتّبة» تقولها الأرقام، و«معلنة» لا تعني القارئ) وأزرارُ الأسفل؛ أدواتُ القائمة كلُّها في «⋯» (`ListMoreSheet`)،
 * وقائمةُ غيرك فيها «احفظ» وحده في الغلاف.
 * 🔑 **لا عنصرَ جديداً**: `RailCard` بطاقةُ «اكتشف» · `HoldHost`/`ToastHost`/`cardStore` (D-1028) ·
 * `useCardActs` (مستخرَجٌ من «اكتشف») · `ListReviewSheet` ورقةُ رأيي القائمة · `ReviewRow` صفُّ رأي العمل.
 *
 * 🆕 **D-1037 · D-1038 (L2)** — صار أصليّاً: تحريرُ المالك (الاسمُ · النبذةُ · الخصوصيّةُ · النوع · الترتيبُ
 * بالسحب · الغلاف · الحذف) · إزالةُ عملٍ من قائمتي (صفٌّ في قائمة الضغط المطوّل) · مفتاحُ التشغيل · القلوبُ
 * والردودُ على آراء الناس. **كلُّ كتابةٍ تفاؤليّةٌ في كاش الصفحة، وتتراجع عند الفشل بإعادة الجلب.**
 * ⚖️ **ما بقي ويبيّاً ببابٍ ظاهر — ثلاثةٌ مربوطةٌ بشاشاتٍ لم تُنقل**: إضافةُ عمل (⇐ البحث) · المشاركةُ لصديق/
 * مجتمع وورقةُ الإعلان (⇐ شاشاتُ الناس) · محرّرُ شرط القائمة الذكيّة. تُغلق حين تُنقل شاشاتُها، لا قبلها.
 */
const PAGE_PAD = 16;
const GAP = 10;

const asCard = (it: ListDetailItem): CuratedCard => ({ kind: it.kind, id: it.id, title: it.title, poster_path: it.poster_path, imdb_rating: null }) as CuratedCard;
const keyOf = (it: ListDetailItem) => `${it.kind}-${it.id}`;
const VEIL = require("../../assets/poster-veil.png");

export function ListScreen({ id, from, invite = false }: { id: string; from: NativeRoot; invite?: boolean }) {
  const { t, tokens, locale, me } = useApp();
  const router = useRouter();
  const nav = useNavigationContainerRef();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: qk.list(id),
    queryFn: async () => (await api<ListDetailPayload>(`/api/v1/lists/${id}`)).data,
    staleTime: 60_000,
  });
  const d = q.data;
  /* خيطُ المكتبة تحت الملصقات — كاشُ `me:library` المشترك، عبر `cardStore` فتُعاد البطاقةُ المعنيّةُ وحدَها */
  const lib = useQuery({
    queryKey: qk.tag("me:library"),
    queryFn: async () => (await api<LibraryPayload>("/api/v1/me/library")).data,
    staleTime: 60_000,
  });
  const [store] = useState(createCardStore);
  const marks = useMemo(() => marksOf(lib.data?.items), [lib.data]);
  useEffect(() => store.setBase(marks), [store, marks]);

  /* 🆕 D-1611 — ضغطةٌ مطوّلةٌ على الرجوع ترجع إلى أوّل التبويب (`useHomeDoor`) */
  const home = useHomeDoor();
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

  const toastHost = useRef<ToastHostRef>(null);
  /* D-1326 — النغمةُ تُعلَن حيث يُعرف المعنى: نجاحٌ أخضر · معلومةٌ محايدة · والغائبُ خطأٌ كما كان */
  const say = useCallback((text: string, tone?: ToastTone) => toastHost.current?.say(text, undefined, undefined, tone), []);
  const fail = useCallback(
    (e: unknown) => {
      const key = e instanceof ApiError ? e.error.message_key : "apiInternal";
      const msg = (t as unknown as Record<string, unknown>)[key];
      say(typeof msg === "string" ? msg : t.apiInternal);
      void q.refetch();
    },
    [t, say, q],
  );

  const openCard = useCallback((c: { kind: "tv" | "movie"; id: number }) => router.push({ pathname: "/title/[kind]/[id]", params: { kind: c.kind, id: String(c.id), from } }), [router, from]);
  /* بابُ الويب لما لم يُنقل بعد — الرجوعُ منه يعيد الشاشةَ التي فُتحت منها القائمة (D-949) */
  /* 🔴 M3-fix — `dismissAll` لا `back()`: القائمةُ من جذرٍ فوق مجموعة التبويبات، فالرجوعُ خطوةً يكشف الجذرَ لا الصفحة */
  /* 🆕 K3b — ظهرت طبقةً ⇒ القائمةُ تبقى تحتها (والطريقُ القديمُ إن لم تظهر) */
  const openWeb = useCallback(
    (path: string) => {
      /* 🆕 11-N · N1 — ملفُّ الشخص (صاحبُ القائمة) أصليٌّ (`member/open.ts`) */
      const who = profileHandleOf(path);
      if (who) return openProfile(router, who, from);
      void shell
        .open(path, { returnTo: from, resume: stackAboveRoots(nav.getRootState()) })
        .then((layered) => (layered ? undefined : router.canDismiss() ? router.dismissAll() : router.replace("/web")));
    },
    [from, router, nav],
  );

  const holdHost = useRef<HoldHostRef<CuratedCard>>(null);
  const hold = useCallback((c: CuratedCard, anchor: CardAnchor) => holdHost.current?.open(c, anchor), []);
  const onHeld = useCallback((c: CuratedCard | null) => store.setHeld(c ? `${c.kind}-${c.id}` : null), [store]);
  const cardAct = useCardActs<CuratedCard>(store, { onReview: openCard, onError: fail, say });

  /* ====== D-1037 — كتاباتُ المالك ====== تفاؤلٌ في كاش الصفحة؛ `fail` يعيد الجلبَ فيتراجع كلُّ شيء */
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<null | "more" | "edit" | "reorder" | "cover" | "share" | "members" | "invite">(null);
  /* 🆕 T450 — **`invite` يفتح ورقةَ الدعوة مرّةً حين تصل القائمة**: مفتاحُ «ادعُ أصدقاء» في «قائمة جديدة» يصل إلى الورقة نفسِها */
  const invited = useRef(false);
  useEffect(() => {
    if (!invite || invited.current || !d?.can_invite) return;
    invited.current = true;
    setSheet("invite");
  }, [invite, d?.can_invite]);
  const patch = useCallback((fn: (p: ListDetailPayload) => ListDetailPayload) => qc.setQueryData<ListDetailPayload>(qk.list(id), (p) => (p ? fn(p) : p)), [qc, id]);
  const run = useCallback(
    async (optimistic: ((p: ListDetailPayload) => ListDetailPayload) | null, job: () => Promise<unknown>, done?: () => void) => {
      setBusy(true);
      if (optimistic) patch(optimistic);
      try {
        await job();
        done?.();
        return true;
      } catch (e) {
        fail(e);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [patch, fail],
  );
  const act = useCallback(
    async (a: HoldAction, c: CuratedCard): Promise<boolean> => {
      if (a !== "remove") return cardAct(a, c);
      /* إزالةٌ من **القائمة** لا من المكتبة — `toggle-item` بـ`add:false`، وهو مسارُ صفحة العمل نفسُه */
      return run(
        (p) => ({ ...p, items: p.items.filter((x) => !(x.kind === c.kind && x.id === c.id)) }),
        () => write<{ done: true }>("/api/v1/lists/toggle-item", { listId: id, tmdbId: c.id, mediaType: c.kind, title: c.title, posterPath: c.poster_path, add: false } satisfies ListToggleItemBody),
      );
    },
    [cardAct, run, id],
  );
  const saveMeta = useCallback(
    (v: Omit<ListUpdateBody, "listId">) =>
      void run(
        (p) => ({ ...p, name: v.name, subtitle: v.subtitle ?? null, is_public: v.isPublic, kind: v.kind ?? p.kind }),
        () => write<{ done: true }>("/api/v1/lists/update", { listId: id, ...v } satisfies ListUpdateBody),
        () => {
          setSheet(null);
          /* الإعلانُ يفتح شريطَ الحال والآراء — وأعدادُها عند الخادم */
          void q.refetch();
          /* D-1328 — الاسمُ الجديد يظهر في ورقة «إضافة إلى قائمة» بكلِّ صفحة عملٍ مفتوحة */
          void qc.invalidateQueries({ queryKey: ["title:extras"] });
        },
      ),
    [run, id, q, qc],
  );
  const saveOrder = useCallback(
    (keys: string[]) =>
      void run(
        (p) => {
          const by = new Map(p.items.map((x) => [`${x.kind}-${x.id}`, x]));
          const next = keys.map((k) => by.get(k)).filter((x): x is ListDetailItem => !!x);
          return { ...p, items: next.length === p.items.length ? next : p.items };
        },
        () => write<{ done: true }>("/api/v1/lists/reorder", { listId: id, keys } satisfies ListReorderBody),
        () => setSheet(null),
      ),
    [run, id],
  );
  const saveCover = useCallback(
    (v: Omit<ListCoverBody, "listId">) =>
      void run(
        (p) => ({ ...p, cover: { tmdb_id: v.tmdbId, media_type: v.mediaType, backdrop_path: v.backdropPath } }),
        () => write<{ done: true }>("/api/v1/lists/cover", { listId: id, ...v } satisfies ListCoverBody),
        () => {
          setSheet(null);
          say(t.savedToast, "success");
        },
      ),
    [run, id, say, t],
  );
  /* 🆕 T450 — **«أضف أعمالاً» صفحةُ الاختيار** (`/list/new?add=`): دفعةٌ من الملصقات — مكتبتُك بفلاترها والكتالوجُ بالبحث —
     بدل منتقٍ يُضيف عملاً واحداً في كلِّ ضغطة (كان G4). **بلا `from`**: الإضافةُ تبحث في الكتالوج كلِّه دائماً كالويب —
     قائمةٌ فُتحت من «المكتبة» لا تُحصر بما في مكتبتك. الكتابةُ `add-items` ووسمُها `list:<id>` يجدّد هذه الصفحةَ عند الرجوع */
  const addTitles = useCallback(() => router.push({ pathname: "/list/new", params: { add: id } }), [router, id]);
  const removeList = useCallback(
    () =>
      void run(null, () => write<{ done: true }>("/api/v1/lists/delete", { listId: id } satisfies ListDeleteBody), () => {
        qc.removeQueries({ queryKey: qk.list(id) });
        /* D-1328 — القائمةُ المحذوفة لا تبقى صفّاً في ورقة «إضافة إلى قائمة» */
        void qc.invalidateQueries({ queryKey: ["title:extras"] });
        back();
      }),
    [run, id, qc, back],
  );
  const setPlaylist = useCallback(
    (on: boolean) =>
      void run(
        (p) => ({ ...p, playlist: on }),
        () => write<{ on: boolean }>("/api/v1/lists/playlist", { listId: id, on } satisfies ListPlaylistBody),
        () => (on ? say(t.listPlaylistOnToast, "success") : say(t.listPlaylistOffToast, "info")),
      ),
    [run, id, say, t],
  );

  /* ====== D-1038 — القلبُ والردُّ على رأي ====== */
  const likeReview = useCallback(
    (reviewUserId: string, liked: boolean) =>
      void run(
        (p) => ({ ...p, review_rows: p.review_rows.map((r) => (r.user_id === reviewUserId ? { ...r, liked_by_me: liked, likes: Math.max(0, r.likes + (liked ? 1 : -1)) } : r)) }),
        () => write<{ liked: boolean }>("/api/v1/lists/review-like", { listId: id, reviewUserId, liked } satisfies ListReviewLikeBody),
      ),
    [run, id],
  );
  const replyReview = useCallback(
    (reviewUserId: string, body: string, parentId: string | null) =>
      /* الردُّ **لا يُخمَّن**: اسمي وصورتي ومعرّفُ الردّ عند الخادم — يُجلب بعد الكتابة */
      run(null, () => write<{ reply_id: string | null }>("/api/v1/lists/review-reply", { listId: id, reviewUserId, body, parentId } satisfies ListReviewReplyBody), () => {
        say(t.replySentToast, "success");
        void q.refetch();
      }),
    [run, id, say, t, q],
  );
  const deleteReply = useCallback(
    (replyId: string) =>
      void run(
        (p) => ({ ...p, reply_rows: p.reply_rows.filter((x) => x.reply_id !== replyId && x.parent_id !== replyId) }),
        () => write<{ done: true }>("/api/v1/lists/reply-delete", { listId: id, replyId } satisfies ListReplyDeleteBody),
        () => void q.refetch(),
      ),
    [run, id, q],
  );
  const queue: QueueItem[] = useMemo(() => (d?.items ?? []).map((x) => ({ key: `${x.kind}-${x.id}`, title: x.title, poster_path: x.poster_path, media_type: x.kind })), [d]);
  const heldItemOf = useCallback(
    (c: CuratedCard): CardItem => {
      const m = store.mark(`${c.kind}-${c.id}`);
      return { key: `${c.kind}-${c.id}`, kind: c.kind, id: c.id, title: c.title, posterPath: c.poster_path, progress: m?.progress ?? 0, completed: !!m?.completed, dropped: !!m?.dropped };
    },
    [store],
  );
  const toWatchOf = useCallback((c: CuratedCard) => toWatchState(store.mark(`${c.kind}-${c.id}`)), [store]);

  /* الحفظُ تفاؤليّاً في كاش الصفحة — 🆕 249 رقاقةُ «احفظ» في طرف شريط الحال (القلبُ صار إعجاباً) */
  /* 🆕 249 — **حارسٌ في مرجعٍ لا في الحالة وحدَها**: ضغطتان في الإطار نفسِه كانتا تمرّان من حارس الحالة
     معاً فيُحسب العدُّ مرّتين حتى يعود الطلب — والمرجعُ يتبدّل في اللحظة لا بعد الرسم. */
  const saveBusy = useRef(false);
  const toggleSave = useCallback(async () => {
    if (!d || !d.can_save || saveBusy.current) return;
    saveBusy.current = true;
    const want = !d.saved_by_me;
    /* 🆕 T583 («١ب») — الحفظُ يضعها في «تابِع المشاهدة» معاً، وإلغاؤه يُخرجها (الخادمُ يفعل الأمرين — `lists/save`) */
    qc.setQueryData<ListDetailPayload>(qk.list(id), (p) => (p ? { ...p, saved_by_me: want, saves: Math.max(0, p.saves + (want ? 1 : -1)), playlist: want ? true : null } : p));
    try {
      await write<{ saved: boolean }>("/api/v1/lists/save", { listId: id, save: want } satisfies SaveListBody);
      if (want) say(t.listSavedToast, "success");
      else say(t.listUnsavedToast, "info");
      /* صفُّ «تابِع المشاهدة» في الرئيسية يتبدّل معها */
      void qc.invalidateQueries({ queryKey: qk.tag("home") });
    } catch (e) {
      fail(e);
    } finally {
      saveBusy.current = false;
    }
  }, [d, qc, id, say, t, fail]);

  /* 🆕 249 — **الإعجابُ منفصلٌ عن الحفظ** (أحمد ١٩ نوفمبر ٢٠٢٦): القلبُ يُعجب ولا يضيفها إلى قوائمك — تفاؤليٌّ في كاش
     الصفحة كأخيه، وعدُّه عددُ المعجبين. والنسخُ أُزيل («قراري ازالة النسخ — تقدر تحفظ اللستة») */
  const [liking, setLiking] = useState(false);
  const likeBusy = useRef(false);
  const toggleLike = useCallback(async () => {
    if (!d || !d.can_save || likeBusy.current) return;
    likeBusy.current = true;
    const want = !d.liked_by_me;
    setLiking(true);
    haptic.pick();
    qc.setQueryData<ListDetailPayload>(qk.list(id), (p) => (p ? { ...p, liked_by_me: want, likes: Math.max(0, (p.likes ?? 0) + (want ? 1 : -1)) } : p));
    try {
      await write<{ liked: boolean }>("/api/v1/lists/like", { listId: id, like: want } satisfies LikeListBody);
    } catch (e) {
      qc.setQueryData<ListDetailPayload>(qk.list(id), (p) => (p ? { ...p, liked_by_me: !want, likes: Math.max(0, (p.likes ?? 0) + (want ? -1 : 1)) } : p));
      fail(e);
    } finally {
      likeBusy.current = false;
      setLiking(false);
    }
  }, [d, qc, id, fail]);

  /* 🆕 234 — **ردُّ المدعوّ** (٢أ): «قبول» يجعله عضواً فيصير «أضف أعمالاً» له؛ «لا شكراً» يحذف الدعوةَ ويرجع —
     القائمةُ الخاصّةُ لا يراها بعدها، فالبقاءُ في صفحتها يعرض فراغاً */
  const [responding, setResponding] = useState(false);
  const respond = useCallback(
    async (accept: boolean) => {
      if (responding) return;
      setResponding(true);
      try {
        await write<ListMembersPayload>("/api/v1/lists/members", { listId: id, action: "respond", accept } satisfies ListMembersBody);
        if (accept) {
          haptic.success();
          say(t.listJoined, "success");
          void q.refetch();
        } else {
          back();
        }
      } catch (e) {
        fail(e);
      } finally {
        setResponding(false);
      }
    },
    [responding, id, say, t, q, back, fail],
  );

  const [reviewOpen, setReviewOpen] = useState(false);
  const onReviewSaved = useCallback(
    (next: MyReview | null) => {
      setReviewOpen(false);
      qc.setQueryData<ListDetailPayload>(qk.list(id), (p) => (p ? { ...p, my_review: next } : p));
      /* المتوسّطُ والعدُّ وصفُّ رأيي في قائمة الآراء يحسبها الخادم — تُجلب بعد الكتابة لا تُخمَّن */
      void q.refetch();
      void qc.invalidateQueries({ queryKey: ["me:lists"] });
    },
    [qc, id, q],
  );

  /* Phase 11-G (G6) — ورقةُ المشاركة أصليّة (`ShareListSheet`): كان ما سبق ورقةَ النظام للمعلنة وبابَ ويبٍ
     (`?share=1`) لقائمتي الخاصّة؛ الآن الورقةُ نفسُها للحالتين — والإعلانُ ثمّ الصديقُ والمجتمعُ والرابطُ فيها */
  const share = useCallback(() => {
    if (!d) return;
    setSheet("share");
  }, [d]);

  const numbered = d ? d.kind === "ranked" || d.kind === "watch_order" : false;
  /* 🆕 T578 — **الأعمالُ كلُّها شبكةً** (ت٣ «أ»): كان رفّاً أفقيّاً (D-678) يُخفي أغلبَها خلف السحب؛ حكمُ أحمد ٢٦ نوفمبر أن تظهر
     كلُّها تحت الغلاف — `gridCards` نفسُها التي تملأ عرضَ شبكتَي الشخص و«عرض الكلّ» */
  const { width } = useWindowDimensions();
  const { cols, w: cardW } = gridCards(width, PAGE_PAD, GAP);
  /* 🆕 234 — صورةُ من أضاف العملَ على زاويته (٥أ): من الأعضاء المعروفين وحدَهم — من أُزيل أو أخفى صورتَه بلا صورة */
  const avatarOf = useMemo(() => new Map((d?.members ?? []).map((m) => [m.id, m.avatar])), [d?.members]);
  const renderItem = useCallback(
    ({ item, index }: { item: ListDetailItem; index: number }) => {
      const card = <RailCard card={asCard(item)} rank={item.badge ?? (numbered ? index + 1 : null)} rankTone={item.badge !== null ? "accent" : undefined} lib={null} onPress={openCard} onHold={hold} width={cardW} />;
      const by = item.added_by ? avatarOf.get(item.added_by) : undefined;
      if (by === undefined) return card;
      return (
        <View>
          {card}
          <View pointerEvents="none" style={{ position: "absolute", top: 6, end: 6, width: 20, height: 20, borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: tokens.bg, backgroundColor: tokens.surface2 }}>
            {by ? <Image source={{ uri: by }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : null}
          </View>
        </View>
      );
    },
    [numbered, openCard, hold, avatarOf, tokens, cardW],
  );

  /* 🆕 234 — سطرُ الأعضاء (الشكلُ «أ»): صاحبُها والفعّالون — المعلّقون في الورقة وحدَها */
  const shown = (d?.members ?? []).filter((m: ListMember) => m.role !== "pending");
  const sharedRow = shown.length > 1;

  /* 🆕 T578 — **الغلافُ يحمل كلَّ شيء** (ت٣ «أ»): الاسمُ والنبذةُ وصاحبُها وعددُ الأعمال فوق الصورة، و«احفظ» لقائمة غيرك في
     طرف سطرها. القائمةُ بلا غلافٍ تأخذ خلفيّةَ أوّل عمل (`cover_art` من الخادم · س٦)، والغلافُ الذي يُختار الآن يغلب فوراً.
     **الغلافُ داكنٌ في كلِّ ثيم والكتابةُ فوقه بيضاء** — حكمُ D-1506 في بطل صفحة العمل نفسُه */
  const art = d ? (d.cover?.backdrop_path ?? d.cover_art ?? null) : null;
  /* 🆕 T606 (q44 «أ» — أحمد: «قلّل ارتفاع الغلاف قليلاً ٢٠٪ تقريباً») — ٠٫٧٢ ⇐ ٠٫٥٨ من العرض: الشبكةُ تصعد.
     **ولا يصعد الكلامُ تحت الشريط**: اسمٌ بسطرين ونبذةٌ بسطرين وصفُّ الحال قد تطول عن الغلاف الأقصر، فيطول الغلافُ بقدرها وحدها */
  const [infoH, setInfoH] = useState(0);
  const coverH = Math.max(insets.top + Math.round(width * 0.58), infoH ? insets.top + TOP_BAR_H + 8 + infoH : 0);
  /* الشريطُ فوق الغلاف شفّافٌ وأزرارُه بيضاء؛ إذا صعد الغلافُ صار شريطَ الصفحة بلونها واسمِ القائمة (الرجوعُ في مكانه دائماً — D-1624) */
  const [solid, setSolid] = useState(false);
  const listRef = useRef<FlatList<ListDetailItem>>(null);
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = e.nativeEvent.contentOffset.y > coverH - insets.top - TOP_BAR_H - 8;
      setSolid((s) => (s === next ? s : next));
    },
    [coverH, insets.top],
  );
  const barInk = solid ? tokens.fg : "#fff";
  const WHITE_MUTED = "rgba(255,255,255,0.78)";
  const count = d ? (d.smart ? t.smartListLabel : t.listCount(d.items.length)) : "";

  /* 🆕 T583 — **خطوةُ المشاهدة**: أوّلُ عملٍ بترتيب القائمة لم تُكمله ولم تتركه، ومعه هل بدأتَ القائمةَ أصلاً («ابدأ» أم «أكمل»).
     ⚖️ موعدُ العرض لا يصل في عناصر القائمة، فعملٌ لم يُعرض بعدُ قد يكون هو الخطوة — صفحتُه تقول ذلك */
  const next = useMemo(() => {
    if (!d) return null;
    const m = (it: ListDetailItem) => marks.get(`${it.kind}-${it.id}`) ?? null;
    const started = d.items.some((it) => { const x = m(it); return !!x && (x.progress > 0 || x.completed); });
    const item = d.items.find((it) => { const x = m(it); return !x || (!x.completed && !x.dropped); });
    return item ? { item, started } : null;
  }, [d, marks]);
  const header = (
    <View>
      <View style={{ height: coverH, backgroundColor: "#0b0b0b", overflow: "hidden" }}>
        {art ? <Image source={{ uri: backdropUrl(art, "w780") ?? undefined }} style={[StyleSheet.absoluteFill, { opacity: 0.8 }]} contentFit="cover" cachePolicy="memory-disk" transition={200} /> : null}
        <Image source={VEIL} style={{ position: "absolute", left: 0, right: 0, top: 0, height: insets.top + 96, opacity: 0.55, transform: [{ rotate: "180deg" }] }} contentFit="fill" />
        <Image source={VEIL} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: Math.round(coverH * 0.62) }} contentFit="fill" />
        {d ? (
          <View onLayout={(e) => setInfoH(Math.ceil(e.nativeEvent.layout.height))} style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: PAGE_PAD, paddingBottom: 16, gap: 6 }}>
            <Text size={26} weight="800" color="#fff" numberOfLines={2} style={{ lineHeight: 34 }}>{d.name}</Text>
            {d.subtitle ? <Text size={14} color={WHITE_MUTED} numberOfLines={2} style={{ lineHeight: 21 }}>{d.subtitle}</Text> : null}
            {/* 🆕 T583 («٢ب ٣أ» — أحمد ٢٦ نوفمبر: «تحتها ماهي واضحة») — **صفُّ الحال صعد إلى الغلاف تحت الوصف**، ومعه علامةُ الحفظ
                بعدد من حفظوها. كلٌّ زرٌّ بقامة الإصبع؛ القلبُ والنجمةُ والعلامةُ مفرّغةٌ حتى تفعلها أنت، والصفرُ لا يُكتب. للمعلنة وحدَها */}
            {d.is_public ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginTop: -4 }}>
                <React_ icon={d.liked_by_me ? "heart-filled" : "heart"} n={d.likes ?? 0} disabled={!d.can_save || liking} label={d.liked_by_me ? t.listUnlikeLabel : t.listLikeLabel} onPress={() => void toggleLike()} />
                <React_ icon="comment" n={d.reviews} label={t.listReviewsTitle} onPress={() => listRef.current?.scrollToEnd({ animated: true })} />
                <React_ icon={d.my_review ? "star-filled" : "star"} text={d.rating !== null ? d.rating.toFixed(1) : null} disabled={!d.can_review} label={t.rateTitle} onPress={() => setReviewOpen(true)} />
                <React_ icon={d.saved_by_me ? "bookmark-filled" : "bookmark"} n={d.saves} disabled={!d.can_save} label={d.saved_by_me ? t.listUnsaveLabel : t.listSaveChip} onPress={() => void toggleSave()} />
              </View>
            ) : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 34, marginTop: 2 }}>
              {/* 🆕 234 — **الشكلُ «أ»**: القائمةُ المشتركة صورٌ مكدّسةٌ وأسماؤها، والضغطةُ تفتح ورقةَ الأعضاء */}
              {sharedRow ? (
                <Pressable onPress={() => setSheet("members")} hitSlop={8} accessibilityRole="button" accessibilityLabel={t.listMembersTitle(shown.length, LIST_MEMBERS_MAX)} style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: "row" }}>
                    {shown.slice(0, 3).map((m, i) => (
                      <View key={m.id} style={{ width: 24, height: 24, borderRadius: 12, overflow: "hidden", marginStart: i ? -8 : 0, borderWidth: 2, borderColor: "#0b0b0b", backgroundColor: "#2a2a2a" }}>
                        {m.avatar ? <Image source={avatarSource(m.avatar)} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : null}
                      </View>
                    ))}
                  </View>
                  <Text size={13} weight="600" color="#fff" numberOfLines={1} style={{ flexShrink: 1 }}>{t.listMembersNames(shown.slice(0, 3).map((m) => m.name), shown.length - 3)}</Text>
                </Pressable>
              ) : d.owner ? (
                <Pressable disabled={!profileHref(d.owner)} onPress={() => { const h = profileHref(d.owner); if (h) openWeb(h); }} hitSlop={6} style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1, minWidth: 0 }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, overflow: "hidden", backgroundColor: "#2a2a2a", borderWidth: 1, borderColor: tokens.accent }}>
                    {d.owner.avatar ? <Image source={avatarSource(d.owner.avatar)} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : null}
                  </View>
                  <Text size={13} weight="600" color="#fff" numberOfLines={1} style={{ flexShrink: 1 }}>{d.owner.name}</Text>
                </Pressable>
              ) : null}
              <Text size={13} color={WHITE_MUTED} numberOfLines={1}>{sharedRow || d.owner ? `· ${count}` : count}</Text>
              {/* 🆕 T578 — **قائمةُ غيرك: زرٌّ واحدٌ بارز** في طرف السطر. 🆕 T583 («١ب») — «احفظ» قبل الحفظ، ثمّ خطوةُ المشاهدة:
                  «ابدأ المشاهدة» ثمّ «أكمل المشاهدة» تفتح أوّلَ عملٍ لم تُكمله بترتيب القائمة؛ وإلغاءُ الحفظ في العلامة و«⋯» */}
              {!d.mine && d.can_save && (!d.saved_by_me || next) ? (
                <View style={{ marginStart: "auto" }}>
                  {d.saved_by_me && next ? (
                    <Button label={next.started ? t.continueWatching : t.listStartWatching} size="sm" onPress={() => openCard(next.item)} />
                  ) : (
                    <Button label={t.listSaveChip} size="sm" onPress={() => void toggleSave()} />
                  )}
                </View>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>

      {/* 🆕 234 — **الدعوةُ فوق الأعمال** (٢أ): من دعاك، وما تقدر عليه، ثمّ «قبول · لا شكراً» */}
      {d?.my_membership === "pending" ? (
        <View style={{ marginHorizontal: PAGE_PAD, marginTop: 16, gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.bg }}>
            <View style={{ width: 32, height: 32, borderRadius: 16, overflow: "hidden", backgroundColor: tokens.surface2 }}>
              {d.owner?.avatar ? <Image source={avatarSource(d.owner.avatar)} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : null}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text size={14} weight="700" numberOfLines={2}>{t.listInviteBanner(d.owner?.name ?? t.anonymousUser)}</Text>
              <Text size={12} muted numberOfLines={1}>{t.listInviteBannerSub}</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Button label={t.listInviteAccept} busy={responding} onPress={() => void respond(true)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label={t.listInviteDecline} variant="ghost" disabled={responding} onPress={() => void respond(false)} />
            </View>
          </View>
        </View>
      ) : null}

      {/* D-1627 — لا ملصقاتٍ رماديّةً تنتظر؛ والقائمةُ الفارغةُ يُضاف إليها من مكانها */}
      {d && d.items.length === 0 ? (
        <View style={{ alignItems: "center", gap: 14, paddingVertical: 48, paddingHorizontal: PAGE_PAD }}>
          <Text size={13} muted style={{ textAlign: "center" }}>{t.listItemsEmpty}</Text>
          {(d.mine && !d.smart) || d.can_edit_items ? <Button label={t.listAddTitles} variant="ghost" onPress={addTitles} /> : null}
        </View>
      ) : (
        <View style={{ height: 16 }} />
      )}
    </View>
  );

  const footer = d?.is_public ? (
    <View>
      {/* 🆕 T583 — شريطُ الحال صعد إلى الغلاف؛ الآراءُ هنا وحدَها، و💬 هناك يأتي إليها */}
      <View style={{ paddingHorizontal: PAGE_PAD, marginTop: 20, gap: 12 }}>
        <Text size={17} weight="700">{t.listReviewsTitle}</Text>
        {d.can_review ? (
          <Button label={d.my_review ? `${t.listReviewMine} · ${num(d.my_review.rating, locale)}/${num(10, locale)}` : t.rateTitle} variant="ghost" onPress={() => setReviewOpen(true)} />
        ) : null}
        <ListReviews rows={d.review_rows} replies={d.reply_rows} canAct={d.can_review || d.mine} busy={busy} onLike={likeReview} onReply={replyReview} onDeleteReply={deleteReply} />
      </View>
    </View>
  ) : undefined;

  const moreAct = useCallback(
    (a: ListMoreAction) => {
      if (a === "add") {
        setSheet(null);
        addTitles();
      } else if (a === "smart") {
        setSheet(null);
        router.push({ pathname: "/list/new", params: { edit: id, from: d?.smart_source === "library" ? "library" : "discover" } });
      } else if (a === "unsave") {
        setSheet(null);
        void toggleSave();
      } else setSheet(a);
    },
    [addTitles, router, id, d?.smart_source, toggleSave],
  );

  return (
    <CardStoreContext.Provider value={store}>
      <View style={{ flex: 1, backgroundColor: tokens.bg }}>
        {!d && q.isError ? (
          <View style={{ padding: PAGE_PAD, alignItems: "center", gap: 12, paddingTop: insets.top + TOP_BAR_H + 48 }}>
            <Text muted>{t.apiInternal}</Text>
            <Button label={t.errorRetry} variant="ghost" onPress={() => void q.refetch()} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            key={cols}
            data={d?.items ?? []}
            numColumns={cols}
            keyExtractor={keyOf}
            renderItem={renderItem}
            columnWrapperStyle={{ gap: GAP, paddingHorizontal: PAGE_PAD, marginBottom: GAP }}
            ListHeaderComponent={header}
            ListFooterComponent={footer}
            onScroll={onScroll}
            scrollEventThrottle={32}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
            initialNumToRender={12}
            windowSize={7}
          />
        )}

        {/* الشريطُ الواحد فوق الغلاف — رجوعٌ · مشاركةٌ · ⋯ (D-1624: الرجوعُ في مكانه في كلِّ صفحة) */}
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, paddingTop: insets.top, backgroundColor: solid ? tokens.bg : "transparent", borderBottomWidth: solid ? 1 : 0, borderBottomColor: tokens.border }}>
          <TopBar
            title={solid ? (d?.name ?? "") : ""}
            onBack={back}
            onBackLong={home}
            backLabel={t.closeLabel}
            color={barInk}
            end={
              d ? (
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Pressable onPress={() => void share()} hitSlop={8} accessibilityLabel={t.shareLinkLabel} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
                    <Icon name="share" size={20} color={barInk} />
                  </Pressable>
                  {hasListMore(d) ? (
                    <Pressable onPress={() => setSheet("more")} hitSlop={8} accessibilityLabel={t.listMoreLabel} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
                      <Icon name="dots" size={20} color={barInk} />
                    </Pressable>
                  ) : null}
                </View>
              ) : undefined
            }
          />
        </View>

        {sheet === "more" && d ? <ListMoreSheet list={d} busy={busy} onAction={moreAct} onPlaylist={setPlaylist} onDelete={removeList} onClose={() => setSheet(null)} /> : null}
        {sheet === "edit" && d ? <ListEditSheet list={d} busy={busy} onSave={saveMeta} onClose={() => setSheet(null)} /> : null}
        {sheet === "reorder" && d ? <ReorderSheet items={queue} onClose={() => setSheet(null)} onDone={saveOrder} /> : null}
        {sheet === "share" && d ? (
          <ShareListSheet
            listId={id}
            name={d.name}
            isPublic={d.is_public}
            mine={d.mine}
            onClose={() => setSheet(null)}
            onChanged={() => {
              patch((p) => ({ ...p, is_public: true }));
              void q.refetch();
              void qc.invalidateQueries({ queryKey: ["me:lists"] });
            }}
            onToast={(s) => say(s, "success")}
            onError={fail}
          />
        ) : null}
        {sheet === "cover" && d ? <ListCoverSheet list={d} busy={busy} onPick={saveCover} onClose={() => setSheet(null)} /> : null}
        {sheet === "members" && d ? (
          <ListMembersSheet
            listId={id}
            members={d.members ?? []}
            mine={d.mine}
            meId={me?.id ?? null}
            onClose={() => setSheet(null)}
            onInvite={d.can_invite ? () => setSheet("invite") : null}
            onChanged={(removed) => patch((p) => ({ ...p, members: (p.members ?? []).filter((m) => m.id !== removed) }))}
            onLeft={() => {
              setSheet(null);
              say(t.listLeft, "info");
              back();
            }}
            onError={fail}
          />
        ) : null}
        {sheet === "invite" && d ? (
          <ListInviteSheet
            listId={id}
            name={d.name}
            members={d.members ?? []}
            onClose={() => setSheet(null)}
            onDone={() => {
              setSheet(null);
              say(t.listInviteSent, "success");
              void q.refetch();
            }}
            onError={fail}
          />
        ) : null}
        <HoldHost hostRef={holdHost} variant={d?.can_edit_items ?? (d?.mine && !d.smart) ? "mylist" : "list"} toItem={heldItemOf} toWatchOf={toWatchOf} onAction={act} onHeld={onHeld} />
        {reviewOpen && d ? <ListReviewSheet listId={id} listName={d.name} mine={d.my_review ? { rating: d.my_review.rating, body: d.my_review.body, has_spoiler: d.my_review.has_spoiler } : null} onClose={() => setReviewOpen(false)} onSaved={onReviewSaved} onError={fail} /> : null}
        <ToastHost hostRef={toastHost} bottom={insets.bottom + 16} />
      </View>
    </CardStoreContext.Provider>
  );
}

/** 🆕 T583 — زرٌّ في صفّ الحال فوق الغلاف: رمزٌ أصفرُ وعددُه أبيض، والصفرُ لا يُكتب؛ قامةُ ٤٠ تصيبها الإصبع */
function React_({ icon, n, text, label, onPress, disabled }: { icon: IconName; n?: number; text?: string | null; label: string; onPress: () => void; disabled?: boolean }) {
  const { tokens } = useApp();
  const value = text ?? (n && n > 0 ? num(n, "ar") : null);
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={6} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => ({ height: 40, flexDirection: "row", alignItems: "center", gap: 6, opacity: pressed ? 0.7 : 1 })}>
      <Icon name={icon} size={20} color={tokens.accent} />
      {value ? <Text size={15} weight="700" color="#fff" style={{ fontVariant: ["tabular-nums"] }}>{value}</Text> : null}
    </Pressable>
  );
}
