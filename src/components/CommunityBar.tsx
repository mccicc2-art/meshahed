"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { findPeople } from "@/lib/actions";
import { getDict, num, type Locale } from "@/lib/i18n";
import type { PersonLite } from "@/lib/data";

/**
 * شريط المجتمع — سطرٌ واحد بدل ثلاثة أقسام.
 *
 * كانت الصفحة تفتتح بنموذج بحثٍ عريض ثم قسمَي «أتابعهم» و«يتابعونني»،
 * فيهبط خطّ الآراء — وهو جوهر الصفحة — تحت الطيّة. الآن كبسولتان
 * بعدّادين وزرُّ إضافة، والقوائم والبحث في نوافذ منبثقة تُفتح عند الطلب.
 *
 * البحث فوريّ: حرفان فأكثر يطلقان البحث تلقائياً بمهلة ٣٠٠ مللي ثانية —
 * لا زرّ ولا إرسال.
 */
export function CommunityBar({
  following,
  followers,
  locale,
}: {
  following: PersonLite[];
  followers: PersonLite[];
  locale: Locale;
}) {
  const t = getDict(locale);
  const [open, setOpen] = useState<"add" | "following" | "followers" | null>(null);

  // إغلاق بمفتاح الهروب
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const pill =
    "flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2.5 hover:bg-surface-2 active:scale-[0.97] transition";

  return (
    <>
      {/* ===== السطر الواحد ===== */}
      <div className="flex items-center gap-2.5">
        <button type="button" onClick={() => setOpen("following")} className={pill}>
          <Icon name="person-check" size={19} className="text-accent shrink-0" />
          <span className="text-[15px] font-bold tabular-nums" dir="ltr">
            {num(following.length, locale)}
          </span>
          <span className="text-xs text-muted">{t.peopleFollowingTitle}</span>
        </button>

        <button type="button" onClick={() => setOpen("followers")} className={pill}>
          <Icon name="people" size={19} className="text-accent-2 shrink-0" />
          <span className="text-[15px] font-bold tabular-nums" dir="ltr">
            {num(followers.length, locale)}
          </span>
          <span className="text-xs text-muted">{t.peopleFollowersTitle}</span>
        </button>

        <button
          type="button"
          onClick={() => setOpen("add")}
          aria-label={t.peopleAdd}
          title={t.peopleAdd}
          className="ms-auto grid place-items-center w-11 h-11 rounded-full bg-accent text-[color:var(--on-accent)] shadow-lg shadow-accent/25 hover:brightness-110 active:scale-95 transition"
        >
          <Icon name="plus" size={20} strokeWidth={2.4} />
        </button>
      </div>

      {/* ===== النوافذ المنبثقة ===== */}
      {open === "add" && <SearchSheet t={t} onClose={() => setOpen(null)} />}
      {open === "following" && (
        <PeopleSheet
          t={t}
          title={t.peopleFollowingTitle}
          people={following}
          empty={t.peopleNoFollowing}
          onClose={() => setOpen(null)}
        />
      )}
      {open === "followers" && (
        <PeopleSheet
          t={t}
          title={t.peopleFollowersTitle}
          people={followers}
          empty={t.peopleNoResults}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}

type Dict = ReturnType<typeof getDict>;

/** غلاف النافذة: خلفية معتمة تُغلق باللمس، ولوح سفلي على الجوال */
function Sheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <button
        type="button"
        aria-label=""
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div className="relative w-full sm:max-w-md max-h-[78vh] flex flex-col rounded-t-3xl sm:rounded-3xl border border-border bg-[color:var(--surface)] shadow-2xl overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function SheetHeader({ title, t, onClose }: { title: string; t: Dict; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-[color:var(--divider)]">
      <h3 className="text-base font-bold">{title}</h3>
      <button
        type="button"
        onClick={onClose}
        aria-label={t.closeLabel}
        className="grid place-items-center w-9 h-9 rounded-full text-muted hover:text-foreground hover:bg-surface-2 transition"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
  );
}

function PersonRowLink({ p, t }: { p: PersonLite; t: Dict }) {
  const name = p.hide_name ? t.anonymousUser : p.nickname || p.username || "—";
  return (
    <Link
      href={p.username ? `/u/${p.username}` : "/people"}
      prefetch={false}
      className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2 transition"
    >
      <Avatar src={p.hide_name ? null : p.avatar_url} name={name} size={40} alt={t.avatarAlt} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold truncate">{name}</span>
        {p.username && (
          <span className="block text-xs text-muted truncate" dir="ltr">
            @{p.username}
          </span>
        )}
      </span>
      <Icon name="people" size={16} className="text-muted shrink-0 opacity-0" />
    </Link>
  );
}

/** قائمة أشخاص — للمتابَعين أو المتابِعين */
function PeopleSheet({
  t,
  title,
  people,
  empty,
  onClose,
}: {
  t: Dict;
  title: string;
  people: PersonLite[];
  empty: string;
  onClose: () => void;
}) {
  return (
    <Sheet onClose={onClose}>
      <SheetHeader title={title} t={t} onClose={onClose} />
      <div className="overflow-y-auto overscroll-contain divide-y divide-[color:var(--divider)] pb-[env(safe-area-inset-bottom)]">
        {people.length === 0 ? (
          <p className="text-sm text-muted text-center py-10 px-5">{empty}</p>
        ) : (
          people.map((p) => <PersonRowLink key={p.id} p={p} t={t} />)
        )}
      </div>
    </Sheet>
  );
}

/** بحثٌ فوريّ عن الأشخاص — يُطلق نفسه بعد حرفين بلا زرّ */
function SearchSheet({ t, onClose }: { t: Dict; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PersonLite[] | null>(null);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
          setResults(await findPeople(term));
        } catch {
          setResults([]);
        }
      });
    }, 300);
  }

  return (
    <Sheet onClose={onClose}>
      <SheetHeader title={t.peopleAdd} t={t} onClose={onClose} />

      <div className="px-5 pt-4 pb-3">
        <div className="relative">
          <span className="absolute inset-y-0 start-3.5 grid place-items-center text-muted pointer-events-none">
            <Icon name="search" size={17} />
          </span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t.peopleSearchPlaceholder}
            aria-label={t.peopleSearchPlaceholder}
            className="w-full rounded-xl bg-surface-2 border border-border ps-10 pe-4 py-3 text-sm outline-none focus:border-accent transition"
            dir="ltr"
            autoComplete="off"
          />
        </div>
        {results === null && !pending && (
          <p className="text-xs text-muted mt-2">{t.peopleSearchHint}</p>
        )}
      </div>

      <div className="overflow-y-auto overscroll-contain divide-y divide-[color:var(--divider)] pb-[env(safe-area-inset-bottom)] min-h-[8rem]">
        {pending ? (
          <p className="text-sm text-muted text-center py-8">{t.peopleSearching}</p>
        ) : results !== null && results.length === 0 ? (
          <p className="text-sm text-muted text-center py-8 px-5">{t.peopleNoResults}</p>
        ) : (
          (results ?? []).map((p) => <PersonRowLink key={p.id} p={p} t={t} />)
        )}
      </div>
    </Sheet>
  );
}
