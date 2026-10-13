import { useEffect, useRef, useState } from "react";
import * as Linking from "expo-linking";
import { useRouter, useSegments } from "expo-router";
import { write } from "./api";
import { queryClient } from "./api";
import { session } from "./session";
import { HOME_KEY } from "./home/useHome";
import { widgetBus } from "./widget/bus";
import { refreshWidgets } from "./widget/feed";
import type { WatchStateBody } from "./contracts";

/**
 * ====== 🆕 لمسةُ الودجت ⇢ الشاشةُ الأصليّة (خطّةُ الودجتات §2.3) ======
 *
 * الودجتُ يفتح `com.loopztv.app://w/<فعل>?…` — و`+native-intent` يردّه فارغاً فلا ينتقل الموجِّهُ إلى شاشةٍ
 * لا وجودَ لها، والتنفيذُ هنا. **لا `web?u=`** (بابُ الويب الأخير الذي كان للودجت — V-A).
 *
 * 🔑 **الإقلاعُ من الودجت ينتظر الجذر** — وصفةُ `PushGate` حرفاً: التطبيقُ يُقلع ثمّ تُدفع الرئيسيّةُ الأصليّة، وشاشةٌ
 * تُدفع قبلها تُدفن تحتها. فالرابطُ يُحفظ حتى يصير أعلى المكدّس شاشةً أصليّة، ويسقط بعد عشر ثوانٍ (لا جلسة).
 */
const WAIT_MS = 10_000;

type Action =
  | { do: "title"; kind: "tv" | "movie"; id: number }
  | { do: "all"; section: "continue" | "towatch" | "upcoming" }
  | { do: "calendar" }
  | { do: "discover" }
  | { do: "list"; id: string }
  | { do: "start"; id: number; title: string; action: "start" | "unpause" };

/** `com.loopztv.app://w/title?k=tv&id=1` ⇐ فعلٌ معروف، وكلُّ ما سواه يُهمل */
export function widgetActionOf(url: string | null): Action | null {
  if (!url) return null;
  const m = /^com\.loopztv\.app:\/\/w\/([a-z]+)(?:\?(.*))?$/i.exec(url);
  if (!m) return null;
  const q = new URLSearchParams(m[2] ?? "");
  const id = Number(q.get("id"));
  switch (m[1]) {
    case "title": {
      const kind = q.get("k") === "movie" ? "movie" : q.get("k") === "tv" ? "tv" : null;
      return kind && Number.isInteger(id) && id > 0 ? { do: "title", kind, id } : null;
    }
    case "all": {
      const s = q.get("s");
      return s === "continue" || s === "towatch" || s === "upcoming" ? { do: "all", section: s } : null;
    }
    case "calendar":
      return { do: "calendar" };
    case "discover":
      return { do: "discover" };
    case "list": {
      const lid = q.get("id") ?? "";
      return /^[0-9a-f-]{36}$/i.test(lid) ? { do: "list", id: lid } : null;
    }
    case "start": {
      const a = q.get("a") === "unpause" ? "unpause" : "start";
      return Number.isInteger(id) && id > 0 ? { do: "start", id, title: (q.get("t") ?? "").slice(0, 200), action: a } : null;
    }
    default:
      return null;
  }
}

export function WidgetGate() {
  const router = useRouter();
  const segments = useSegments();
  const [pending, setPending] = useState<{ action: Action; at: number } | null>(null);
  const nav = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (nav.current) clearTimeout(nav.current);
    },
    [],
  );

  useEffect(() => {
    let alive = true;
    void Linking.getInitialURL().then((u) => {
      const a = widgetActionOf(u);
      if (alive && a) setPending({ action: a, at: Date.now() });
    });
    const sub = Linking.addEventListener("url", ({ url }) => {
      const a = widgetActionOf(url);
      if (a) setPending({ action: a, at: Date.now() });
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  const top = String(segments[0] ?? "");
  useEffect(() => {
    if (!pending) return;
    if (Date.now() - pending.at > WAIT_MS || !session.seen()) {
      setPending(null);
      return;
    }
    if (!top || top === "web" || top === "index") {
      const t = setTimeout(() => setPending((p) => (p && Date.now() - p.at > WAIT_MS ? null : p ? { ...p } : p)), 1500);
      return () => clearTimeout(t);
    }
    const { action } = pending;
    setPending(null);
    if (nav.current) clearTimeout(nav.current);
    nav.current = setTimeout(() => {
      nav.current = null;
      switch (action.do) {
        case "title":
          router.push({ pathname: "/title/[kind]/[id]", params: { kind: action.kind, id: String(action.id), from: "home" } });
          return;
        case "list":
          router.push({ pathname: "/list/[id]", params: { id: action.id, from: "home" } });
          return;
        case "calendar":
          router.push({ pathname: "/calendar", params: { from: "home" } });
          return;
        case "discover":
          router.navigate("/discover");
          return;
        case "all":
          router.navigate("/home");
          widgetBus.emit({ type: "all", section: action.section });
          return;
        case "start": {
          /* «ابدأ» من الخانة الباهتة (W5): الكتابةُ ثمّ الرئيسيّةُ وتوستُ «تراجع» عليها — العملُ صار في «أكمل المشاهدة» */
          const body: WatchStateBody = { showTmdbId: action.id, state: action.action === "start" ? "started" : null };
          router.navigate("/home");
          void write<unknown>("/api/v1/track/watch-state", body)
            .then(() => queryClient.invalidateQueries({ queryKey: HOME_KEY }))
            .then(() => {
              widgetBus.emit({ type: "started", id: action.id, title: action.title, action: action.action });
              void refreshWidgets(true);
            })
            .catch(() => {
              /* الخادمُ رفض أو لا شبكة: الرئيسيّةُ مفتوحةٌ على حالها — لا توستَ يكذب */
            });
          return;
        }
      }
    }, 250);
    return undefined;
  }, [pending, top, router]);

  return null;
}
