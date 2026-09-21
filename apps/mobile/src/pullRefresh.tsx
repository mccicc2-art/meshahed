import React, { useCallback, useState } from "react";
import { RefreshControl } from "react-native";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useApp } from "./state";

/**
 * ====== اسحب للتحديث — D-1044 (Phase 11-F · F5) ======
 *
 * **لماذا**: لا طريقَ في الشاشتين الأصليّتين لقول «حدِّث الآن» — البياناتُ تتجدّد بـ`staleTime` وبالوسوم،
 * ومن شكّ في قِدَم ما يراه أغلق التطبيقَ وفتحه. السحبُ إيماءةُ أندرويد المألوفة لذلك.
 *
 * 🔑 **خطّافٌ واحدٌ لكلِّ الألواح** (لا `RefreshControl` منسوخاً في خمسة ملفّات): يأخذ مفاتيحَ اللوح وحدَه
 * فيعيد جلبَ **ما هو نشطٌ منها** — لوحُ «المسلسلات» لا يجلب صفوفَ «الأفلام». و`refetchQueries` **تقرأ ولا
 * تُبطل**: طبقةُ البيانات (الإبطالُ بالوسوم · كاشُ `me:library`) لا تُمسّ — هذا طلبُ قراءةٍ مبكّر لا قاعدةٌ جديدة.
 * اللونُ لونُ التمييز، والدوّارُ ينزل تحت الرأس المطلق (`offset` = `topPad`) لا خلفه.
 */
export function usePullRefresh(keys: readonly QueryKey[], offset: number) {
  const qc = useQueryClient();
  const { tokens } = useApp();
  const [on, setOn] = useState(false);
  const run = useCallback(async () => {
    setOn(true);
    try {
      await Promise.all(keys.map((queryKey) => qc.refetchQueries({ queryKey, type: "active" })));
    } catch {
      /* فشلُ الجلب تُظهره الشاشةُ بطريقتها — السحبُ لا يضيف خطأً ثانياً */
    } finally {
      setOn(false);
    }
    /* المفاتيحُ مصفوفةٌ يبنيها المنادي كلَّ رسمة؛ هويّتُها نصُّها */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc, JSON.stringify(keys)]);
  return <RefreshControl refreshing={on} onRefresh={() => void run()} tintColor={tokens.accent} colors={[tokens.accent]} progressBackgroundColor={tokens.surface} progressViewOffset={offset} />;
}
