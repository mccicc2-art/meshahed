"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useState, useTransition } from "react";
import { toggleReaction, follow, unfollow } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { whenLabel } from "@/lib/when";
import type { MediaType } from "@/lib/media";

export interface NewsItem {
  id: number;
  mediaType: MediaType;
  title: string;
  overview: string;
  poster: string | null;
  posterPath: string | null;
  backdrop: string | null;
  date: string;
  rating: number | null;
}

export function NewsPost({
  item,
  locale,
  initialCount,
  initialReacted,
  initialFollowing,
  priority = false,
}: {
  item: NewsItem;
  locale: Locale;
  initialCount: number;
  initialReacted: boolean;
  initialFollowing: boolean;
  /** أول منشورين فقط يُحمّلان فوراً — الباقي كسول */
  priority?: boolean;
}) {
  const t = getDict(locale);
  const [count, setCount] = useState(initialCount);
  const [reacted, setReacted] = useState(initialReacted);
  const [saved, setSaved] = useState(initialFollowing);
  const [, start] = useTransition();

  const href = `/${item.mediaType === "tv" ? "show" : "movie"}/${item.id}`;

  function fire() {
    const next = !reacted;
    setReacted(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));
    start(async () => {
      try {
        await toggleReaction({ tmdbId: item.id, mediaType: item.mediaType, on: next });
      } catch {
        setReacted(!next);
        setCount((c) => Math.max(0, c + (next ? -1 : 1)));
      }
    });
  }

  function favorite() {
    const next = !saved;
    setSaved(next);
    start(async () => {
      try {
        if (next) {
          await follow({
            tmdbId: item.id,
            mediaType: item.mediaType,
            title: item.title,
            posterPath: item.posterPath,
          });
        } else {
          await unfollow({ tmdbId: item.id, mediaType: item.mediaType });
        }
      } catch {
        setSaved(!next);
      }
    });
  }

  return (
    <article className="bg-surface border border-border rounded-2xl overflow-hidden">
      <Link href={href} className="block relative aspect-[16/9] bg-surface-2 group">
        {item.backdrop ? (
          <img
            src={item.backdrop}
            alt=""
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={priority ? "high" : "low"}
            className="w-full h-full object-cover group-hover:scale-[1.02] transition duration-300"
          />
        ) : item.poster ? (
          <img
            src={item.poster}
            alt=""
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="w-full h-full grid place-items-center text-4xl text-muted">🎬</span>
        )}
        <span className="absolute top-3 start-3 text-[11px] font-semibold bg-black/75 text-accent px-2.5 py-1 rounded-full">
          {item.mediaType === "tv" ? t.typeSeries : t.typeMovie}
        </span>
        {item.date && (
          <span className="absolute top-3 end-3 text-[11px] font-semibold bg-black/75 text-accent-2 px-2.5 py-1 rounded-full">
            {whenLabel(item.date, t)}
          </span>
        )}
      </Link>

      <div className="p-4">
        <Link href={href}>
          <h3 className="font-bold text-lg leading-tight hover:text-accent transition">
            {item.title}
          </h3>
        </Link>
        {item.rating ? <p className="text-xs text-accent mt-1">★ {item.rating}</p> : null}
        {item.overview && (
          <p className="text-sm text-muted leading-relaxed mt-2 line-clamp-3">{item.overview}</p>
        )}

        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={fire}
            aria-pressed={reacted}
            aria-label={t.reactAria}
            title={t.reactAria}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm transition ${
              reacted
                ? "bg-accent/15 border-accent text-accent font-semibold"
                : "bg-surface-2 border-border text-muted hover:border-accent/60"
            }`}
          >
            <span className={reacted ? "" : "grayscale opacity-70"}>🔥</span>
            {count > 0 && <span>{count}</span>}
          </button>

          <button
            onClick={favorite}
            aria-pressed={saved}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm transition ${
              saved
                ? "bg-accent-2/15 border-accent-2 text-accent-2 font-semibold"
                : "bg-surface-2 border-border text-muted hover:border-accent-2/60"
            }`}
          >
            {saved ? t.inFavorites : t.addToFavorites}
          </button>
        </div>
      </div>
    </article>
  );
}
