import { useCallback, useEffect } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api, queryClient } from "../api";
import { HOME_KEY } from "../home/useHome";
import { MESSAGES_KEY } from "./live";
import type { BadgesPayload, HomePayload, MessagesPayload } from "../contracts";

/**
 * ====== شارتا الظرف والجرس — طلبٌ خفيفٌ مستقلّ (M4-fix2) ======
 *
 * 🔴 **تسجيلُ أحمد (٢٨ سبتمبر)**: رسالةٌ والتطبيقُ مغلق ⇐ الفتح ⇐ الرئيسيّةُ بلا شارة ⇐ «الرسائل» ⇐ الشارةُ تظهر. الرئيسيّةُ
 * تُرسم من كاشها المحفوظ (D-1083)، ورأسُها يحمل رقمَ آخر فتحة، **وحمولتُها الكاملةُ ثقيلةٌ تصل بعد الرمز بثوانٍ** — ومن ضغط
 * الظرفَ قبلها لم يرَ الشارةَ قطّ. **ومن عاد من الخلفيّة لا يُعاد جلبُ رئيسيّته أصلاً** (لا تجديدَ عند العودة) فتبقى الشارةُ
 * القديمةُ ما بقي التطبيقُ حيّاً.
 *
 * 🔑 **رقمان من الخادم وحدَه** (خطّة §٧) يُسألان: عند ظهور الرئيسيّة · عند كلِّ عودةٍ من الخلفيّة — ويُكتبان في رأس الرئيسيّة
 * وفي الصندوق معاً، فالموضعان لا يفترقان.
 */
const BADGES_KEY = ["me:badges"] as const;

function write(b: BadgesPayload) {
  queryClient.setQueryData<HomePayload>(HOME_KEY, (p) =>
    p && (p.header.unread_shares !== b.messages || p.header.unread_signals !== b.signals)
      ? { ...p, header: { ...p.header, unread_shares: b.messages, unread_signals: b.signals } }
      : p,
  );
  queryClient.setQueryData<MessagesPayload>(MESSAGES_KEY, (p) =>
    p && (p.unread.messages !== b.messages || p.unread.signals !== b.signals) ? { ...p, unread: { messages: b.messages, signals: b.signals } } : p,
  );
}

/** في الرئيسيّة: يسأل عند الظهور وعند العودة من الخلفيّة، ويكتب الرقمَ حيث يُرسم */
export function useBadges(enabled: boolean) {
  const q = useQuery({
    queryKey: BADGES_KEY,
    queryFn: async () => (await api<BadgesPayload>("/api/v1/me/badges")).data,
    enabled,
    staleTime: 10_000,
  });
  const at = q.dataUpdatedAt;
  useEffect(() => {
    if (q.data) write(q.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at]);
  const refetch = q.refetch;
  useFocusEffect(
    useCallback(() => {
      if (enabled) void refetch();
    }, [enabled, refetch]),
  );
  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void refetch();
    });
    return () => sub.remove();
  }, [enabled, refetch]);
}
