"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Avatar } from "./Avatar";
import { findPeople } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import type { PersonLite } from "@/lib/data";

/** بحث عن شخص بالاسم أو المعرّف — أول خطوة لإضافة أحد */
export function PeopleSearch({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PersonLite[] | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (term.length < 2) {
      setResults(null);
      return;
    }
    start(async () => {
      setResults(await findPeople(term));
    });
  }

  return (
    <section>
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t.peopleSearchPlaceholder}
          aria-label={t.peopleSearchPlaceholder}
          className="flex-1 rounded-xl bg-surface-2 border border-border px-4 py-3 text-sm outline-none focus:border-accent transition"
          dir="ltr"
        />
        <button
          type="submit"
          disabled={pending || q.trim().length < 2}
          className="px-5 rounded-xl bg-accent text-[color:var(--on-accent)] font-semibold text-sm hover:brightness-110 transition disabled:opacity-50"
        >
          {t.navSearch}
        </button>
      </form>

      <p className="text-xs text-muted mt-2">{t.peopleSearchHint}</p>

      {results !== null && (
        <div className="mt-4 space-y-2">
          {results.length === 0 ? (
            <p className="text-sm text-muted bg-surface border border-dashed border-border rounded-xl py-6 text-center">
              {t.peopleNoResults}
            </p>
          ) : (
            results.map((p) => (
              <Link
                key={p.id}
                href={`/u/${p.username}`}
                prefetch={false}
                className="flex items-center gap-3 bg-surface border border-border rounded-xl p-3 hover:border-accent/60 transition"
              >
                <Avatar
                  src={p.hide_name ? null : p.avatar_url}
                  name={p.hide_name ? t.anonymousUser : p.nickname || p.username}
                  size={38}
                  alt={t.avatarAlt}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold truncate">
                    {p.hide_name ? t.anonymousUser : p.nickname || p.username}
                  </span>
                  <span className="block text-xs text-muted truncate" dir="ltr">
                    @{p.username}
                  </span>
                </span>
                <span className="text-accent text-sm shrink-0">←</span>
              </Link>
            ))
          )}
        </div>
      )}
    </section>
  );
}
