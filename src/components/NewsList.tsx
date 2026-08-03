"use client";

import { useState } from "react";
import { NewsPost, type NewsItem } from "./NewsPost";
import { getDict, type Locale } from "@/lib/i18n";

const PAGE = 12;

/**
 * كانت الصفحة تحمّل ٣٠ منشوراً بصور عريضة دفعة واحدة.
 * الآن ١٢ منشوراً أولاً، والباقي بطلب المستخدم.
 */
export function NewsList({
  items,
  locale,
  counts,
  mine,
  followed,
}: {
  items: NewsItem[];
  locale: Locale;
  counts: Record<string, number>;
  mine: string[];
  followed: string[];
}) {
  const t = getDict(locale);
  const [shown, setShown] = useState(PAGE);

  const mineSet = new Set(mine);
  const followedSet = new Set(followed);
  const visible = items.slice(0, shown);
  const hasMore = shown < items.length;

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2">
        {visible.map((item, i) => {
          const key = `${item.mediaType}-${item.id}`;
          return (
            <NewsPost
              key={key}
              item={item}
              locale={locale}
              priority={i < 2}
              initialCount={counts[key] ?? 0}
              initialReacted={mineSet.has(key)}
              initialFollowing={followedSet.has(key)}
            />
          );
        })}
      </div>

      {hasMore && (
        <div className="flex flex-col items-center gap-2 mt-8">
          <button
            onClick={() => setShown((n) => n + PAGE)}
            className="px-6 py-3 rounded-xl border border-border bg-surface text-sm font-semibold hover:border-accent hover:text-accent transition"
          >
            {t.newsMore}
          </button>
          <span className="text-xs text-muted" dir="ltr">
            {t.newsShown(visible.length, items.length)}
          </span>
        </div>
      )}
    </>
  );
}
