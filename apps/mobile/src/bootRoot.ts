import { useCallback } from "react";
import { BackHandler } from "react-native";
import { useRouter } from "expo-router";
/* 🆕 K3a-fix — الحالةُ وقواعدُها في `rootsState.ts` (بلا اعتماديّات، مختبَرة في `npm test`) */
import { backFrom, noteBack } from "./rootsState";
export { rootsBorn, rootsMounted, doorLeft, doorBack, doorKept, homeSeen, rootsState, lastBack } from "./rootsState";

/**
 * ====== D-1078 — علامةُ الإقلاع تسافر بين الجذور الأربعة ======
 *
 * 🔑 **المشكلة** (بلاغُ أحمد على 1.11.8): الإقلاعُ الأصليّ (D-1075) يرفع الرئيسيّةَ فوق الـWebView، ورجوعُها
 * يخرج من التطبيق. لكنّ رجوعَ النظام من المكتبة/اكتشف/البحث كان يكشف رئيسيّةَ الويب المحمَّلةَ تحتها صامتةً
 * (مصدرَ الجلسة، D-922)، وهي ليست صفحةً أراد المستخدمُ رؤيتَها.
 *
 * **العلاج**: رجوعُ النظام يتبع عُرفَ أندرويد لشريط التبويبات: من المكتبة/اكتشف/البحث إلى الرئيسيّة، ومن
 * الرئيسيّة خروجٌ من التطبيق (D-1075). **ومن وصل إلى الجذور من الويب** يعود إلى الصفحة التي جاء منها.
 *
 * 🆕 **K3 — العلامةُ حالةُ المجموعة لا معاملٌ في العنوان**: الجذورُ صارت تبويباتٍ ثابتة (`app/(tabs)`) والتبديلُ
 * انتقالٌ لا `replace` يحمل `boot=1`. فالمجموعةُ تُولد إمّا من الإقلاع (`rootsBorn(true)` في `web.tsx`) أو من
 * الويب (`rootsBorn(false)`) — والتبويبُ يرجع إلى الرئيسيّة **إن كان في المجموعة رئيسيّةٌ يرجع إليها** (وُلدت من
 * الإقلاع، أو زارها المستخدمُ فيها): هو ما كان يحدث حين كانت الرئيسيّةُ تدفع المكتبةَ فوقها.
 *
 * ⚠️ **الخروجُ إلى صفحةٍ ويبيّة** (المجتمع، الإعدادات…) لا يتغيّر: `shell.open` ثمّ `back()` — `router.back()` من
 * تبويبٍ ينزع المجموعةَ كلَّها (`backBehavior: "none"`) فيكشف الويبَ الذي صار يعرض الصفحةَ المطلوبة.
 */
export type RootPath = "/home" | "/library" | "/discover" | "/search" | "/community";

export function useBootRoot() {
  const router = useRouter();

  /** تبديلٌ بين الجذور — انتقالٌ إلى تبويبٍ حيّ (K3)، لا هدمٌ ولا بناء */
  const switchTo = useCallback((path: RootPath) => router.navigate(path), [router]);

  /**
   * لرجوع النظام في جذر: الرئيسيّةُ المولودةُ من الإقلاع تخرج، وأخواتُها يرجعن إليها إن وُجدت — ويعيد `true`.
   * وإلّا يعيد `false` فيكمل المستدعي رجوعَه المعتاد إلى الصفحة التي جاء منها.
   */
  const bootBack = useCallback(
    (self: RootPath) => {
      const d = backFrom(self);
      noteBack(self, d);
      if (d === "pass") return false;
      if (d === "exit") BackHandler.exitApp();
      else router.navigate("/home");
      return true;
    },
    [router],
  );

  return { switchTo, bootBack };
}
