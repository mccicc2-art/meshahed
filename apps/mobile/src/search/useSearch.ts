import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "../api";
import type { SearchPayload, SearchScope, SearchTrendingPayload } from "../contracts";

/** حرفان كالويب (`MIN = 2` في `SearchScreen.tsx`) — «IT» و«٢٤» و«لو» أعمالٌ حقيقيّة */
export const MIN_QUERY = 2;
/** debounce الويب نفسُه (٣٠٠ م.ث) — والحدُّ الخادميّ ٤٠/دقيقة محسوبٌ عليه */
const DEBOUNCE_MS = 300;

/**
 * ====== خطّافُ البحث الواحد — Phase 11-G ======
 *
 * 🔑 **قارئٌ واحدٌ لبابين**: شاشةُ البحث ومنتقي «أضف إلى القائمة» (G4) يقرآن `/api/v1/search`
 * من هنا — تأخيرٌ واحد، مفتاحُ كاشٍ واحد (`search:<scope>:<q>`)، فالبحثُ عن «Dark» في الشاشة ثمّ في
 * المنتقي نداءٌ واحد. **والنتيجةُ السابقةُ تبقى مرسومةً حتى تصل الجديدة** (`keepPreviousData`) — كالويب
 * الذي يُبقي `data` القديمة ويُظهر `loading` وحدَه؛ قائمةٌ تُمحى وتُعاد مع كلِّ حرفٍ ترتجف.
 *
 * 🔑 **الإلغاءُ بالمفتاح لا بـAbortController**: استعلامُ React Query لحرفٍ سابق يبقى في الكاش ولا يُرسم،
 * وهو ما كان `AbortController` يفعله في الويب بنتيجةٍ واحدة — لا حاجةَ لنسخِه.
 */
export function useDebounced(value: string, ms = DEBOUNCE_MS): string {
  const [v, setV] = useState(value);
  useEffect(() => {
    const h = setTimeout(() => setV(value), ms);
    return () => clearTimeout(h);
  }, [value, ms]);
  return v;
}

export function useSearch(term: string, scope: SearchScope) {
  const q = term.trim();
  const enabled = q.length >= MIN_QUERY;
  return useQuery({
    queryKey: [`search:${scope}:${q}`] as const,
    queryFn: async () => (await api<SearchPayload>(`/api/v1/search?q=${encodeURIComponent(q)}&type=${scope}`)).data,
    enabled,
    /* الويبُ يخزّن دقيقةً في المتصفّح (`max-age=60`) — الرقمُ نفسُه هنا */
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    retry: 0,
  });
}

/**
 * 🆕 «رائج اليوم» — ما تعرضه الشاشةُ قبل أن يُكتب حرف (قرارُ أحمد ٣ أكتوبر ٢٠٢٦).
 *
 * عشرةٌ بترتيب الخادم (`/api/v1/search/trending`، نواةُ صفحة الويب نفسُها). **عشرُ دقائقَ طازجةً** كعمر
 * ردِّ الخادم في الجهاز: الترتيبُ يوميٌّ فلا يُسأل عنه مع كلِّ عودةٍ للتبويب. وبلا إعادةِ محاولة —
 * إن فشل عادت الشاشةُ لنصّ «ابدأ» القديم، ولا تُعلَّق على هيكل.
 */
export function useTrending() {
  return useQuery({
    queryKey: ["search:trending"] as const,
    queryFn: async () => (await api<SearchTrendingPayload>("/api/v1/search/trending")).data.items,
    staleTime: 600_000,
    retry: 0,
  });
}
