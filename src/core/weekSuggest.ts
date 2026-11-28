/**
 * 🆕 T606 — **ما يظهر في «أسبوعك» حين يفرغ** (استوديو س٤٢ «ب»: «مع إمكانية تحديد ما يظهر في أسبوعك بعد فتحه»).
 * يُحفظ في `profiles.ui_state.week` — عمودٌ بلا قيدِ شكلٍ عمداً (D-475) فلا هجرة. المصدران مفتوحان حتى يُطفئهما صاحبُهما.
 * في `core` لأنّ التطبيقَ يقرؤه ويكتبه، والخادمُ يطهّره بالدالّة نفسِها.
 */
export type WeekSuggestPrefs = { cinema: boolean; taste: boolean };

export const WEEK_SUGGEST_DEFAULT: WeekSuggestPrefs = { cinema: true, taste: true };

export function sanitizeWeekSuggest(v: unknown): WeekSuggestPrefs {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  return {
    cinema: typeof o.cinema === "boolean" ? o.cinema : WEEK_SUGGEST_DEFAULT.cinema,
    taste: typeof o.taste === "boolean" ? o.taste : WEEK_SUGGEST_DEFAULT.taste,
  };
}
