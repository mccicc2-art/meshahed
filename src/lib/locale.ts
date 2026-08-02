import { cookies } from "next/headers";
import { LOCALE_COOKIE, normalizeLocale, getDict, type Locale, type Dict } from "@/lib/i18n";

export async function getLocale(): Promise<Locale> {
  try {
    const store = await cookies();
    return normalizeLocale(store.get(LOCALE_COOKIE)?.value);
  } catch {
    return "ar";
  }
}

export async function getT(): Promise<{ locale: Locale; t: Dict }> {
  const locale = await getLocale();
  return { locale, t: getDict(locale) };
}
