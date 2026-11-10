import * as SecureStore from "expo-secure-store";
import { cleanInviteCode } from "@/core/storeLinks";

/**
 * ====== 🆕 كودُ الدعوة المعلَّق (المهمة ٣٧٠ — قرارُ أحمد ١٠ نوفمبر «1ب … نفذ أ») ======
 *
 * زرُّ «افتح الدعوة في التطبيق» في صفحة الويب (`/invite/<code>`) يفتح التطبيقَ بـ`com.loopztv.app://join/<CODE>` —
 * غالباً **قبل الدخول**، ومن قد لا يُكمل الترحيبَ اليومَ نفسَه. فالكودُ يُحفظ في الجهاز حتّى يقرأه الترحيب («هل دعاك أحمد؟»)،
 * ثمّ يُمسح بعد الجواب نعم أو لا.
 * ⚖️ **سبعةُ أيّامٍ ثمّ يُنسى**: الخادمُ لا يقبل النسبةَ لحسابٍ عمرُه فوق ٤٨ ساعة أصلاً، وكودٌ قديمٌ في جهازٍ تبدّل صاحبُه لا
 * يُعرض على غيره. ومَن يسمع التغيّرَ (الترحيبُ مفتوحٌ لحظةَ وصول الرابط) يُبلَّغ فوراً.
 * 🆕 **ومصدرٌ ثانٍ للكود نفسِه مع البناء الأصليّ القادم**: مصدرُ التثبيت من Google Play على أندرويد (`NATIVE-BUILD-LIST`) يكتب هنا.
 */
const KEY = "loopz.invite.pending";
const TTL_MS = 7 * 24 * 3600_000;

const listeners = new Set<() => void>();

export const pendingInvite = {
  async get(): Promise<string | null> {
    try {
      const raw = await SecureStore.getItemAsync(KEY);
      if (!raw) return null;
      const [code, at] = raw.split("|");
      if (!code || !Number.isFinite(Number(at)) || Date.now() - Number(at) > TTL_MS) {
        await SecureStore.deleteItemAsync(KEY);
        return null;
      }
      return code;
    } catch {
      return null;
    }
  },
  async set(raw: unknown): Promise<void> {
    const code = cleanInviteCode(raw);
    if (!code) return;
    try {
      await SecureStore.setItemAsync(KEY, `${code}|${Date.now()}`);
    } catch {
      /* الجهازُ رفض الحفظ — يبقى البحثُ بالاسم */
    }
    listeners.forEach((l) => l());
  },
  async clear(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(KEY);
    } catch {
      /* لا شيء */
    }
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

/** `com.loopztv.app://join/<CODE>` بأيِّ شكلٍ يصل به إلى `+native-intent` — الكودُ أو `null` */
const JOIN_LINK = /^(?:com\.loopztv\.app:\/\/|\/)?join\/([A-Za-z0-9]{1,10})\/?(?:[?#].*)?$/i;
export function inviteCodeOf(path: string): string | null {
  const m = JOIN_LINK.exec(path);
  return m ? cleanInviteCode(m[1]) || null : null;
}
