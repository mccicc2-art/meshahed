import { getAmAdmin } from "@/lib/data";
import { NativeLibraryFlag } from "./NativeLibraryFlag";

/**
 * 🆕 **بوّابةُ تجربة «المكتبة أصليّة»** (Phase 11 · B1، D-936 §٢.٢).
 *
 * 🔑 **العلمُ محسوم: `profiles.is_admin`** (صفّان: المالك وKHLD — D-923).
 * لا عمودَ جديداً ولا إعدادَ مستخدم؛ **والشرطُ خادميٌّ لا `hidden` عميليّ**:
 * من ليس إدارةً لا يصله هذا المكوّنُ أصلاً، فلا يرى المختبِرون الاثنا عشر
 * التجربةَ ولا أثرَها في HTML.
 *
 * ⚖️ **ولا يحبس أوّلَ بايت** (D-122): `getAmAdmin` رحلةُ قاعدة، **فالمكوّنُ
 * يُغلَّف بـ`Suspense` في التخطيط** كأخيه `AccountSync` — يصل حين يجهز.
 * **ولا يُركَّب إلا داخل الغلاف** (وسم `LoopzApp/` على الخادم) — فالمتصفّحُ
 * لا يدفع الرحلةَ لعلَمٍ لا معنى له فيه. **و`getAmAdmin` مخبَّأةٌ بـ`cache()`**
 * فصفحةُ الإدارة لا تسأل مرّتين.
 */
export async function NativeLibraryGate() {
  const admin = await getAmAdmin().catch(() => false);
  if (!admin) return null;
  return <NativeLibraryFlag />;
}
