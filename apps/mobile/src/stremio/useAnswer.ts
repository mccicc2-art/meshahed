import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
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
 * 🆕 R76 — **وعند فقد التركيز والخروج إلى الخلفيّة أيضاً** (أحمد ٢٢ أكتوبر: «اغير الصفحة او اقفل التطبيق و اندو ديسميس
 * ما راح»): الرئيسيّةُ تبقى مركّبةً خلف التبويبات فلا «إزالة»، والتطبيقُ في الخلفيّة يُوقف المؤقّتات وإغلاقُه يقتلها — فكان
 * الجوابُ يضيع ويعود السؤال. فمغادرةُ الشاشة أو التطبيق أثناء «تراجع» = تثبيتُ الجواب فوراً (لا تراجعَ لمن غادر).
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

  /* إرسالُ كلِّ ما ينتظر — بلا رسائل: الشاشةُ غادرت أو التطبيقُ نزل إلى الخلفيّة */
  const flushAll = useCallback(() => {
    const map = pending.current;
    for (const [id, p] of map) {
      clearTimeout(p.timer);
      void write("/api/v1/me/stremio/answer", { id, watched: p.watched }).catch(() => {});
    }
    map.clear();
  }, []);

  /* الإزالة */
  useEffect(() => flushAll, [flushAll]);

  /* فقدُ التركيز: تبويبٌ آخر أو شاشةٌ فوقها — الرئيسيّةُ تبقى مركّبة فلا تصلها الإزالة */
  useFocusEffect(useCallback(() => flushAll, [flushAll]));

  /* الخلفيّة: المؤقّتاتُ تتوقّف هناك، وإغلاقُ التطبيق يقتلها */
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") flushAll();
    });
    return () => sub.remove();
  }, [flushAll]);

  return { hidden, answer };
}
