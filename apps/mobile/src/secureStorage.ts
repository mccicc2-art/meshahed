import * as SecureStore from "expo-secure-store";

/**
 * ====== مخزنُ الجلسة — SecureStore مُقطَّعاً ======
 *
 * 🔑 **لماذا مُقطَّع؟** لأنّ SecureStore على أندرويد يحدّ القيمةَ بنحو ٢٠٤٨
 * بايت، **وجلسةُ Supabase (رمزان + بياناتُ المستخدم) تتجاوزها بسهولة** —
 * فتُحفظ ناقصةً بصمت ويصير الدخولُ يضيع عند كلِّ فتح. القطعُ ثابتُ الحجم
 * ومُرقَّم، والقراءةُ تجمعه حتى أوّلِ قطعةٍ غائبة.
 *
 * ⚠️ **الجلسةُ في SecureStore لا AsyncStorage**: رمزُ التجديد يعيش شهوراً —
 * **وهو الفرقُ بين «فتحتُ الجهاز» و«فتحتُ حسابَك».**
 */
const CHUNK = 1800;
const countKey = (k: string) => `${k}__n`;
const partKey = (k: string, i: number) => `${k}__${i}`;

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const n = Number((await SecureStore.getItemAsync(countKey(key))) ?? 0);
    if (!n) return null;
    let out = "";
    for (let i = 0; i < n; i++) {
      const part = await SecureStore.getItemAsync(partKey(key, i));
      if (part == null) return null; // قطعةٌ غائبة = جلسةٌ تالفة، خيرٌ من جلسةٍ مبتورة
      out += part;
    }
    return out;
  },
  async setItem(key: string, value: string): Promise<void> {
    const prev = Number((await SecureStore.getItemAsync(countKey(key))) ?? 0);
    const parts: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK) parts.push(value.slice(i, i + CHUNK));
    for (let i = 0; i < parts.length; i++) await SecureStore.setItemAsync(partKey(key, i), parts[i]);
    await SecureStore.setItemAsync(countKey(key), String(parts.length));
    for (let i = parts.length; i < prev; i++) await SecureStore.deleteItemAsync(partKey(key, i));
  },
  async removeItem(key: string): Promise<void> {
    const n = Number((await SecureStore.getItemAsync(countKey(key))) ?? 0);
    for (let i = 0; i < n; i++) await SecureStore.deleteItemAsync(partKey(key, i));
    await SecureStore.deleteItemAsync(countKey(key));
  },
};
