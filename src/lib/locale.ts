import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, normalizeLocale, getDict, type Locale, type Dict } from "@/lib/i18n";

export async function getLocale(): Promise<Locale> {
  try {
    const store = await cookies();
    const saved = store.get(LOCALE_COOKIE)?.value;
    if (saved) return normalizeLocale(saved);

    // زائرٌ جديد بلا اختيار محفوظ: لغة جهازه هي لغته الافتراضية —
    // أول وسمٍ في Accept-Language يحسم، والعربية للبقية
    const accept = (await headers()).get("accept-language") ?? "";
    const first = accept.split(",")[0]?.trim().toLowerCase() ?? "";
    return first.startsWith("en") ? "en" : "ar";
  } catch {
    return "ar";
  }
}

export async function getT(): Promise<{ locale: Locale; t: Dict }> {
  const locale = await getLocale();
  return { locale, t: getDict(locale) };
}
