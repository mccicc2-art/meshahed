"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inviteListMembers, peopleFollowsOf, removeListMember, respondListInvite } from "@/lib/actions";
import { getDict, type Locale } from "@/core/i18n";
import { displayNameOf, type PersonLite } from "@/core/people";
import { LIST_MEMBERS_MAX, type ListMember } from "@/core/contracts/library";
import { toast, flashError } from "@/lib/toast";
import { tap } from "@/lib/haptics";
import { Icon } from "./Icon";
import { Sheet, SheetHeader } from "./ui/Sheet";
import { buttonClass } from "./ui/Button";
import { chipClass } from "./ui/controls";

/**
 * ====== القوائمُ المشتركة على الويب — سطرُ الأعضاء والورقتان والدعوة (هجرة ٢٣٤ · أحمد ٤ نوفمبر، الشكلُ «أ») ======
 *
 * 🔑 **ما ترسمه شاشةُ التطبيق نفسُه** (`ListMembersSheet` · `ListInviteSheet`): الصورُ المكدّسةُ وأسماؤها في خانة
 * صاحب القائمة، و«+ ادعُ» في طرفها لصاحبها؛ الضغطُ على الصور يفتح «الأعضاء · N من ١٠» (إزالةٌ · إلغاءٌ · مغادرة)؛
 * و«ادعُ» تفتح من تتابعهم (١أ). **والورقتان `Sheet` الواحدة** — والحرّاسُ في القاعدة، لا هنا.
 */
const avatarStack = (m: ListMember, i: number) => (
  <span
    key={m.id}
    className="relative w-6 h-6 rounded-full overflow-hidden bg-surface-2 border-2 border-[color:var(--background)] shrink-0"
    style={{ marginInlineStart: i ? -8 : 0 }}
  >
    {m.avatar ? <Image src={m.avatar} alt="" fill sizes="24px" className="object-cover" /> : null}
  </span>
);

