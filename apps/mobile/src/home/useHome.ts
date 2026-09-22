import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, qk, queryClient } from "../api";
import type { HomePayload, HomeExtrasPayload } from "../contracts";

/**
 * بياناتُ الرئيسية الأصليّة (Phase 11-H · H2، D-1066): موجتان كموجتَي الويب —
 * `me/home` يُرسم فوراً، و`me/home/extras` يُركَّب عليه حين يصل (مشاهدُ «التالي»
 * لبطاقات القوائم، أرقامُ حلقات القادم، الرائج). **لا يحسب هذا الملفُّ شيئاً**:
 * الحساب في `lib/homeCore.ts` على الخادم، وهنا الشكلُ وحدَه.
 *
 * 🔑 **الوسمُ `home`** هو ما تُبطله كتاباتُ التتبّع (`invalidates` من `v1`) —
 * فعلامةُ حلقةٍ في صفحة العمل تعيد جلبَ الرئيسية عند العودة إليها، كالويب.
 */
export const HOME_KEY = qk.tag("home");
export const HOME_EXTRAS_KEY = ["home:extras"] as const;

export function prefetchHome(): void {
  void queryClient.prefetchQuery({ queryKey: HOME_KEY, queryFn: fetchHome, staleTime: 60_000 });
}

async function fetchHome() {
  return (await api<HomePayload>("/api/v1/me/home")).data;
}
async function fetchExtras() {
  return (await api<HomeExtrasPayload>("/api/v1/me/home/extras")).data;
}

export function useHome() {
  const home = useQuery({ queryKey: HOME_KEY, queryFn: fetchHome, staleTime: 60_000 });
  /* الإضافاتُ تُطلب بعد الأولى لا معها: رسمٌ أوّلُ من القاعدة، وTMDB يجمّل حين يصل (D-087) */
  const extras = useQuery({ queryKey: HOME_EXTRAS_KEY, queryFn: fetchExtras, staleTime: 5 * 60_000, enabled: !!home.data });
  const backdropOf = useMemo(() => {
    const m = extras.data?.backdrops ?? {};
    return (kind: "tv" | "movie", id: number) => m[`${kind}-${id}`] ?? null;
  }, [extras.data]);
  return { home, extras, backdropOf };
}
