import { getLocales } from "expo-localization";
import { I18nManager } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Updates from "expo-updates";
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
 *
 * 🆕 **لغةُ الويب تغلب لغةَ الجهاز** (D-946، بلاغُ أحمد: «المكتبةُ بالعربيّة
 * والتطبيقُ عندي بالإنجليزيّة»): المستخدمُ اختار لغتَه في الويب (كوكي
 * `lang`)، **والشاشةُ الأصليّةُ جزءٌ من المنتج نفسِه لا تطبيقٌ ثانٍ** — فتقرأ
 * ما اختاره لا ما ضبطه نظامُ الهاتف. الصفحةُ ترسل `locale` عبر الجسر عند
 * التحميل وعند كلِّ تبديل، **والغلافُ يحفظه** (SecureStore — سطرٌ واحدٌ
 * `ar`/`en`، ليس سرّاً لكنّ المخزنَ موجودٌ أصلاً بلا تبعيّةٍ جديدة) **ليقرأه
 * الإقلاعُ التالي تزامنيّاً** فيفرض الاتّجاهَ الصحيح. النصوصُ تتبدّل فوراً،
 * **والاتّجاهُ في الإقلاع التالي** — قيدُ RN أعلاه بعينه.
 */
export function deviceLocale(): Locale {
  const code = getLocales()[0]?.languageCode ?? "ar";
  return normalizeLocale(code);
}

const WEB_LOCALE_KEY = "loopz.web.locale";
let webLocaleValue: Locale | null = (() => {
  try {
    const v = SecureStore.getItem(WEB_LOCALE_KEY);
    return v === "ar" || v === "en" ? v : null;
  } catch {
    return null;
  }
})();
const webLocaleListeners = new Set<() => void>();

/** لغةُ الويب كما بلّغتها الصفحةُ — `null` قبل أوّل بلاغ */
export const webLocale = {
  get(): Locale | null {
    return webLocaleValue;
  },
  /** يقبل `ar`/`en` فقط — الرسالةُ تأتي من الجسر، والقيمةُ تُفحص لا تُصدَّق */
  set(v: unknown) {
    if (v !== "ar" && v !== "en") return;
    if (v === webLocaleValue) return;
    webLocaleValue = v;
    for (const l of webLocaleListeners) l();
    SecureStore.setItemAsync(WEB_LOCALE_KEY, v)
      .catch(() => {})
      .then(() => {
        /* 1.11.7 — قلبُ الاتّجاه لا ينتظر الإقلاعَ التالي (كان قيدَ D-946): `forceRTL` لا يعمل إلّا بعد إعادة
           تحميل JS، فنعيد تحميله نحن بعد حفظ اللغة (ليقرأها الإقلاعُ تزامنيّاً). الويبُ يعيد تحميلَ صفحته عند تبديل
           اللغة أصلاً — فإعادةٌ واحدةٌ أهونُ من شاشاتٍ أصليّةٍ مقلوبةٍ حتى يُغلق التطبيق. الفشلُ صمت (بيئةُ التطوير) */
        if (I18nManager.isRTL === isRtl(v)) return;
        applyDirection(v);
        return Updates.reloadAsync().catch(() => {});
      })
      .catch(() => {});
  },
  subscribe(l: () => void): () => void {
    webLocaleListeners.add(l);
    return () => webLocaleListeners.delete(l);
  },
};

/** اللغةُ الفعليّة: ما اختاره المستخدمُ في الويب، وإلّا لغةُ الجهاز */
export function currentLocale(): Locale {
  return webLocaleValue ?? deviceLocale();
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
