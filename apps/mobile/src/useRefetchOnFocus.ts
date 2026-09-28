import { useCallback, useRef } from "react";
import { useFocusEffect } from "expo-router";
import { queryClient } from "./api";

/**
 * 🆕 K3 — **العودةُ إلى تبويبٍ حيٍّ تجدّد ما شاخ من بياناته**. كان كلُّ تبديلٍ يبني الشاشةَ من الصفر فيجلب
 * `useQuery` ما تجاوز `staleTime` تلقائيّاً عند التركيب. التبويبُ الثابت لا يُركَّب ثانيةً — فهذا يعيد السلوكَ
 * نفسَه عند الظهور: الاستعلاماتُ التي تبدأ مفاتيحُها بما يُعطى، **والشائخةُ وحدَها**، **ومن الظهور الثاني**
 * (الأوّلُ تركيبٌ يجلب بنفسه). والكتابةُ من شاشةٍ أخرى تبطل بالوسوم كما كانت، فتصل ولو والتبويبُ مخفيّ.
 */
export function useRefetchOnFocus(prefixes: readonly string[]) {
  const seen = useRef(false);
  const keys = useRef(prefixes);
  keys.current = prefixes;
  useFocusEffect(
    useCallback(() => {
      if (!seen.current) {
        seen.current = true;
        return;
      }
      void queryClient.refetchQueries({
        predicate: (q) => {
          const head = q.queryKey[0];
          return typeof head === "string" && keys.current.some((p) => head.startsWith(p)) && q.isStale() && q.getObserversCount() > 0;
        },
      });
    }, []),
  );
}
