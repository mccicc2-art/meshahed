import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AppState } from "react-native";
import { Image } from "expo-image";
import { api, queryClient } from "../api";
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
export const trendingQuery = {
  queryKey: ["search:trending"] as const,
  queryFn: async () => (await api<SearchTrendingPayload>("/api/v1/search/trending")).data.items,
  staleTime: 600_000,
  retry: 0,
};

/**
 * 🆕 D-1263 — **القائمةُ تُجلب قبل أن يُفتح التبويب، ولا تتبدّل تحت العين** (أحمد ٤ أكتوبر: «فيه تأخير خفيف في ظهور
 * الترند… لاكن ما ابغى حركة يظهر القديم ثم تتجدد»). كانت تُطلب لحظةَ تركيب الشاشة، فيُرى الهيكلُ حتى يعود الخادم.
 *
 * 🔑 **الخطّافُ لا يجلب من نفسه إلّا إن لم يكن في الذاكرة شيء** (`refetchOnMount: false`): التجديدُ كلُّه من
 * `refreshTrending` — بعد أن تهدأ الرئيسيّة، وعند عودة التطبيق من الخلفيّة، وعند مغادرة التبويب — وكلُّها لحظاتٌ
 * لا تُرى فيها القائمة. ⚖️ **ولا تُحفظ على القرص**: قائمةُ الأمس تُرسم عند الإقلاع ثمّ تتبدّل، وهو عينُ المرفوض.
 */
export function useTrending() {
  return useQuery({ ...trendingQuery, refetchOnMount: false, refetchOnReconnect: false });
}

/** التبويبُ ظاهرٌ الآن؟ — الشاشةُ تعلنه (`useFocusEffect`)، والتجديدُ لا يبدأ وهي ظاهرة */
let searchShown = false;
export function trendingShown(on: boolean) {
  searchShown = on;
}

/** يجلب إن غابت أو مضت عشرُ دقائق (`fetchQuery` يحترم `staleTime`)؛ وملصقاتُها معها فتُرسم الصفوفُ بصورها */
export function refreshTrending(): void {
  if (searchShown) return;
  void queryClient
    .fetchQuery(trendingQuery)
    .then((items) => {
      const urls = items.map((r) => r.poster).filter((u): u is string => !!u);
      if (urls.length) void Image.prefetch(urls, "memory-disk");
    })
    .catch(() => {});
}

let warmedTrend = false;
/** مرّةً لكلِّ جلسة، من تسخين الرئيسيّة (`warmDiscoverOnce`): الجلبُ الأوّل، ثمّ مستمعُ العودة من الخلفيّة */
export function warmTrendingOnce(): void {
  if (warmedTrend) return;
  warmedTrend = true;
  refreshTrending();
  AppState.addEventListener("change", (st) => {
    if (st === "active") refreshTrending();
  });
}
