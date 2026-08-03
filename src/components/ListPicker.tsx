"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleInList } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon } from "./Icon";

/**
 * إضافة عمل إلى قوائمي.
 *
 * القوائم تُطوى خلف زر واحد: أغلب الزيارات لصفحة عمل لا تنوي إضافته لقائمة،
 * فلا يستحقّ الأمر صفّاً دائماً في الصفحة. والاختيار يُحدَّث تفاؤلياً في
 * الواجهة ثم يُثبَّت على الخادم — الضغطة تبدو فورية.
 */
export function ListPicker({
  lists,
  containing,
  tmdbId,
  mediaType,
  title,
  posterPath,
  locale,
}: {
  lists: { id: string; name: string }[];
  containing: string[];
  tmdbId: number;
  mediaType: "tv" | "movie";
  title: string;
  posterPath: string | null;
  locale: Locale;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [inLists, setInLists] = useState<Set<string>>(new Set(containing));
  const [, start] = useTransition();

  function toggle(listId: string) {
    const add = !inLists.has(listId);
    setInLists((prev) => {
      const next = new Set(prev);
      if (add) next.add(listId);
      else next.delete(listId);
      return next;
    });
    start(async () => {
      try {
        await toggleInList({ listId, tmdbId, mediaType, title, posterPath, add });
        router.refresh();
      } catch {
        // فشل الحفظ: نرجّع العلامة لحالتها الحقيقية بدل إيهام المستخدم
        setInLists((prev) => {
          const next = new Set(prev);
          if (add) next.delete(listId);
          else next.add(listId);
          return next;
        });
      }
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-surface overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-surface-2 transition"
      >
        <Icon name="list" size={16} className="text-muted" />
        <span className="font-medium">{t.listAddTo}</span>
        {inLists.size > 0 && (
          <span className="text-[11px] text-accent">{t.listCount(inLists.size)}</span>
        )}
        <span className="ms-auto text-muted text-xs">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="border-t border-border">
          {lists.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted">
              {t.listNoLists}{" "}
              <Link href="/lists" className="text-accent hover:brightness-110">
                {t.listsTitle}
              </Link>
            </p>
          ) : (
            <ul className="max-h-56 overflow-y-auto divide-y divide-border">
              {lists.map((l) => {
                const on = inLists.has(l.id);
                return (
                  <li key={l.id}>
                    <button
                      onClick={() => toggle(l.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-start hover:bg-surface-2 transition"
                    >
                      <span
                        className={`grid place-items-center w-4 h-4 rounded border shrink-0 ${
                          on ? "bg-accent border-accent text-[color:var(--on-accent)]" : "border-border"
                        }`}
                      >
                        {on && <Icon name="check" size={11} />}
                      </span>
                      <span className="text-[13px] truncate">{l.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
