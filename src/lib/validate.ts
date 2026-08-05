import type { MediaType } from "@/lib/media";

/**
 * تحقّقٌ من مدخلات أفعال الخادم.
 *
 * لماذا: Server Actions نقاط نهاية HTTP عامة — أنواع TypeScript تُفحص
 * وقت الترجمة فقط، وأي عميل يستطيع إرسال نصٍّ مكان الرقم. أخطرها
 * معرّف TMDB: يُركَّب في مسار طلبٍ خارجي (`/tv/${id}`)، فنصٌّ مثل
 * `../account?x=` يغيّر وجهة الطلب كلها. كل فعلٍ يُنقّي مدخلاته هنا
 * قبل أن تلمس قاعدة البيانات أو الشبكة.
 */

/** معرّف صحيح موجب (TMDB وأشباهه) — يرفض أي شيء سواه */
export function intId(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isSafeInteger(n) || n <= 0 || n > 2_147_483_647) {
    throw new Error("مدخل غير صالح / Invalid input");
  }
  return n;
}

/** عدد صحيح داخل مدى — للمواسم والحلقات ومدد التشغيل */
export function intIn(v: unknown, min: number, max: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isSafeInteger(n) || n < min || n > max) {
    throw new Error("مدخل غير صالح / Invalid input");
  }
  return n;
}

/** نوع العمل: قيمتان لا ثالثة لهما */
export function asMediaType(v: unknown): MediaType {
  if (v === "tv" || v === "movie") return v;
  throw new Error("مدخل غير صالح / Invalid input");
}

/** معرّف مستخدم UUID — يرفض أي نصٍّ آخر قبل أن يبلغ الاستعلام */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function uuid(v: unknown): string {
  if (typeof v === "string" && UUID_RE.test(v)) return v.toLowerCase();
  throw new Error("مدخل غير صالح / Invalid input");
}

/** تاريخ YYYY-MM-DD أو لا شيء — لتواريخ العرض المُخزَّنة */
export function dateOrNull(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return null;
}
