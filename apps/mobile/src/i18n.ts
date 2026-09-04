import { getLocales } from "expo-localization";
import { I18nManager } from "react-native";
import { getDict, normalizeLocale, isRtl, type Dict, type Locale } from "@/core/i18n";

/**
 * ====== اللغةُ — من الجهاز، والقاموسُ من النواة ======
 *
 * 🔑 **القاموسُ نفسُه** (`core/i18n.ts`، ~٤٠٠٠ سطر): نصٌّ يُصحَّح في الويب
 * يُصحَّح هنا في الدفعة نفسِها. **ومفاتيحُ أخطاء الـAPI (`api…`) تُترجم به
 * أيضاً** — الخادمُ أعاد المفتاحَ، وهنا يُقال بلغة الجهاز.
 *
 * ⚠️ **RTL يُفرض عند الإقلاع ويحتاج إعادةَ تشغيلٍ حين تتبدّل اللغة** — قيدُ
 * React Native لا قرارُنا؛ الإعداداتُ تشرح ذلك للمستخدم حين يبدّل.
 */
export function deviceLocale(): Locale {
  const code = getLocales()[0]?.languageCode ?? "ar";
  return normalizeLocale(code);
}

export function applyDirection(locale: Locale) {
  const rtl = isRtl(locale);
  if (I18nManager.isRTL !== rtl) {
    I18nManager.allowRTL(rtl);
    I18nManager.forceRTL(rtl);
  }
}

export function dictFor(locale: Locale): Dict {
  return getDict(locale);
}
