import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { write } from "../api";
import { useApp } from "../state";
import { haptic } from "../haptics";
import { messageOf } from "../settings/api";
import type { ToastHostRef } from "../HoldHost";
import type { StremioSignal } from "@/core/contracts/stremio";
import { episodeLabel } from "./api";

/** مدّةُ «تراجع» — وبعدها يُرسل الجواب */
const UNDO_MS = 4500;

/**
 * 🆕 **جوابُ إشارة Stremio مع «تراجع»** — للبطاقة والقائمة معاً (قرار ٥: ✓ أو ✕ تُخفي الإشارة فوراً وتُظهر التي بعدها،
 * والإشعارُ الواحد يعرض «تراجع»).
 *
 * 🔑 **الجوابُ يُرسل بعد مهلة التراجع لا قبلها**: ✓ على حلقةٍ يعلّم كلَّ ما قبلها ويتابع المسلسل — كتابةٌ لا تُعكس بنقرة
 * (لا نعرف ما كان معلَّماً قبلها). فالإخفاءُ فوريّ والكتابةُ مؤجّلة، و«تراجع» يُلغي المؤقّتَ فلا يصل الخادمَ شيء.
 * ⚠️ **ومغادرةُ الشاشة لا تُسقط الجواب**: ما بقي في الانتظار يُرسل عند الإزالة — من ضغط ✓ ثمّ خرج قد أجاب.
 */
export function useStremioAnswer(toast: RefObject<ToastHostRef | null>) {
  const { t } = useApp();
  const [hidden, setHidden] = useState<ReadonlySet<number>>(() => new Set());
  const pending = useRef(new Map<number, { watched: boolean; timer: ReturnType<typeof setTimeout> }>());

  const unhide = useCallback((id: number) => {
    setHidden((h) => {
      const n = new Set(h);
      n.delete(id);
      return n;
    });
  }, []);

  const commit = useCallback(
    (id: number) => {
      const p = pending.current.get(id);
      if (!p) return;
      clearTimeout(p.timer);
      pending.current.delete(id);
      write("/api/v1/me/stremio/answer", { id, watched: p.watched }).catch((e: unknown) => {
        unhide(id);
        toast.current?.say(messageOf(e, t as unknown as Record<string, unknown>, t.apiInternal));
      });
    },
    [t, toast, unhide],
  );

  const answer = useCallback(
    (s: StremioSignal, watched: boolean) => {
      haptic.pick();
      setHidden((h) => new Set(h).add(s.id));
      pending.current.set(s.id, { watched, timer: setTimeout(() => commit(s.id), UNDO_MS) });
      const text = !watched
        ? t.stremioDismissed
        : s.kind === "movie"
          ? t.stremioMarkedMovie
          : t.stremioMarkedUpTo(episodeLabel(s, t.stremioMovie));
      toast.current?.say(
        text,
        {
          label: t.undoWatched,
          onPress: () => {
            const p = pending.current.get(s.id);
            if (!p) return;
            clearTimeout(p.timer);
            pending.current.delete(s.id);
            unhide(s.id);
          },
        },
        UNDO_MS,
        watched ? "success" : "info",
      );
    },
    [commit, t, toast, unhide],
  );

  /* الخروجُ يرسل ما بقي — بلا انتظار ولا رسائل (الشاشةُ زالت) */
  useEffect(() => {
    const map = pending.current;
    return () => {
      for (const [id, p] of map) {
        clearTimeout(p.timer);
        void write("/api/v1/me/stremio/answer", { id, watched: p.watched }).catch(() => {});
      }
      map.clear();
    };
  }, []);

  return { hidden, answer };
}
