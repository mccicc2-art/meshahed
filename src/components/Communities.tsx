"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AccountBadges } from "./AccountIdentity";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { Sheet, SheetHeader } from "./ui/Sheet";
import { buttonClass } from "./ui/Button";
import { getDict, num, type Locale } from "@/lib/i18n";
import { tap } from "@/lib/haptics";
import { toast, flashError } from "@/lib/toast";
import { coalescedRefresh } from "@/lib/refresh";
import { useChatPoll } from "@/lib/usePoll";
import {
  joinCommunity,
  leaveCommunity,
  cancelCommunityRequest,
  acceptCommunityRequest,
  rejectCommunityRequest,
  deleteCommunity,
  postCommunityMessage,
  setCommunityPhoto,
  myFollowingList,
  inviteToCommunity,
  cancelCommunityInvite,
  acceptCommunityInvite,
  rejectCommunityInvite,
} from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";
import { fitForUpload, UPLOAD_MAX_BYTES } from "@/lib/imageFile";
import type {
  CommunityKind,
  CommunityLite,
  CommunityRoomData,
  PersonLite,
} from "@/lib/data";
import { sheetScroll } from "./ui/controls";

type Dict = ReturnType<typeof getDict>;

/**
 * تبويب «المجتمع» — دليلُ مجتمعاتٍ لا خطَّ تفاعلات (communities.sql).
 *
 * قرار المالك: تفاعلات الجميع أُسقطت من هنا («مجتمعي» يكفي لدائرتك،
 * والتقييمات باقيةٌ في صفحة كل عمل)، وحلّ محلّها ما يخدم المجتمعات:
 * «أنشئ مجتمعاً» وبحثٌ بالاسم، ومجتمعاتي في الصدر. لكل شخصٍ مجتمعٌ واحد،
 * عامٌّ (دخولٌ مباشر) أو خاصٌّ (بطلبٍ يقبله المالك)، وفيه دردشةٌ نصّية —
 * غرفةٌ اخترتَ دخولها، فلا تخالف «لا رسائل بلا موضوع» (D-051): تلك عن
 * الوارد المفروض عليك، وهذه بابٌ طرقتَه بنفسك.
 */
