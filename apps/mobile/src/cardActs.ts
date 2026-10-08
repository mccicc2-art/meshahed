import { useCallback } from "react";
import { write } from "./api";
import type { CardMark, CardStore } from "./cardStore";
import { useApp } from "./state";
import type { ToastTone } from "./ui";
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
/**
 * D-1328 — **حالُ العمل من «للمشاهدة» كما يراها الضغطُ المطوّل**: كانت قيمةً واحدة («أفي المكتبة؟») فظهر
 * «أزِله من للمشاهدة» فوق مسلسلٍ أُكمل وخرج منها (بلاغُ أحمد: «بريكنغ باد» بعد الإكمال). الآن أربعُ حالات:
 * `none` لم يُضَف · `saved` في «للمشاهدة» ولم يبدأ (الإزالةُ له وحدَه) · `watching` بدأه (أو أوقفه) — لا إزالةَ
 * من هنا، المكتبةُ وحدها تملكها · `completed` أكمله — لا يعود إلى «للمشاهدة» بضغطة.
 */
export type ToWatchState = "none" | "saved" | "watching" | "completed";
export function toWatchState(m: CardMark): ToWatchState {
  if (!m) return "none";
  if (m.completed) return "completed";
  if (m.saved) return "saved";
  return "watching";
}

export type ActCard = { kind: "tv" | "movie"; id: number; title: string; poster_path: string | null };

export function useCardActs<C extends ActCard>(
  store: CardStore,
  o: {
    onReview: (c: C) => void;
    onError: (e: unknown) => void;
    /** «غير مهتمّ» — لمن يعرضه وحدَه («اكتشف»): يخفي البطاقةَ ويعيدها عند الفشل */
    onDismiss?: (key: string, hidden: boolean) => void;
    /** D-1328 — إشعارُ «للمشاهدة»: أُضيف (أخضر) · أُزيل (محايد) · أكملتَه (محايد بلا كتابة) */
    say?: (text: string, tone: ToastTone) => void;
  },
) {
  const { onReview, onError, onDismiss, say } = o;
  const { t } = useApp();
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
          const state = toWatchState(store.mark(key));
          /* أكملتَه: الصفُّ مطفأٌ ويقول السببَ فقط — لا كتابة. بدأتَه: لا صفَّ إزالةٍ أصلاً، والحارسُ هنا
             كي لا يمحو نداءٌ متأخّرٌ متابعةَ عملٍ بدأته */
          if (state === "completed") {
            say?.(t.toWatchDone, "info");
            return false; // لا كتابةَ فلا اهتزازَ نجاح
          }
          if (state === "watching") return false;
          const remove = state === "saved";
          store.setOverride(key, remove ? null : { saved: true, progress: 0, completed: false, dropped: false });
          if (remove) await write<unknown>("/api/v1/track/unfollow", { tmdbId: c.id, mediaType: c.kind } satisfies UnfollowBody);
          else await write<unknown>("/api/v1/track/follow", { tmdbId: c.id, mediaType: c.kind, title: c.title, posterPath: c.poster_path } satisfies FollowBody);
          say?.(remove ? t.toWatchRemoved : t.toWatchAdded, remove ? "info" : "success");
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
    [store, onReview, onError, onDismiss, say, t],
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
