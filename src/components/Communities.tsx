"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { Sheet, SheetHeader } from "./ui/Sheet";
import { buttonClass } from "./ui/Button";
import { getDict, num, type Locale } from "@/lib/i18n";
import { tap } from "@/lib/haptics";
import { toast, flashError } from "@/lib/toast";
import { coalescedRefresh } from "@/lib/refresh";
import {
  createCommunity,
  joinCommunity,
  leaveCommunity,
  cancelCommunityRequest,
  acceptCommunityRequest,
  rejectCommunityRequest,
  deleteCommunity,
  postCommunityMessage,
  searchCommunities,
} from "@/lib/actions";
import type { CommunityLite, CommunityRoomData, PersonLite } from "@/lib/data";

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
  locale,
}: {
  mine: CommunityLite[];
  locale: Locale;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [create, setCreate] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<CommunityLite[] | null>(null);
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onChange(v: string) {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    const term = v.trim();
    if (term.length < 2) {
      setResults(null);
      return;
    }
    timer.current = setTimeout(() => {
      start(async () => {
        try {
          setResults(await searchCommunities(term));
        } catch {
          setResults([]);
        }
      });
    }, 300);
  }

  return (
    <div className="space-y-5">
      {/* ===== أنشئ + ابحث — ما طلبه المالك مكان الصفّ القديم ===== */}
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute inset-y-0 start-3 grid place-items-center text-muted">
            <Icon name="search" size={16} />
          </span>
          <input
            value={q}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t.commSearchPlaceholder}
            aria-label={t.commSearchPlaceholder}
            className="w-full rounded-full bg-surface-2 border border-border ps-9 pe-4 py-2 text-base outline-none focus:border-accent transition"
            autoComplete="off"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            tap(8);
            setCreate(true);
          }}
          className={buttonClass({ variant: "primary", size: "sm", className: "shrink-0" })}
        >
          + {t.commCreate}
        </button>
      </div>

      {/* ===== نتائج البحث — تتصدّر متى كُتب حرفان ===== */}
      {q.trim().length >= 2 && (
        <section>
          {pending && results === null ? (
            <p className="text-sm text-muted text-center py-6">{t.peopleSearching}</p>
          ) : (results ?? []).length === 0 ? (
            <p className="text-sm text-muted text-center py-6">{t.commNoResults}</p>
          ) : (
            <ul className="divide-y divide-[color:var(--divider)]">
              {(results ?? []).map((c) => (
                <CommunityRow key={c.id} c={c} t={t} locale={locale} />
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ===== مجتمعاتي ===== */}
      {q.trim().length < 2 && (
        <section>
          <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5">
            {t.commMineSection}
          </p>
          {mine.length === 0 ? (
            <p className="text-sm text-muted bg-surface border border-dashed border-border rounded-xl py-8 px-5 text-center">
              {t.commEmptyDir}
            </p>
          ) : (
            <ul className="divide-y divide-[color:var(--divider)]">
              {mine.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/people?tab=all&c=${c.id}`}
                    className="flex items-center gap-3 py-3 hover:bg-surface-2 -mx-2 px-2 rounded-xl transition"
                  >
                    <CommunityBadge name={c.name} />
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
      )}

      {create && (
        <CreateCommunitySheet
          t={t}
          onClose={() => setCreate(false)}
          onCreated={(id) => {
            setCreate(false);
            router.push(`/people?tab=all&c=${id}`);
            coalescedRefresh(router);
          }}
        />
      )}
    </div>
  );
}

/** صفُّ مجتمعٍ في نتائج البحث — زرّه بحسب علاقتي به */
function CommunityRow({ c, t, locale }: { c: CommunityLite; t: Dict; locale: Locale }) {
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
      <CommunityBadge name={c.name} />
      <Link href={`/people?tab=all&c=${c.id}`} className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-semibold truncate">
          <span className="truncate">{c.name}</span>
          {c.is_private && <Icon name="eye-off" size={13} className="text-muted shrink-0" />}
        </span>
        <span className="block text-xs text-muted">
          {t.commMembers(num(c.member_count, locale))}
        </span>
      </Link>
      {status === "member" ? (
        <Link
          href={`/people?tab=all&c=${c.id}`}
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
          onClick={join}
          className={buttonClass({ variant: "primary", size: "sm", className: "shrink-0" })}
        >
          {t.commJoin}
        </button>
      )}
    </li>
  );
}

/** قرصُ حرفٍ باسم المجتمع — كالصورة الرمزية، بلا صورةٍ تُدار */
function CommunityBadge({ name }: { name: string }) {
  return (
    <span className="shrink-0 grid place-items-center w-11 h-11 rounded-full bg-accent/15 text-accent font-extrabold text-lg">
      {name.trim().charAt(0)}
    </span>
  );
}

/** ورقة الإنشاء — اسمٌ وخصوصيةٌ وزرّ؛ علويةٌ لأن فيها كتابة (D-018) */
function CreateCommunitySheet({
  t,
  onClose,
  onCreated,
}: {
  t: Dict;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(id);
  }, []);

  function submit() {
    const clean = name.trim();
    if (clean.length < 2 || pending) return;
    tap([12, 30]);
    start(async () => {
      try {
        const id = await createCommunity({ name: clean, isPrivate });
        onCreated(id);
      } catch (e) {
        flashError((e as Error).message);
      }
    });
  }

  return (
    <Sheet open variant="top" onClose={onClose} closeLabel={t.closeLabel} labelledBy="comm-create-title">
      <SheetHeader id="comm-create-title" title={t.commCreateTitle} closeLabel={t.closeLabel} onClose={onClose}>
        <p className="text-xs text-muted mt-0.5">{t.commCreateHint}</p>
      </SheetHeader>
      <div className="p-5 space-y-4">
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.commNamePlaceholder}
          aria-label={t.commNamePlaceholder}
          maxLength={50}
          className="w-full rounded-xl bg-surface-2 border border-border px-4 py-3 text-base outline-none focus:border-accent transition"
        />
        {/* الخصوصية رقاقتان لا مفتاح: خياران متنافيان معروفان (D-016) */}
        <div role="group" aria-label={t.commCreateTitle} className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={!isPrivate}
            onClick={() => {
              tap(6);
              setIsPrivate(false);
            }}
            className={chip(!isPrivate)}
          >
            {t.commPublic}
          </button>
          <button
            type="button"
            aria-pressed={isPrivate}
            onClick={() => {
              tap(6);
              setIsPrivate(true);
            }}
            className={chip(isPrivate)}
          >
            {t.commPrivate}
          </button>
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={name.trim().length < 2 || pending}
          className="w-full h-12 rounded-full bg-accent text-[color:var(--on-accent)] font-bold text-[15px] disabled:opacity-40 hover:brightness-110 active:scale-[0.98] transition"
        >
          {t.commCreateButton}
        </button>
      </div>
    </Sheet>
  );
}

function chip(on: boolean) {
  return `px-3.5 py-2 text-sm rounded-full border font-semibold whitespace-nowrap transition ${
    on
      ? "bg-accent text-[color:var(--on-accent)] border-accent"
      : "bg-surface text-muted border-border hover:text-foreground hover:border-accent/50"
  }`;
}

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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const idRef = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const nameOf = (p: PersonLite | null) =>
    !p || p.hide_name ? t.anonymousUser : p.nickname || p.username || "—";

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
        <CommunityBadge name={room.name} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-sm font-bold truncate">
            <span className="truncate">{room.name}</span>
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
          <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-1">
            {t.commJoinRequests}
          </p>
          {reqs.map((p) => {
            const name = nameOf(p);
            return (
              <div key={p.id} className="flex items-center gap-3 py-2">
                <Avatar src={p.hide_name ? null : p.avatar_url} name={name} size={34} alt={t.avatarAlt} />
                <span className="min-w-0 flex-1 text-sm font-semibold truncate">{name}</span>
                <button
                  type="button"
                  onClick={() => decide(p, true)}
                  className="shrink-0 px-3 h-8 rounded-full bg-accent text-[color:var(--on-accent)] text-[12px] font-bold hover:brightness-110 active:scale-95 transition"
                >
                  {t.requestAccept}
                </button>
                <button
                  type="button"
                  onClick={() => decide(p, false)}
                  className="shrink-0 px-3 h-8 rounded-full border border-border text-[12px] font-semibold text-muted hover:text-foreground transition"
                >
                  {t.requestReject}
                </button>
              </div>
            );
          })}
        </section>
      )}

      {/* ===== الدردشة أو غلاف الانضمام ===== */}
      {status === "member" ? (
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
                    <span className="text-[11px] text-muted mb-0.5 px-1">{nameOf(m.author)}</span>
                  )}
                  <span
                    className={`rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed whitespace-pre-line break-words ${
                      m.mine
                        ? "bg-accent text-[color:var(--on-accent)]"
                        : "bg-surface-2 text-foreground"
                    }`}
                  >
                    {m.body}
                  </span>
                </div>
              ))
            )}
            <div ref={endRef} />
          </div>
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

      {/* ===== ورقة الأعضاء ===== */}
      {membersOpen && (
        <Sheet open variant="top" onClose={() => setMembersOpen(false)} closeLabel={t.closeLabel} labelledBy="comm-members-title">
          <SheetHeader
            id="comm-members-title"
            title={t.commMembers(num(room.member_count, locale))}
            closeLabel={t.closeLabel}
            onClose={() => setMembersOpen(false)}
          />
          <div className="overflow-y-auto overscroll-contain divide-y divide-[color:var(--divider)] pb-[env(safe-area-inset-bottom)]">
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
                  <span className="min-w-0 flex-1 text-sm font-semibold truncate">{name}</span>
                  {p.id === room.owner_id && (
                    <span className="shrink-0 text-[11px] font-bold text-accent">{t.commOwnerBadge}</span>
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
        className="shrink-0 px-4 h-9 rounded-full bg-accent text-[color:var(--on-accent)] text-[13px] font-bold disabled:opacity-40 hover:brightness-110 active:scale-95 transition"
      >
        {t.commMsgSend}
      </button>
    </div>
  );
}