export function ListMembersRow({
  listId,
  name,
  members,
  canInvite,
  isOwner,
  meId,
  locale,
}: {
  listId: string;
  name: string;
  members: ListMember[];
  canInvite: boolean;
  isOwner: boolean;
  meId: string | null;
  locale: Locale;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [sheet, setSheet] = useState<null | "members" | "invite">(null);
  const [pending, start] = useTransition();
  const shown = members.filter((m) => m.role !== "pending");
  const amMember = !isOwner && !!meId && members.some((m) => m.id === meId && m.role === "member");

  const remove = (userId: string) =>
    start(async () => {
      try {
        await removeListMember(listId, userId);
        if (userId === meId) {
          toast(t.listLeft, { tone: "info" });
          router.push("/lists");
        } else {
          router.refresh();
        }
      } catch (e) {
        flashError((e as Error).message);
      }
    });

  return (
    <>
      <div className="flex items-center gap-2 mt-3.5 min-h-6">
        {shown.length > 1 && (
          <button
            type="button"
            onClick={() => setSheet("members")}
            aria-haspopup="dialog"
            aria-label={t.listMembersTitle(shown.length, LIST_MEMBERS_MAX)}
            className="flex items-center gap-2 min-w-0 text-start"
          >
            <span className="flex">{shown.slice(0, 3).map(avatarStack)}</span>
            <span className="text-12 text-muted truncate">
              {t.listMembersNames(shown.slice(0, 3).map((m) => m.name), shown.length - 3)}
            </span>
          </button>
        )}
        {canInvite && (
          <button
            type="button"
            onClick={() => {
              tap(8);
              setSheet(members.length > 1 ? "members" : "invite");
            }}
            aria-haspopup="dialog"
            className={chipClass(false, "sm", "ms-auto shrink-0 inline-flex items-center gap-1")}
          >
            <Icon name="plus" size={13} className="text-accent" />
            {t.listInvite}
          </button>
        )}
      </div>

      {sheet === "members" && (
        <Sheet open onClose={() => setSheet(null)} closeLabel={t.closeLabel} labelledBy="list-members-title">
          <SheetHeader id="list-members-title" title={t.listMembersTitle(members.length, LIST_MEMBERS_MAX)} closeLabel={t.closeLabel} onClose={() => setSheet(null)} />
          <ul className="px-5 py-2">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2.5 border-t first:border-t-0 border-[color:var(--divider)]">
                <span className="relative w-9 h-9 rounded-full overflow-hidden bg-surface-2 shrink-0">
                  {m.avatar ? <Image src={m.avatar} alt="" fill sizes="36px" className="object-cover" /> : null}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-14 font-semibold truncate">{m.name}</span>
                  <span className="block text-12 text-muted truncate">
                    {m.role === "owner" ? t.listMemberOwner : m.role === "pending" ? t.listMemberPending : t.listMemberActive}
                  </span>
                </span>
                {isOwner && m.role !== "owner" && (
                  <button type="button" disabled={pending} onClick={() => remove(m.id)} className="text-13 text-muted hover:text-foreground disabled:opacity-50">
                    {m.role === "pending" ? t.listMemberCancel : t.listMemberRemove}
                  </button>
                )}
              </li>
            ))}
          </ul>
          <div className="px-5 pb-5 flex flex-col gap-2">
            {isOwner && canInvite && (
              <button type="button" onClick={() => setSheet("invite")} className={buttonClass({ variant: "ghost", full: true })}>
                {t.listInviteFromFollowing}
              </button>
            )}
            {amMember && meId && (
              <button type="button" disabled={pending} onClick={() => remove(meId)} className={buttonClass({ variant: "ghost", full: true })}>
                {t.listMemberLeave}
              </button>
            )}
          </div>
        </Sheet>
      )}

      {sheet === "invite" && meId && (
        <InviteSheet
          listId={listId}
          name={name}
          members={members}
          meId={meId}
          locale={locale}
          onClose={() => setSheet(null)}
          onDone={() => {
            setSheet(null);
            toast(t.listInviteSent);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function InviteSheet({
  listId,
  name,
  members,
  meId,
  locale,
  onClose,
  onDone,
}: {
  listId: string;
  name: string;
  members: ListMember[];
  meId: string;
  locale: Locale;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = getDict(locale);
  const [people, setPeople] = useState<PersonLite[] | null>(null);
  const [sending, startSend] = useTransition();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  // A-43 (المدقّق ٥ نوفمبر) — الجلبُ في أثرٍ لا أثناءَ الرسم: رسمٌ يُعاد أو يُهمَل (الوضع المتزامن/الصارم) كان يطلقه مرّتين.
  // و`alive` يُسقط ردّاً وصل بعد إغلاق النافذة أو تبدّل الحساب.
  useEffect(() => {
    let alive = true;
    peopleFollowsOf(meId, "following")
      .then((p) => alive && setPeople(p))
      .catch(() => alive && setPeople([]));
    return () => {
      alive = false;
    };
  }, [meId]);
  const inList = useMemo(() => new Set(members.map((m) => m.id)), [members]);
  const taken = Math.max(1, members.length);
  const room = Math.max(0, LIST_MEMBERS_MAX - taken);
  const list = useMemo(() => {
    const all = (people ?? []).filter((p) => !inList.has(p.id));
    const k = query.trim().toLowerCase();
    return k ? all.filter((p) => `${p.nickname ?? ""} ${p.username ?? ""}`.toLowerCase().includes(k)) : all;
  }, [people, inList, query]);

  const send = () =>
    startSend(async () => {
      try {
        const r = await inviteListMembers(listId, picked);
        if (!r.ok) {
          flashError(r.reason === "full" ? t.apiListMembersFull : t.apiListNotShareable);
          return;
        }
        onDone();
      } catch (e) {
        flashError((e as Error).message);
      }
    });

  return (
    <Sheet open onClose={onClose} closeLabel={t.closeLabel} labelledBy="list-invite-title">
      <SheetHeader id="list-invite-title" title={t.listInviteTitle(name)} closeLabel={t.closeLabel} onClose={onClose} />
      <div className="px-5 pt-3 pb-5 flex flex-col gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.listInviteSearch}
          aria-label={t.listInviteSearch}
          className="h-11 rounded-xl border border-border bg-[color:var(--background)] px-3.5 text-15 outline-none focus:border-accent/60"
        />
        {people === null ? (
          <p className="text-13 text-muted text-center py-6">{t.shareLoadingPeople}</p>
        ) : list.length === 0 ? (
          <p className="text-13 text-muted text-center py-6">{t.listInviteNoFollowing}</p>
        ) : (
          <ul className="max-h-80 overflow-y-auto">
            {list.map((p) => {
              const on = picked.includes(p.id);
              const full = !on && picked.length >= room;
              return (
                <li key={p.id} className="border-t first:border-t-0 border-[color:var(--divider)]">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    disabled={full}
                    onClick={() => setPicked((cur) => (on ? cur.filter((x) => x !== p.id) : [...cur, p.id]))}
                    className="w-full flex items-center gap-3 py-2.5 text-start disabled:opacity-40"
                  >
                    <span className="relative w-9 h-9 rounded-full overflow-hidden bg-surface-2 shrink-0">
                      {p.avatar_url && !p.hide_name ? <Image src={p.avatar_url} alt="" fill sizes="36px" className="object-cover" /> : null}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-14 font-semibold truncate">{displayNameOf(p, t.anonymousUser)}</span>
                      {p.username && !p.hide_name && <span className="block text-12 text-muted truncate">@{p.username}</span>}
                    </span>
                    <span
                      aria-hidden
                      className={`w-[22px] h-[22px] rounded-full border-[1.5px] grid place-items-center ${on ? "bg-accent border-accent" : "border-border"}`}
                    >
                      {on && <Icon name="check" size={12} className="text-[color:var(--on-accent)]" />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <button type="button" disabled={!picked.length || sending} onClick={send} className={buttonClass({ variant: "primary", full: true })}>
          {t.listInviteSend(picked.length)}
        </button>
        <p className="text-12 text-muted text-center">{t.listInviteNote(taken + picked.length, LIST_MEMBERS_MAX)}</p>
      </div>
    </Sheet>
  );
}

/** 🆕 234 — **الدعوةُ فوق القائمة** (٢أ): من دعاك وما تقدر عليه، ثمّ «قبول · لا شكراً» */
export function ListInviteBanner({ listId, owner, locale }: { listId: string; owner: { name: string; avatar: string | null }; locale: Locale }) {
  const t = getDict(locale);
  const router = useRouter();
  const [pending, start] = useTransition();
  const answer = (accept: boolean) =>
    start(async () => {
      try {
        await respondListInvite(listId, accept);
        if (accept) {
          toast(t.listJoined);
          router.refresh();
        } else {
          router.push("/lists");
        }
      } catch (e) {
        flashError((e as Error).message);
      }
    });
  return (
    <div className="mb-4 flex flex-col gap-2">
      <div className="flex items-center gap-2.5 rounded-xl border border-border bg-[color:var(--background)] p-3">
        <span className="relative w-8 h-8 rounded-full overflow-hidden bg-surface-2 shrink-0">
          {owner.avatar ? <Image src={owner.avatar} alt="" fill sizes="32px" className="object-cover" /> : null}
        </span>
        <span className="min-w-0">
          <span className="block text-14 font-bold">{t.listInviteBanner(owner.name)}</span>
          <span className="block text-12 text-muted">{t.listInviteBannerSub}</span>
        </span>
      </div>
      <div className="flex gap-2.5">
        <button type="button" disabled={pending} onClick={() => answer(true)} className={buttonClass({ variant: "primary", className: "flex-1" })}>
          {t.listInviteAccept}
        </button>
        <button type="button" disabled={pending} onClick={() => answer(false)} className={buttonClass({ variant: "ghost", className: "flex-1" })}>
          {t.listInviteDecline}
        </button>
      </div>
    </div>
  );
}
