import Constants from "expo-constants";

/**
 * ====== إعداداتُ التطبيق — من `app.json` لا من ملفِّ بيئة ======
 *
 * 🔑 **لا سرَّ هنا ولا في التطبيق كلِّه**: `supabasePublishableKey` مفتاحٌ
 * قابلٌ للنشر بتعريف Supabase (يشحن في كلِّ حزمةِ ويب أصلاً)، وعنوانُ الـAPI
 * عامّ. **مفاتيحُ TMDB وOMDb وغيرُها لا تغادر الخادم** (Phase 9 §4.3) —
 * التطبيقُ لا يعرف اسمَها حتى.
 */
type Extra = {
  apiBase: string;
  supabaseUrl: string;
  supabasePublishableKey: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Partial<Extra>;

export const CONFIG: Extra = {
  apiBase: extra.apiBase ?? "https://loopztv.com",
  supabaseUrl: extra.supabaseUrl ?? "",
  supabasePublishableKey: extra.supabasePublishableKey ?? "",
};
