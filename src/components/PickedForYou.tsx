"use client";

import { useState } from "react";
import { PosterRail, RailItem } from "./PosterRail";
import { PosterCard } from "./PosterCard";
import { Icon } from "./Icon";
import { getDict, type Locale } from "@/lib/i18n";
import { tap } from "@/lib/haptics";
import { toast, flashError } from "@/lib/toast";
import { dismissTitle, undoDismissTitle } from "@/lib/actions";

/** ما تحمله البطاقة — مُسلسَلٌ من الخادم، لا كائنات TMDB كاملة */
export interface PickedItem {
  tmdbId: number;
  mediaType: "tv" | "movie";
  title: string;
  posterPath: string | null;
  year?: string;
  note: string;
}

/** كم بطاقةً تُعرض من البِركة في كل صفحة */
const PAGE = 10;

/**
 * «مقترح لك» — عشرةٌ من بِركةٍ كبيرة، بزرّ تحديثٍ و«غير مهتم».
 *
 * كان الصفّ اثني عشر عملاً ثابتاً طوال اليوم (شكوى المالك). الآن الخادم
 * يبني بِركةً تصل المئة من مزيج الذوق نفسه (D-048/المحرّك في suggest.ts)،
 * والعميل يعرض عشراً ويقلّبها **محلياً** بزرّ التحديث — لا طلبَ TMDB لكل
 * ضغطة، والدورة تعود للبداية بعد آخر صفحة.
 *
 * و«غير مهتم» زرٌّ في زاوية الملصق (خارج رابط البطاقة — قاعدة
 * FranchisePanel): يخفي العمل فوراً، يخزّنه في `dismissed_titles` فلا
 * يعود مع أي تحديثٍ قادم، ويعرض توست «تراجع» (D-019) يعيده ويمحو الصفّ.
 */
export function PickedForYou({
  items,
  title,
  locale,
}: {
  items: PickedItem[];
  title: string;
  locale: Locale;
}) {
  const t = getDict(locale);
  const [page, setPage] = useState(0);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());

  const keyOf = (i: PickedItem) => `${i.mediaType}-${i.tmdbId}`;
  const pool = items.filter((i) => !hidden.has(keyOf(i)));
  if (pool.length === 0) return null;

  const pages = Math.max(1, Math.ceil(pool.length / PAGE));
  const current = page % pages;
  const visible = pool.slice(current * PAGE, current * PAGE + PAGE);

  function refresh() {
    tap(8);
    setPage((p) => p + 1);
  }

  function dismiss(item: PickedItem) {
    tap([10, 20]);
    const k = keyOf(item);
    setHidden((prev) => new Set(prev).add(k));
    dismissTitle({ tmdbId: item.tmdbId, mediaType: item.mediaType }).catch((e) =>
      flashError((e as Error).message),
    );
    toast(t.dismissedToast, {
      tone: "info",
      action: {
        label: t.undoWatched,
        run: () => {
          setHidden((prev) => {
            const next = new Set(prev);
            next.delete(k);
            return next;
          });
          undoDismissTitle({ tmdbId: item.tmdbId, mediaType: item.mediaType }).catch(() => {});
        },
      },
    });
  }

  return (
    <PosterRail
      title={title}
      icon="sparkles"
      action={
        /* التحديث في طرف العنوان — موضع فعل الصفّ (D-052's action slot).
           يظهر فقط حين توجد أكثر من صفحة، فزرٌّ لا يغيّر شيئاً كذبة */
        pool.length > PAGE ? (
          <button
            type="button"
            onClick={refresh}
            aria-label={t.pickedRefreshAria}
            className="shrink-0 flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[13px] font-semibold text-muted hover:text-foreground hover:border-accent/50 active:scale-[0.97] transition"
          >
            <Icon name="repeat" size={15} strokeWidth={2} />
            <span>{t.pickedRefresh}</span>
          </button>
        ) : undefined
      }
    >
      {visible.map((s) => (
        <RailItem key={keyOf(s)}>
          <div className="relative">
            <PosterCard
              href={`/${s.mediaType === "movie" ? "movie" : "show"}/${s.tmdbId}`}
              title={s.title}
              posterPath={s.posterPath}
              year={s.year}
              note={s.note}
            />
            {/* «غير مهتم» — زرٌّ حقيقي فوق الملصق لا داخل رابطه */}
            <button
              type="button"
              onClick={() => dismiss(s)}
              aria-label={t.notInterestedAria(s.title)}
              title={t.notInterested}
              className="absolute top-1.5 end-1.5 z-10 grid place-items-center w-7 h-7 rounded-full bg-black/55 text-white/85 hover:bg-black/75 hover:text-white active:scale-95 transition backdrop-blur-sm"
            >
              <Icon name="eye-off" size={14} strokeWidth={2} />
            </button>
          </div>
        </RailItem>
      ))}
    </PosterRail>
  );
}
