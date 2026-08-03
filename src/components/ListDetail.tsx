"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { renameList, toggleInList } from "@/lib/actions";
import { posterUrl } from "@/lib/media";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon } from "./Icon";
import type { ListItem } from "@/lib/data";

/**
 * صفحة القائمة الواحدة.
 *
 * الاسم يُحرَّر في مكانه لا في نافذة منفصلة، والإزالة بضغطة واحدة بلا تأكيد:
 * إزالة عمل من قائمة تُستدرك بإضافته ثانية، فالتأكيد هنا عائق لا حماية —
 * بخلاف حذف القائمة كاملةً.
 */
export function ListDetail({
  listId,
  name,
  isPublic,
  items,
  isOwner,
  locale,
}: {
  listId: string;
  name: string;
  isPublic: boolean;
  items: ListItem[];
  isOwner: boolean;
  locale: Locale;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [pending, start] = useTransition();
  const [removed, setRemoved] = useState<Set<string>>(new Set());

  function save(nextPublic = isPublic) {
    const clean = draft.trim();
    if (!clean) return;
    setEditing(false);
    start(async () => {
      await renameList(listId, clean, nextPublic);
      router.refresh();
    });
  }

  function remove(it: ListItem) {
    const key = `${it.media_type}-${it.tmdb_id}`;
    setRemoved((prev) => new Set(prev).add(key));
    start(async () => {
      await toggleInList({
        listId,
        tmdbId: it.tmdb_id,
        mediaType: it.media_type,
        title: it.title ?? "",
        posterPath: it.poster_path,
        add: false,
      });
      router.refresh();
    });
  }

  const visible = items.filter((i) => !removed.has(`${i.media_type}-${i.tmdb_id}`));

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-1">
        {editing ? (
          <input
            autoFocus
            value={draft}
            maxLength={60}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") {
                setDraft(name);
                setEditing(false);
              }
            }}
            className="flex-1 min-w-0 rounded-xl bg-surface-2 border border-border px-3 py-1.5 text-lg font-bold outline-none focus:border-accent"
          />
        ) : (
          <h1 className="text-xl font-bold min-w-0 break-words">{name}</h1>
        )}

        {isOwner &&
          (editing ? (
            <button
              onClick={() => save()}
              disabled={pending}
              className="shrink-0 px-3 py-1.5 rounded-xl bg-accent text-[color:var(--on-accent)] text-xs font-bold disabled:opacity-50"
            >
              {t.listSave}
            </button>
          ) : (
            <button
              onClick={() => setEditing(true)}
              aria-label={t.listRename}
              className="shrink-0 grid place-items-center w-8 h-8 rounded-full border border-border bg-surface hover:border-accent transition"
            >
              <Icon name="edit" size={15} className="text-muted" />
            </button>
          ))}
      </div>

      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-muted">{t.listCount(visible.length)}</span>
        {isOwner ? (
          <button
            onClick={() => save(!isPublic)}
            disabled={pending}
            className={`text-[11px] px-2 py-0.5 rounded-full border transition disabled:opacity-50 ${
              isPublic
                ? "border-accent/50 bg-accent/10 text-accent"
                : "border-border text-muted hover:border-accent/50"
            }`}
            title={t.listPublicHint}
          >
            {isPublic ? t.listPublic : t.listPrivate}
          </button>
        ) : (
          <span className="text-[11px] px-2 py-0.5 rounded-full border border-border text-muted">
            {t.listOwnerOther}
          </span>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-muted text-center py-16">{t.listItemsEmpty}</p>
      ) : (
        <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(96px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(130px,1fr))]">
          {visible.map((it) => {
            const url = posterUrl(it.poster_path, "w342");
            const href = it.media_type === "movie" ? `/movie/${it.tmdb_id}` : `/show/${it.tmdb_id}`;
            return (
              <div key={`${it.media_type}-${it.tmdb_id}`} className="relative group">
                <Link href={href} prefetch={false} className="block">
                  <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-surface-2 border border-border">
                    {url ? (
                      <Image
                        src={url}
                        alt={it.title ?? ""}
                        fill
                        sizes="(max-width: 640px) 33vw, 140px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="absolute inset-0 grid place-items-center text-muted">
                        <Icon name={it.media_type === "movie" ? "film" : "tv"} size={20} />
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-[12px] leading-tight line-clamp-2">{it.title ?? `#${it.tmdb_id}`}</p>
                </Link>

                {isOwner && (
                  <button
                    onClick={() => remove(it)}
                    aria-label={t.listRemove}
                    className="absolute top-1.5 end-1.5 grid place-items-center w-6 h-6 rounded-full bg-black/70 text-white/80 hover:text-white hover:bg-black/90 transition opacity-0 group-hover:opacity-100 focus:opacity-100"
                  >
                    <span className="text-sm leading-none">×</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
