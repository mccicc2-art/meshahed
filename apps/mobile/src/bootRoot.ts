import { useCallback } from "react";
import { BackHandler } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

/**
 * ====== D-1078 — علامةُ الإقلاع تسافر بين الجذور الأربعة ======
 *
 * 🔑 **المشكلة** (بلاغُ أحمد على 1.11.8): الإقلاعُ الأصليّ (D-1075) يرفع `/home?boot=1` فوق
 * الـWebView، ورجوعُها يخرج من التطبيق. لكنّ التبديلَ إلى المكتبة/اكتشف/البحث `replace` بلا
 * العلامة — فرجوعُ النظام من هناك كان `router.back()` يكشف رئيسيّةَ الويب المحمَّلةَ تحتها
 * صامتةً (مصدرَ الجلسة، D-922)، وهي ليست صفحةً أراد المستخدمُ رؤيتَها.
 *
 * **العلاج**: الجذرُ الذي وُلد من الإقلاع يمرّر العلامةَ لأخيه في كلِّ تبديل، ورجوعُ النظام فيه
 * يتبع عُرفَ أندرويد لشريط التبويبات: من المكتبة/اكتشف/البحث إلى الرئيسيّة، ومن الرئيسيّة خروجٌ
 * من التطبيق (D-1075). فلا يخرج المستخدمُ فجأةً من تبويبٍ ظنّ أنّ خلفَه الرئيسيّة. **ومن وصل إلى الجذر من
 * الويب** (بلا علامة) يبقى سلوكُه كما هو: الرجوعُ إلى الصفحة التي جاء منها.
 *
 * ⚠️ **الخروجُ إلى صفحةٍ ويبيّة** (المجتمع، الإعدادات…) لا يتغيّر: `shell.open` ثمّ `back()`
 * — هناك كشفُ الويب هو المقصود لأنّه صار يعرض الصفحةَ المطلوبة.
 */
export type RootPath = "/home" | "/library" | "/discover" | "/search";

export function useBootRoot() {
  const router = useRouter();
  const { boot } = useLocalSearchParams<{ boot?: string }>();
  const isBoot = boot === "1";

  /** تبديلٌ بين الجذور — `replace` دائماً (D-1074)، والعلامةُ معه إن وُلد الجذرُ من الإقلاع */
  const switchTo = useCallback(
    (path: RootPath) => {
      if (isBoot) router.replace({ pathname: path, params: { boot: "1" } });
      else router.replace(path);
    },
    [router, isBoot],
  );

  /**
   * لرجوع النظام في جذرٍ من الإقلاع: الرئيسيّةُ تخرج، وأخواتُها يبدّلن إليها — ويعيد `true`.
   * وجذرٌ بلا علامة يعيد `false` فيكمل المستدعي رجوعَه المعتاد إلى الصفحة التي جاء منها.
   */
  const bootBack = useCallback(
    (self: RootPath) => {
      if (!isBoot) return false;
      if (self === "/home") BackHandler.exitApp();
      else router.replace({ pathname: "/home", params: { boot: "1" } });
      return true;
    },
    [router, isBoot],
  );

  return { isBoot, switchTo, bootBack };
}
