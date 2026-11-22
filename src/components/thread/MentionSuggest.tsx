"use client";

import { useEffect, useMemo, useState } from "react";
import { Avatar } from "../Avatar";
import { createClient } from "@/lib/supabase/client";
import { peopleFollowsOf } from "@/lib/actions";
import { displayNameOf, type PersonLite } from "@/core/people";
import type { SearchPayload } from "@/core/contracts/search";

/**
 * ====== 🆕 T504 — اقتراحُ المنشن في صندوق الكتابة (الويب) ======
 *
 * أحمد ٢٢ نوفمبر بمقطع: «ليش يظهر لي منشن عمر فقط · ليه مقدر امنشن شخص ثاني وحنا ف المجتمع؟»، ثمّ «١٢ أ ١٣ أ نفذ».
 * نسخةُ `useMentions` في التطبيق (`apps/mobile/src/messages/mentions.tsx`) بقاعدتها نفسِها: الكلمةُ الأخيرةُ تبدأ بـ`@` ⇒ حتى
 * خمسةٍ — المشاركون في الصفحة أوّلاً، ثمّ من أتابعهم، ثمّ بعد حرفين أيُّ عضوٍ ببحث «أعضاء» نفسِه (`/api/search?type=members`،
 * debounce ٣٠٠ كالبحث). مخفيُّ الاسم وأنا لا نُعرض. اللمسةُ تكمل `@اسم` ومسافةً بعده.
 */
const TAIL = /(^|\s)@([A-Za-z0-9_]*)$/;

export function useMentionSuggest(body: string, setBody: (v: string) => void, participants: PersonLite[], enabled: boolean) {
  const [me, setMe] = useState<string | null>(null);
  const [follows, setFollows] = useState<PersonLite[]>([]);
  /* من أتابعهم — مرّةً حين يُفتح الصندوق (الفعلُ نفسُه الذي يملأ ورقة «يتابع» في الملفّ) */
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void createClient()
      .then((sb) => sb.auth.getSession())
      .then(({ data }) => {
        const id = data.session?.user.id ?? null;
        if (!live || !id) return;
        setMe(id);
        return peopleFollowsOf(id, "following").then((p) => {
          if (live) setFollows(p);
        });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [enabled]);

  const usable = useMemo(() => {
    const seen = new Map<string, PersonLite>();
    for (const p of [...participants, ...follows]) if (p.username && !p.hide_name && p.id !== me && !seen.has(p.id)) seen.set(p.id, p);
    return [...seen.values()];
  }, [participants, follows, me]);

  const q = enabled ? TAIL.exec(body)?.[2] ?? null : null;
  const want = q !== null && q.length >= 2 ? q.toLowerCase() : null;
  const [remote, setRemote] = useState<{ q: string; people: PersonLite[] } | null>(null);
  useEffect(() => {
    if (!want) return;
    let live = true;
    const timer = setTimeout(() => {
      fetch(`/api/search?type=members&q=${encodeURIComponent(want)}`)
        .then((r) => (r.ok ? (r.json() as Promise<SearchPayload>) : null))
        .then((r) => {
          if (live && r) setRemote({ q: want, people: r.members ?? [] });
        })
        .catch(() => {});
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [want]);

  const hits = useMemo(() => {
    if (q === null) return [];
    const k = q.toLowerCase();
    const local = usable.filter((p) => (p.username ?? "").toLowerCase().startsWith(k) || displayNameOf(p, "").toLowerCase().includes(k));
    const far = remote && want && remote.q === want ? remote.people.filter((p) => p.username && !p.hide_name && p.id !== me) : [];
    const out: PersonLite[] = [];
    const ids = new Set<string>();
    for (const p of [...local, ...far]) {
      if (ids.has(p.id)) continue;
      ids.add(p.id);
      out.push(p);
      if (out.length >= 5) break;
    }
    return out;
  }, [q, usable, remote, want, me]);

  const pick = (username: string) => setBody(body.replace(TAIL, (_m, pre: string) => `${pre}@${username} `));
  return { hits, pick };
}

/** القائمةُ تحت الحقل — صفٌّ بوجهٍ واسمٍ ومعرّف، والضغطُ لا يسرق التركيز من الحقل (`onMouseDown` يمنعه) */
export function MentionList({ hits, onPick, anonymous }: { hits: PersonLite[]; onPick: (username: string) => void; anonymous: string }) {
  if (!hits.length) return null;
  return (
    <ul role="listbox" className="mt-1 overflow-hidden rounded-xl border border-border bg-surface">
      {hits.map((p) => (
        <li key={p.id}>
          <button
            type="button"
            role="option"
            aria-selected={false}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(p.username ?? "")}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-start hover:bg-surface-2 transition"
          >
            <Avatar src={p.avatar_url} name={displayNameOf(p, anonymous)} size={30} alt="" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-14 font-semibold">{displayNameOf(p, anonymous)}</span>
              <span dir="ltr" className="block truncate text-12 text-muted">
                @{p.username}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
