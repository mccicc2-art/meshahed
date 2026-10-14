import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

/** أطولُ طرفٍ للصورة المرفوعة — `UPLOAD_MAX_EDGE` في الويب (`lib/imageFile.ts`) */
export const UPLOAD_MAX_EDGE = 1920;

/**
 * تصغيرُ صورةٍ اختيرت قبل رفعها — **واحدٌ لكلِّ رفعٍ في التطبيق** (ردُّ النقاش في `Composer`، ورسالةُ المحادثة 🆕 D-1387).
 *
 * 🔑 الأبعادُ من الصورة المرسومة لا من المنتقي (M3-fix): منتقي أندرويد قد يعيد `width/height` صفراً، فتُرفع الصورةُ بحجمها
 * الأصليّ (١٢–٥٠ ميجابكسل) فيتجاوز حدَّ الخادم أو حدَّ المنصّة (٤٫٥) فيعود جوابٌ ليس JSON. يعيد مسارَ JPEG محلّيّاً.
 */
export async function shrinkForUpload(uri: string): Promise<string> {
  const raw = await ImageManipulator.manipulate(uri).renderAsync();
  const long = Math.max(raw.width, raw.height);
  const ctx = ImageManipulator.manipulate(raw);
  if (long > UPLOAD_MAX_EDGE) ctx.resize(raw.width >= raw.height ? { width: UPLOAD_MAX_EDGE } : { height: UPLOAD_MAX_EDGE });
  const img = await (await ctx.renderAsync()).saveAsync({ compress: 0.82, format: SaveFormat.JPEG });
  return img.uri;
}
