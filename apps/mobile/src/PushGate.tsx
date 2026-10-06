import { useEffect, useRef, useState } from "react";
import * as Notifications from "expo-notifications";
import { useRouter, useSegments } from "expo-router";
import { useDoors } from "./messages/common";
import { session } from "./session";
import "./push";

/**
 * ====== ضغطةُ الإشعار ⇢ وجهتُه الأصليّة (D-1305) ======
 *
 * الخادمُ يرسل مع كلِّ إشعارٍ مسارَ الويب نفسَه الذي يفتحه سطرُ الجرس (`signalHref`) — فالترجمةُ إلى شاشةٍ أصليّة هي
 * `openPath` القائمة في «الرسائل» (قائمة · ملفّ · عمل · نقاش · رأي، وما سواها بابٌ ويبيّ). **لا خريطةَ ثانية.**
 * والرسالةُ (`/messages?with=`) تدفع خيطَها مباشرةً.
 *
 * 🔑 **الإقلاعُ من إشعار ينتظر الجذر**: التطبيقُ يُقلع على `/web` ثمّ تُدفع فوقه الرئيسيّةُ الأصليّة (D-1075) — وشاشةٌ
 * تُدفع قبلها تُدفن تحتها. فالمسارُ يُحفظ حتى يصير أعلى المكدّس شاشةً أصليّة، ويسقط بعد عشر ثوانٍ (زائرٌ بلا جلسة).
 */
const PEER = /^\/messages\?with=([0-9a-fA-F-]{36})$/;
const WAIT_MS = 10_000;

function urlOf(r: Notifications.NotificationResponse | null): string | null {
  const url = (r?.notification.request.content.data as { url?: unknown } | undefined)?.url;
  /* مسارٌ نسبيٌّ على نطاقنا وحدَه — رابطٌ كاملٌ في حمولةٍ لا يُفتح */
  return typeof url === "string" && url.startsWith("/") && !url.startsWith("//") ? url : null;
}

export function PushGate() {
  const router = useRouter();
  const segments = useSegments();
  const { openPath } = useDoors("home");
  const [pending, setPending] = useState<{ url: string; at: number } | null>(null);
  const open = useRef(openPath);
  open.current = openPath;

  useEffect(() => {
    try {
      const first = urlOf(Notifications.getLastNotificationResponse());
      if (first) {
        Notifications.clearLastNotificationResponse();
        setPending({ url: first, at: Date.now() });
      }
      const sub = Notifications.addNotificationResponseReceivedListener((r) => {
        const url = urlOf(r);
        if (url) setPending({ url, at: Date.now() });
      });
      return () => sub.remove();
    } catch {
      /* بناءٌ بلا الوحدة الأصليّة — لا إشعارَ يُضغط أصلاً */
      return undefined;
    }
  }, []);

  const top = String(segments[0] ?? "");
  useEffect(() => {
    if (!pending) return;
    if (Date.now() - pending.at > WAIT_MS || !session.seen()) {
      setPending(null);
      return;
    }
    /* `web` (أو لا شيء بعد) ⇒ الجذرُ الأصليُّ لم يُدفع: ننتظر تغيّرَ المقاطع، ومهلةٌ تُسقط المعلَّق */
    if (!top || top === "web" || top === "index") {
      const t = setTimeout(() => setPending((p) => (p && Date.now() - p.at > WAIT_MS ? null : p ? { ...p } : p)), 1500);
      return () => clearTimeout(t);
    }
    const { url } = pending;
    setPending(null);
    const t = setTimeout(() => {
      const peer = PEER.exec(url);
      if (peer) router.push({ pathname: "/messages/[peer]", params: { peer: peer[1], from: "home" } });
      else if (url === "/") return;
      else open.current(url);
    }, 250);
    return () => clearTimeout(t);
  }, [pending, top, router]);

  return null;
}