export function CommunityDirectory({
  mine,
  invites = [],
  titleRooms = [],
  locale,
}: {
  mine: CommunityLite[];
  /** دعواتٌ معلّقة إليّ — قسمها فوق «مجتمعاتي» (هجرة 42) */
  invites?: CommunityLite[];
  /** غرف الأعمال الحيّة — صفٌّ للاكتشاف أسفل مجتمعاتي (D-140، هجرة 53) */
  titleRooms?: CommunityLite[];
  locale: Locale;
}) {
  const t = getDict(locale);

  /* **الصفُّ الذي كان هنا ذهب خلف الرمز** (طلب أحمد ١١ أغسطس، بلقطةٍ
     مشطوبةٍ بالأحمر — نفسُ ما فعله D-177 بصفّ المكتبة): حقلُ البحث وزرُّ
     «أنشئ مجتمعاً» كانا يتصدّران اللوح قبل أن يظهر مجتمعٌ واحد.
     **والزرُّ سقط بلا بديل** لأنه مكرَّرٌ في ورقة الأدوات منذ D-177،
     **والبحثُ انتقل إليها بنتائجه** لأنه البابُ الوحيد لاكتشاف مجتمعٍ
     بالاسم. وما بقي هنا هو ما تملكه: الدعوات، ثم مجتمعاتك، ثم غرف
     الأعمال الحيّة. */
  return (
    <div className="space-y-5">
      {/* ===== دعواتي — فوق مجتمعاتي: قرارٌ ينتظرك قبل ما تملكه ===== */}
      {invites.length > 0 && (
        <section>
          <p className="text-12 font-semibold text-muted uppercase tracking-wide mb-1.5">
            {t.commInvitesSection}
          </p>
          <ul className="divide-y divide-[color:var(--divider)]">
            {invites.map((c) => (
              <InviteRow key={c.id} c={c} t={t} locale={locale} />
            ))}
          </ul>
        </section>
      )}

      {/* ===== مجتمعاتي ===== */}
      <section>
          <p className="text-12 font-semibold text-muted uppercase tracking-wide mb-1.5">
            {t.commMineSection}
          </p>
          {mine.length === 0 ? (
            /* 🔴 **وسقط زرُّ الإنشاء** (D-306، نصُّ أحمد: «احنا حاذفين
               الكومينتي، فالمفروض ما أحد يقدر يأسس كومينتي جديد») —
               **والفراغُ يبقى صادقاً بلا وعدٍ بفعلٍ أُغلق بابُه**
               (D-063/D-217: لا زرَّ يعد بما يُمنع). */
            <div className="bg-surface border border-dashed border-border rounded-xl py-8 px-5 text-center">
              <p className="text-sm text-muted">{t.commEmptyDir}</p>
            </div>
          ) : (
            <ul className="divide-y divide-[color:var(--divider)]">
              {mine.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/people?tab=all&c=${c.id}`}
                    className="flex items-center gap-3 py-3 hover:bg-surface-2 -mx-2 px-2 rounded-xl transition"
                  >
                    <CommunityBadge name={c.name} photo={c.photo_url} kind={c.kind} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-sm font-semibold truncate">
                        <span className="truncate">{c.name}</span>
                        {c.is_private && (
                          <Icon name="eye-off" size={13} className="text-muted shrink-0" />
                        )}
                      </span>
                      <span className="block text-xs text-muted">
                        {t.commMembers(num(c.member_count, locale))}
                      </span>
                    </span>
                    <Icon name="chevron-down" size={16} className="-rotate-90 rtl:rotate-90 text-muted shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
      </section>

      {/* ===== غرف الأعمال — اكتشافٌ أسفل ما تملكه (D-140).
           لا حالة فراغ لها: القسم كلّه يختفي إن لم توجد غرفةٌ حيّة —
           صندوقُ «لا غرف بعد» يَعِد بشيءٍ لا يستطيع الزائر إنشاءه من
           هنا؛ بابُها صفحةُ العمل وحدها ===== */}
      {titleRooms.length > 0 && (
        <section>
          <p className="text-12 font-semibold text-muted uppercase tracking-wide mb-1.5">
            {t.titleRoomsSection}
          </p>
          <ul className="divide-y divide-[color:var(--divider)]">
            {titleRooms.map((c) => (
              <CommunityRow key={c.id} c={c} t={t} locale={locale} />
            ))}
          </ul>
        </section>
      )}


    </div>
  );
}

/**
 * صفُّ مجتمعٍ في نتائج البحث — زرّه بحسب علاقتي به.
 *
 * **مُصدَّرٌ لا منسوخ** (D-145): بحثُ المجتمعات انتقل إلى ورقة الأدوات،
 * ونتائجُه هناك هي هذه الصفوف نفسها — ونسخةٌ ثانية منها كانت ستتفرّق عند
 * أوّل تعديل. و`onNavigate` هي كلُّ ما احتاجه الانتقال: **الورقة تُغلق
 * حين يأخذك الصفُّ إلى مجتمع** (D-054: مكوّنٌ واحد، وكلُّ بابٍ يقرّر ما
 * يحدث بعده).
 */
export function CommunityRow({
  c,
  t,
  locale,
  onNavigate,
}: {
  c: CommunityLite;
  t: Dict;
  locale: Locale;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(c.my_status ?? "none");
  const [pending, start] = useTransition();

  function join() {
    tap(10);
    start(async () => {
      try {
        const got = await joinCommunity(c.id);
        if (got === "joined") {
          setStatus("member");
          router.push(`/people?tab=all&c=${c.id}`);
        } else if (got === "requested") {
          setStatus("requested");
          toast(t.commRequestSent, { tone: "info" });
        }
      } catch (e) {
        flashError((e as Error).message);
      }
    });
  }

  return (
    <li className="flex items-center gap-3 py-3">
      <CommunityBadge name={c.name} photo={c.photo_url} kind={c.kind} />
      <Link
        href={`/people?tab=all&c=${c.id}`}
        onClick={onNavigate}
        className="min-w-0 flex-1"
      >
        <span className="flex items-center gap-1.5 text-sm font-semibold truncate">
          <span className="truncate">{c.name}</span>
          {c.is_private && <Icon name="eye-off" size={13} className="text-muted shrink-0" />}
        </span>
        <span className="block text-xs text-muted">
          {/* غرفةٌ وليدةٌ من المهمّة المجدولة عدّادُها صفر؛ و«٠ أعضاء»
              في صفٍّ بعد صفّ يقرؤها المستخدم «مهجورة» لا «جديدة» */}
          {c.kind === "title" && c.member_count === 0
            ? t.titleRoomBeFirst
            : t.commMembers(num(c.member_count, locale))}
        </span>
      </Link>
      {/* غرفةُ العمل تُقرأ بلا انضمام، فزرُّها «افتح» لا «انضم» حتى لغير
          العضو — زرٌّ يطلب التزاماً قبل أن يُري شيئاً يُقرأ رفضاً */}
      {c.kind === "title" && status !== "member" ? (
        <Link
          href={`/people?tab=all&c=${c.id}`}
          onClick={onNavigate}
          className={buttonClass({ variant: "surface", size: "sm", className: "shrink-0" })}
        >
          {t.commOpen}
        </Link>
      ) : status === "member" ? (
        <Link
          href={`/people?tab=all&c=${c.id}`}
          onClick={onNavigate}
          className={buttonClass({ variant: "surface", size: "sm", className: "shrink-0" })}
        >
          {t.commOpen}
        </Link>
      ) : status === "requested" ? (
        <span className="shrink-0 text-xs font-semibold text-muted">{t.commRequested}</span>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            onNavigate?.();
            join();
          }}
          className={buttonClass({ variant: "primary", size: "sm", className: "shrink-0" })}
        >
          {t.commJoin}
        </button>
      )}
    </li>
  );
}

/** صفُّ دعوةٍ في الدليل — قبولٌ يفتح الغرفة، ورفضٌ يحذف الدعوة (هجرة 42) */
function InviteRow({ c, t, locale }: { c: CommunityLite; t: Dict; locale: Locale }) {
  const router = useRouter();
  const [gone, setGone] = useState(false);
  const [pending, start] = useTransition();

  function decide(accept: boolean) {
    tap(accept ? 10 : 8);
    start(async () => {
      try {
        if (accept) {
          await acceptCommunityInvite(c.id);
          router.push(`/people?tab=all&c=${c.id}`);
          coalescedRefresh(router);
        } else {
          await rejectCommunityInvite(c.id);
          setGone(true);
        }
      } catch (e) {
        flashError((e as Error).message);
      }
    });
  }

  if (gone) return null;
  return (
    <li className="flex items-center gap-3 py-3">
      <CommunityBadge name={c.name} photo={c.photo_url} kind={c.kind} />
      <Link href={`/people?tab=all&c=${c.id}`} className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-semibold truncate">
          <span className="truncate">{c.name}</span>
          {c.is_private && <Icon name="eye-off" size={13} className="text-muted shrink-0" />}
        </span>
        <span className="block text-xs text-muted">
          {t.commMembers(num(c.member_count, locale))}
        </span>
      </Link>
      <button
        type="button"
        disabled={pending}
        onClick={() => decide(true)}
        className="shrink-0 px-3 h-8 rounded-full bg-accent text-[color:var(--on-accent)] text-12 font-bold hover:brightness-110 active:scale-95 transition disabled:opacity-50"
      >
        {t.requestAccept}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => decide(false)}
        className="shrink-0 px-3 h-8 rounded-full border border-border text-12 font-semibold text-muted hover:text-foreground transition disabled:opacity-50"
      >
        {t.requestReject}
      </button>
    </li>
  );
}

/**
 * قرص المجتمع: صورته إن رفعها المالك (هجرة 41)، وإلا حرفُ اسمه.
 *
 * وغرفةُ العمل **مستطيلٌ لا قرص** (هجرة 53): صورتها ملصقٌ بنسبة ٢:٣،
 * وقصُّه دائرةً يقطع رأسَ البطل ورِجليه. المستطيل المدوَّر هو شكلُ
 * الملصق في كل التطبيق — فالشكل هنا يقول «هذا عملٌ لا شخص» بلا كلمة.
 */
function CommunityBadge({
  name,
  photo,
  kind = "user",
}: {
  name: string;
  photo?: string | null;
  kind?: CommunityKind;
}) {
  if (kind === "title") {
    return (
      <span className="shrink-0 w-11 h-11 rounded-xl overflow-hidden bg-surface-2 border border-border grid place-items-center">
        {photo ? (
          <Image
            src={photo}
            alt=""
            width={44}
            height={44}
            sizes="44px"
            className="w-full h-full object-cover"
          />
        ) : (
          <Icon name="film" size={18} className="text-muted" />
        )}
      </span>
    );
  }
  if (photo) return <Avatar src={photo} name={name} size={44} className="shrink-0" alt="" />;
  return (
    <span className="shrink-0 grid place-items-center w-11 h-11 rounded-full bg-accent/15 text-accent font-extrabold text-lg">
      {name.trim().charAt(0)}
    </span>
  );
}

/* 🔴 **حُذفت `CreateCommunitySheet` بقرار أحمد** (D-306): «احنا حاذفين
   الكومينتي، فالمفروض ما أحد يقدر يأسس كومينتي جديد» — **سقط قارئاها
   (الورقةُ والدليل) فسقطت في يومها** (D-214/D-002). **وما أُسّس يبقى
   يُقرأ** (D-219). */


// ============================================================
//  غرفة المجتمع
// ============================================================

/**
 * الغرفة: ترويسةٌ (رجوع، الاسم، الأعضاء، أفعال الدور) ثم الدردشة.
 * غيرُ العضو يرى غلافَ «انضمّ» بدل الرسائل — سياسات SQL أصلاً لا تعطيه
 * الرسائل، فالواجهة تصدُق معها لا تتجمّل.
 */
export function CommunityRoom({
  room,
  locale,
}: {
  room: CommunityRoomData;
  locale: Locale;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [messages, setMessages] = useState(room.messages);
  const [reqs, setReqs] = useState(room.joinRequests);
  const [status, setStatus] = useState<"member" | "requested" | "none">(
    room.isMember ? "member" : room.requested ? "requested" : "none",
  );
  const [membersOpen, setMembersOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const idRef = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);

  /* شبهُ فورية (م٥): الاستطلاع للعضو وحده — غير العضو يرى غلافاً ثابتاً
     لا يستحق طلباً كل ست ثوانٍ. رسائل الخادم تحلّ محلّ الحالة (المتفائلةُ
     صارت حقيقيةً هناك)، وطلباتُ الانضمام كذلك فيراها المالك دون تحديث يدوي */
  useChatPoll(status === "member", ["community_messages"]);
  /* مزامنةٌ أثناء الرسم لا داخل effect (توصية React): نسخة الخادم الأحدث
     تستبدل الحالة في نفس الجولة — المتفائلةُ صارت حقيقيةً هناك */
  const [prevMsgs, setPrevMsgs] = useState(room.messages);
  if (room.messages !== prevMsgs) {
    setPrevMsgs(room.messages);
    setMessages(room.messages);
  }
  const [prevReqs, setPrevReqs] = useState(room.joinRequests);
  if (room.joinRequests !== prevReqs) {
    setPrevReqs(room.joinRequests);
    setReqs(room.joinRequests);
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const nameOf = (p: PersonLite | null) =>
    !p || p.hide_name ? t.anonymousUser : p.nickname || p.username || "—";

  /* غرفةُ العمل (هجرة 53): بابٌ إلى العمل، وقراءةٌ قبل الانضمام —
     السياسة في SQL تعطي غيرَ العضو الرسائل، فالواجهة تصدُق معها. */
  const titleHref =
    room.kind === "title" && room.tmdb_id
      ? `/${room.media_type === "movie" ? "movie" : "show"}/${room.tmdb_id}`
      : null;
  const canRead = status === "member" || room.kind === "title";

  function join() {
    tap(10);
    joinCommunity(room.id)
      .then((got) => {
        if (got === "joined") {
          setStatus("member");
          coalescedRefresh(router);
        } else if (got === "requested") {
          setStatus("requested");
          toast(t.commRequestSent, { tone: "info" });
        }
      })
      .catch((e) => flashError((e as Error).message));
  }

  function decide(p: PersonLite, accept: boolean) {
    tap(8);
    setReqs((prev) => prev.filter((x) => x.id !== p.id));
    (accept ? acceptCommunityRequest(room.id, p.id) : rejectCommunityRequest(room.id, p.id))
      .then(() => coalescedRefresh(router))
      .catch((e) => {
        flashError((e as Error).message);
        setReqs((prev) => [p, ...prev]);
      });
  }

  return (
    <div className="flex flex-col">
      {/* ===== الترويسة ===== */}
      <div className="flex items-center gap-2.5 pb-3 border-b border-[color:var(--divider)]">
        <Link
          href="/people?tab=all"
          aria-label={t.commBackAria}
          className="shrink-0 grid place-items-center w-9 h-9 rounded-full text-muted hover:text-foreground hover:bg-surface-2 transition"
        >
          <Icon name="chevron-down" size={18} className="rotate-90 rtl:-rotate-90" />
        </Link>
        {room.isOwner ? (
          <RoomPhotoButton room={room} t={t} />
        ) : titleHref ? (
          /* ملصقُ الغرفة بابٌ إلى العمل: من دخل الغرفة من الدليل يحتاج
             طريقاً إلى ما تتحدّث عنه، ولا يملك المتصفّح رجوعاً إليه */
          <Link href={titleHref} aria-label={t.titleRoomToTitle} className="shrink-0">
            <CommunityBadge name={room.name} photo={room.photo_url} kind="title" />
          </Link>
        ) : (
          <CommunityBadge name={room.name} photo={room.photo_url} />
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-sm font-bold truncate">
            {titleHref ? (
              <Link href={titleHref} className="truncate hover:text-accent transition">
                {room.name}
              </Link>
            ) : (
              <span className="truncate">{room.name}</span>
            )}
            {room.is_private && <Icon name="eye-off" size={13} className="text-muted shrink-0" />}
          </span>
          <button
            type="button"
            onClick={() => room.isMember && setMembersOpen(true)}
            className="block text-xs text-muted hover:text-foreground transition"
          >
            {t.commMembers(num(room.member_count, locale))}
          </button>
        </span>

        {room.isOwner && (
          /* «أضف أشخاصاً» (هجرة 42): بابُ الدعوة بجوار أفعال المالك —
             يدعو ممن يتابعهم، والطرف الآخر يقبل من قسم «دعوات» في الدليل */
          <button
            type="button"
            onClick={() => {
              tap(8);
              setInviteOpen(true);
            }}
            aria-label={t.commInviteBtn}
            title={t.commInviteBtn}
            className="shrink-0 grid place-items-center w-9 h-9 rounded-full text-muted hover:text-accent hover:bg-surface-2 transition"
          >
            <Icon name="people" size={16} />
          </button>
        )}
        {room.isOwner ? (
          <button
            type="button"
            onClick={() => {
              tap(8);
              if (!confirmDelete) {
                setConfirmDelete(true);
                toast(t.commDeleteConfirm, { tone: "info" });
                setTimeout(() => setConfirmDelete(false), 4000);
                return;
              }
              deleteCommunity(room.id)
                .then(() => router.push("/people?tab=all"))
                .catch((e) => flashError((e as Error).message));
            }}
            aria-label={t.commDelete}
            title={t.commDelete}
            className={`shrink-0 grid place-items-center w-9 h-9 rounded-full transition ${
              confirmDelete
                ? "text-[color:var(--error)] bg-[color:var(--error)]/10"
                : "text-muted hover:text-[color:var(--error)] hover:bg-surface-2"
            }`}
          >
            <Icon name="trash" size={16} />
          </button>
        ) : status === "member" ? (
          <button
            type="button"
            onClick={() => {
              tap(8);
              leaveCommunity(room.id)
                .then(() => router.push("/people?tab=all"))
                .catch((e) => flashError((e as Error).message));
            }}
            aria-label={t.commLeave}
            title={t.commLeave}
            className="shrink-0 grid place-items-center w-9 h-9 rounded-full text-muted hover:text-foreground hover:bg-surface-2 transition"
          >
            <Icon name="eye-off" size={16} />
          </button>
        ) : null}
      </div>

      {/* ===== طلبات الانضمام — للمالك، فوق الدردشة ===== */}
      {room.isOwner && reqs.length > 0 && (
        <section className="border-b border-[color:var(--divider)] py-2">
          <p className="text-12 font-semibold text-muted uppercase tracking-wide mb-1">
            {t.commJoinRequests}
          </p>
          {reqs.map((p) => {
            const name = nameOf(p);
            return (
              <div key={p.id} className="flex items-center gap-3 py-2">
                <Avatar src={p.hide_name ? null : p.avatar_url} name={name} size={34} alt={t.avatarAlt} />
                {/* 🆕 **والشاراتُ تُقرأ قبل القبول والرفض** (D-773ب): طالبُ
                    الانضمام يُحكم عليه بمن هو، **والاسمُ وحدَه يُقصّ**
                    فتبقى العلامةُ ظاهرةً مهما طال. */}
                <span className="min-w-0 flex-1 flex items-center" style={{ gap: 4 }}>
                  <span className="min-w-0 truncate text-sm font-semibold">{name}</span>
                  {p.hide_name ? null : <AccountBadges profile={p} t={t} />}
                </span>
                <button
                  type="button"
                  onClick={() => decide(p, true)}
                  className="shrink-0 px-3 h-8 rounded-full bg-accent text-[color:var(--on-accent)] text-12 font-bold hover:brightness-110 active:scale-95 transition"
                >
                  {t.requestAccept}
                </button>
                <button
                  type="button"
                  onClick={() => decide(p, false)}
                  className="shrink-0 px-3 h-8 rounded-full border border-border text-12 font-semibold text-muted hover:text-foreground transition"
                >
                  {t.requestReject}
                </button>
              </div>
            );
          })}
        </section>
      )}

      {/* ===== الدردشة أو غلاف الانضمام ===== */}
      {canRead ? (
        <>
          <div className="py-4 space-y-3">
            {messages.length === 0 ? (
              <p className="text-sm text-muted text-center py-8">{t.commNoMessages}</p>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col max-w-[80%] ${m.mine ? "ms-auto items-end" : "me-auto items-start"}`}
                >
                  {!m.mine && (
                    <span className="flex items-center min-w-0 text-12 text-muted mb-0.5 px-1" style={{ gap: 4 }}>
                      <span className="min-w-0 truncate">{nameOf(m.author)}</span>
                      {m.author && !m.author.hide_name ? (
                        <AccountBadges profile={m.author} t={t} />
                      ) : null}
                    </span>
                  )}
                  <span
                    className={`fs-content rounded-2xl px-3.5 py-2 text-14 leading-relaxed whitespace-pre-line break-words ${
                      m.mine
                        ? "bg-accent text-[color:var(--on-accent)]"
                        : "bg-surface-2 text-foreground"
                    }`}
                  >
                    <MessageBody body={m.body} label={t.commListLink} />
                  </span>
                </div>
              ))
            )}
            <div ref={endRef} />
          </div>
          {status !== "member" ? (
            /* قارئٌ لم ينضمّ: شريطٌ في مكان حقل الكتابة نفسه — الفراغُ
               مكانَ الحقل يقول «معطّل»، والشريطُ يقول «هذا ما ينقصك» */
            <div className="flex items-center gap-3 pt-3 border-t border-[color:var(--divider)]">
              <span className="min-w-0 flex-1 text-xs text-muted">{t.titleRoomReadOnly}</span>
              {status === "requested" ? (
                <span className="shrink-0 text-xs font-semibold text-muted">
                  {t.commRequested}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={join}
                  className={buttonClass({ variant: "primary", size: "sm", className: "shrink-0" })}
                >
                  {t.titleRoomJoinToWrite}
                </button>
              )}
            </div>
          ) : (
            <MessageBox
              t={t}
              onSend={(body) => {
                setMessages((prev) => [
                  ...prev,
                  {
                    id: `tmp-${idRef.current++}`,
                    author_id: "",
                    author: null,
                    mine: true,
                    body,
                    created_at: new Date().toISOString(),
                  },
                ]);
                postCommunityMessage(room.id, body).catch((e) =>
                  flashError((e as Error).message),
                );
              }}
            />
          )}
        </>
      ) : (
        <div className="py-14 text-center space-y-4">
          <p className="text-sm text-muted px-6">{t.commJoinToChat}</p>
          {status === "requested" ? (
            <button
              type="button"
              onClick={() => {
                tap(8);
                cancelCommunityRequest(room.id)
                  .then(() => setStatus("none"))
                  .catch((e) => flashError((e as Error).message));
              }}
              className={buttonClass({ variant: "surface" })}
            >
              {t.commRequested}
            </button>
          ) : (
            <button type="button" onClick={join} className={buttonClass({ variant: "primary" })}>
              {t.commJoin}
            </button>
          )}
        </div>
      )}

      {/* ===== ورقة الدعوة — للمالك (هجرة 42) ===== */}
      {inviteOpen && (
        <InviteSheet room={room} t={t} onClose={() => setInviteOpen(false)} />
      )}

      {/* ===== ورقة الأعضاء ===== */}
      {membersOpen && (
        <Sheet open variant="top" onClose={() => setMembersOpen(false)} closeLabel={t.closeLabel} labelledBy="comm-members-title">
          <SheetHeader
            id="comm-members-title"
            title={t.commMembers(num(room.member_count, locale))}
            closeLabel={t.closeLabel}
            onClose={() => setMembersOpen(false)}
          />
          <div className={`${sheetScroll} divide-y divide-[color:var(--divider)] pb-[env(safe-area-inset-bottom)]`}>
            {room.members.map((p) => {
              const name = nameOf(p);
              return (
                <Link
                  key={p.id}
                  href={`/u/${p.username ?? p.id}`}
                  prefetch={false}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2 transition"
                >
                  <Avatar src={p.hide_name ? null : p.avatar_url} name={name} size={40} alt={t.avatarAlt} />
                  <span className="min-w-0 flex-1 flex items-center" style={{ gap: 4 }}>
                    <span className="min-w-0 truncate text-sm font-semibold">{name}</span>
                    {p.hide_name ? null : <AccountBadges profile={p} t={t} />}
                  </span>
                  {p.id === room.owner_id && (
                    <span className="shrink-0 text-12 font-bold text-accent">{t.commOwnerBadge}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </Sheet>
      )}
    </div>
  );
}

/**
 * قرص الغرفة عند المالك: زرُّ رفع صورةٍ لا قرصاً صامتاً (طلب المالك).
 *
 * نفس مسار صورة الملف الشخصي حرفياً: مخزن `avatars` تحت مجلد المستخدم
 * (سياسة المخزن تشترطه)، ملفٌّ باسمٍ يحمل معرّف المجتمع، حدُّ ٢م.ب
 * والفحص الحقيقي في المخزن نفسه (storage_limits.sql)، وحذفُ السابق كي
 * لا يتراكم. الرابط يُثبت عبر `setCommunityPhoto` — والفعل يتحقق منه
 * بـ`safeImageUrl` قبل الكتابة.
 */
function RoomPhotoButton({ room, t }: { room: CommunityRoomData; t: Dict }) {
  const router = useRouter();
  const [photo, setPhoto] = useState(room.photo_url);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPick(picked: File) {
    if (!picked.type.startsWith("image/")) {
      flashError(t.errPickImage);
      return;
    }
    setBusy(true);
    try {
      /* 🆕 **تُصغَّر قبل أن تُقاس** (D-837) — الحجّةُ في `lib/imageFile.ts` */
      const file = await fitForUpload(picked);
      if (file.size > UPLOAD_MAX_BYTES) {
        flashError(t.errTooLarge);
        return;
      }
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error(t.errUpload);
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/community-${room.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw new Error(upErr.message);
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);

      await setCommunityPhoto(room.id, data.publicUrl);

      // احذف السابق — كل تغييرٍ كان سيترك نسخةً في المخزن للأبد
      const marker = "/storage/v1/object/public/avatars/";
      const at = photo?.indexOf(marker) ?? -1;
      if (photo && at >= 0) {
        const old = decodeURIComponent(photo.slice(at + marker.length).split("?")[0]);
        if (old.startsWith(`${user.id}/`) && old !== path) {
          await supabase.storage.from("avatars").remove([old]);
        }
      }

      setPhoto(data.publicUrl);
      coalescedRefresh(router);
    } catch (e) {
      flashError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => {
        tap(8);
        fileRef.current?.click();
      }}
      disabled={busy}
      aria-label={t.commPhotoChange}
      title={t.commPhotoChange}
      className={`relative shrink-0 transition ${busy ? "opacity-50" : "hover:opacity-85"}`}
    >
      <CommunityBadge name={room.name} photo={photo} />
      {/* شارة قلمٍ صغيرة: القرص القابل للتغيير يقول ذلك بنفسه */}
      <span
        className="absolute -bottom-0.5 -end-0.5 grid place-items-center w-[18px] h-[18px] rounded-full bg-surface-2 border border-border text-muted"
        aria-hidden
      >
        <Icon name="edit" size={10} strokeWidth={2.4} />
      </span>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onPick(f);
        }}
      />
    </button>
  );
}

/**
 * ورقة «أضف أشخاصاً» (هجرة 42): قائمة من أتابعهم مع حالة كلٍّ منهم.
 *
 * من أتابعهم لا كلَّ الناس (طلب المالك حرفياً)، والبيانات تُجلب عند
 * الفتح كنمط SendShareSheet — لا تُحمَّل مع الغرفة لمن لن يفتح الورقة.
 * ثلاث حالاتٍ لكل صف: عضوٌ (نصٌّ صامت — لا فعل له)، مدعوٌّ (ضغطةٌ تلغي
 * الدعوة)، وسواهما زرُّ «ادعُ». تفاؤليٌّ بالكامل مع تراجعٍ عند الفشل
 * (D-007).
 */
function InviteSheet({
  room,
  t,
  onClose,
}: {
  room: CommunityRoomData;
  t: Dict;
  onClose: () => void;
}) {
  const [people, setPeople] = useState<PersonLite[] | null>(null);
  const [invited, setInvited] = useState<Set<string>>(new Set(room.invitedIds));
  const memberIds = new Set(room.members.map((m) => m.id));

  useEffect(() => {
    let cancelled = false;
    myFollowingList()
      .then((p) => {
        if (!cancelled) setPeople(p);
      })
      .catch(() => {
        if (!cancelled) setPeople([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const nameOf = (p: PersonLite) =>
    p.hide_name ? t.anonymousUser : p.nickname || p.username || "—";

  function toggle(p: PersonLite) {
    const was = invited.has(p.id);
    tap(8);
    setInvited((prev) => {
      const next = new Set(prev);
      if (was) next.delete(p.id);
      else next.add(p.id);
      return next;
    });
    (was ? cancelCommunityInvite(room.id, p.id) : inviteToCommunity(room.id, p.id)).catch(
      (e) => {
        flashError((e as Error).message);
        setInvited((prev) => {
          const next = new Set(prev);
          if (was) next.add(p.id);
          else next.delete(p.id);
          return next;
        });
      },
    );
  }

  return (
    <Sheet open variant="top" onClose={onClose} closeLabel={t.closeLabel} labelledBy="comm-invite-title">
      <SheetHeader
        id="comm-invite-title"
        title={t.commInviteTitle}
        closeLabel={t.closeLabel}
        onClose={onClose}
      >
        <p className="text-xs text-muted mt-0.5">{t.commInviteHint}</p>
      </SheetHeader>
      <div className={`${sheetScroll} divide-y divide-[color:var(--divider)] pb-[env(safe-area-inset-bottom)] min-h-[6rem]`}>
        {people === null ? (
          <p className="text-sm text-muted text-center py-8">{t.peopleSearching}</p>
        ) : people.length === 0 ? (
          <p className="text-sm text-muted text-center py-8 px-5">{t.commInviteEmpty}</p>
        ) : (
          people.map((p) => {
            const name = nameOf(p);
            const isMember = memberIds.has(p.id);
            const isInvited = invited.has(p.id);
            return (
              <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                <Avatar src={p.hide_name ? null : p.avatar_url} name={name} size={40} alt={t.avatarAlt} />
                <span className="min-w-0 flex-1 flex items-center" style={{ gap: 4 }}>
                  <span className="min-w-0 truncate text-sm font-semibold">{name}</span>
                  {p.hide_name ? null : <AccountBadges profile={p} t={t} />}
                </span>
                {isMember ? (
                  <span className="shrink-0 text-12 font-bold text-muted">
                    {t.commAlreadyMember}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => toggle(p)}
                    className={
                      isInvited
                        ? "shrink-0 px-3 h-8 rounded-full border border-border text-12 font-semibold text-muted hover:text-foreground transition"
                        : "shrink-0 px-3 h-8 rounded-full bg-accent text-[color:var(--on-accent)] text-12 font-bold hover:brightness-110 active:scale-95 transition"
                    }
                  >
                    {isInvited ? t.commInvited : t.commInviteAction}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </Sheet>
  );
}

/** حقل الإرسال — نمط ReplyBox في الرسائل نفسه */
function MessageBox({ t, onSend }: { t: Dict; onSend: (body: string) => void }) {
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();

  function submit() {
    const body = value.trim();
    if (!body || pending) return;
    tap(8);
    setValue("");
    start(async () => onSend(body));
  }

  return (
    <div className="flex items-center gap-2 pt-3 border-t border-[color:var(--divider)]">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={t.commMsgPlaceholder}
        aria-label={t.commMsgPlaceholder}
        maxLength={2000}
        className="flex-1 min-w-0 rounded-full bg-surface-2 border border-border px-4 py-2 text-base outline-none focus:border-accent transition"
      />
      <button
        type="button"
        onClick={submit}
        disabled={!value.trim() || pending}
        className="shrink-0 px-4 h-9 rounded-full bg-accent text-[color:var(--on-accent)] text-12 font-bold disabled:opacity-40 hover:brightness-110 active:scale-95 transition"
      >
        {t.commMsgSend}
      </button>
    </div>
  );
}

/**
 * نصّ الفقاعة — روابط قوائم loopztv **وحدها** تصير روابط داخلية (D-066).
 *
 * لماذا هذا النمط بالذات لا «أي رابط»: تحويل كل URL إلى رابطٍ قابلٍ للنقر
 * في نصٍّ يكتبه الغرباء بابُ تصيّدٍ مفتوح. النمط هنا حرفيٌّ ومقيّد —
 * النطاق الرسمي، مسار `/lists/`، ومعرّف UUID — وكل ما سواه يبقى نصّاً
 * يعرضه React مُهرَّباً كعادته (لا innerHTML في أي حال).
 */
function MessageBody({ body, label }: { body: string; label: string }) {
  const re =
    /https:\/\/loopztv\.com\/lists\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(body))) {
    if (m.index > last) parts.push(body.slice(last, m.index));
    parts.push(
      <Link
        key={`lst-${i++}`}
        href={`/lists/${m[1].toLowerCase()}`}
        className="inline-flex items-center gap-1 underline font-semibold hover:opacity-80"
      >
        <Icon name="list" size={13} />
        {label}
      </Link>,
    );
    last = m.index + m[0].length;
  }
  if (parts.length === 0) return <>{body}</>;
  if (last < body.length) parts.push(body.slice(last));
  return <>{parts}</>;
}
