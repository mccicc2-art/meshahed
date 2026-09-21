import { useCallback } from "react";
import { write } from "./api";
import type { CardStore } from "./cardStore";
import type { HoldAction } from "./library/HoldMenu";
import type { DismissBody, FollowBody, ShowRefBody, ToggleMovieBody, UnfollowBody } from "./contracts";

/**
 * ====== أفعالُ الضغط المطوّل على بطاقةٍ خارج المكتبة — خطّافٌ واحد (D-1036) ======
 *
 * **لماذا**: صفحةُ القائمة الأصليّة تحتاج أفعالَ «اكتشف» نفسَها (للمشاهدة · شاهدته · مراجعة) بالتفاؤل
 * والتراجع نفسَيهما. كانت داخل `DiscoverScreen.act`؛ **استُخرجت لا نُسخت** (درسُ D-289): نسختان من
 * تفاؤلٍ واحد تفترقان عند أوّل إصلاح. المنطقُ منطقُ D-978/D-1028 حرفاً: الطبقةُ التفاؤليّةُ في
 * `cardStore`، ثمّ الكتابة، ثمّ **التراجعُ عند الفشل**.
 */
export type ActCard = { kind: "tv" | "movie"; id: number; title: string; poster_path: string | null };

export function useCardActs<C extends ActCard>(
  store: CardStore,
  o: {
    onReview: (c: C) => void;
    onError: (e: unknown) => void;
    /** «غير مهتمّ» — لمن يعرضه وحدَه («اكتشف»): يخفي البطاقةَ ويعيدها عند الفشل */
    onDismiss?: (key: string, hidden: boolean) => void;
  },
) {
  const { onReview, onError, onDismiss } = o;
  return useCallback(
    async (a: HoldAction, c: C): Promise<boolean> => {
      const key = `${c.kind}-${c.id}`;
      if (a === "review") {
        onReview(c);
        return true;
      }
      const before = store.override(key);
      try {
        if (a === "towatch") {
          const inList = !!store.mark(key);
          store.setOverride(key, inList ? null : { saved: true, progress: 0, completed: false, dropped: false });
          if (inList) await write<unknown>("/api/v1/track/unfollow", { tmdbId: c.id, mediaType: c.kind } satisfies UnfollowBody);
          else await write<unknown>("/api/v1/track/follow", { tmdbId: c.id, mediaType: c.kind, title: c.title, posterPath: c.poster_path } satisfies FollowBody);
        } else if (a === "all") {
          store.setOverride(key, { saved: false, progress: 100, completed: true, dropped: false });
          if (c.kind === "tv") await write<unknown>("/api/v1/track/show-watched", { showTmdbId: c.id } satisfies ShowRefBody);
          else await write<unknown>("/api/v1/track/movie", { movieTmdbId: c.id, runtime: null, watched: true } satisfies ToggleMovieBody);
        } else if (a === "dismiss" && onDismiss) {
          onDismiss(key, true);
          await write<unknown>("/api/v1/track/dismiss", { tmdbId: c.id, mediaType: c.kind } satisfies DismissBody);
        }
      } catch (e) {
        /* التراجعُ عن التفاؤل عند الفشل — والبطاقةُ المخفيّةُ تعود */
        store.setOverride(key, before);
        if (a === "dismiss") onDismiss?.(key, false);
        onError(e);
        return false;
      }
      return true;
    },
    [store, onReview, onError, onDismiss],
  );
}

/** علاماتُ المكتبة لكلِّ عمل — حسابُ «اكتشف» حرفاً (`DiscoverScreen.marks`)، مكانٌ واحدٌ لمن يحتاجه */
export function marksOf(items: { kind: "tv" | "movie"; id: number; aired: number; watched: number; status: string }[] | undefined) {
  const m = new Map<string, { saved: boolean; progress: number; completed: boolean; dropped: boolean } | null>();
  for (const x of items ?? []) {
    const aired = x.aired;
    const watched = Math.min(x.watched, aired || Infinity);
    const done = x.status === "completed";
    const progress = x.kind === "tv" ? (aired > 0 ? Math.round((watched / aired) * 100) : 0) : done ? 100 : 0;
    m.set(`${x.kind}-${x.id}`, { saved: x.status === "unstarted", progress, completed: done, dropped: x.status === "dropped" });
  }
  return m;
}
