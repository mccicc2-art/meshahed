/**
 * ====== شكلُ النتيجة والخطأ — واحدٌ للمنصّتين (Phase 9 §4.3 القاعدة ٥) ======
 *
 * 🔑 **ولمَ `message_key` لا `message`؟** لأنّ الخادمَ لا يعرف لغةَ من يقرأ.
 * اليومَ يعرفها (الكوكي)، **وغداً يأتي الطلبُ من تطبيقٍ لغتُه في الجهاز** —
 * **فالخادمُ يقول «أيُّ خطأٍ وقع» والواجهةُ تقول «كيف يُقال بالعربية».**
 * والمفتاحُ من نفس قاموس `i18n` المشترك، فلا جدولَ ترجمةٍ ثانٍ يشيخ.
 *
 * ⚠️ **ولا `throw` عبر الحدّ**: الاستثناءُ يعبر داخلَ العمليّة، أمّا ما يخرج
 * من `core` فنتيجةٌ صريحةٌ — **لأنّ غلافَ الـAPI يجب أن يختار رمزَ HTTP،
 * ولا يُختار من نصِّ رسالةٍ إنجليزيّة.**
 */

import type { Tag } from "./tags.ts";

export type ErrorCode =
  /** لا جلسةَ أصلاً — الويب يحوّل إلى الدخول، والتطبيق يفتح بوّابته. */
  | "unauthenticated"
  /** جلسةٌ قائمةٌ لكنّها لا تملك هذا — ملفٌّ خاصّ، قائمةُ غيرِك، إجراءٌ إداريّ. */
  | "forbidden"
  | "not_found"
  /** إدخالٌ لم يجتزْ `validate.ts` — الحقلُ المخالف في `field`. */
  | "invalid_input"
  /** تجاوزُ حدِّ المعدّل (`ratelimit.ts`) — `retry_after_ms` حين تُعرف. */
  | "rate_limited"
  /** تعارضُ حالة: تكرارُ اسم، طلبُ متابعةٍ قائم، قيدُ قاعدة. */
  | "conflict"
  /** خطأُ مزوّدٍ خارجيّ (TMDB/OMDb) — يُميَّز لأنّه يستحقّ إعادةَ محاولةٍ لا بلاغاً. */
  | "upstream"
  | "internal";

export type AppError = {
  code: ErrorCode;
  /** مفتاحُ i18n — لا نصٌّ مترجَم. */
  message_key: string;
  /** اسمُ الحقل حين يكون الخطأ في إدخالٍ بعينه. */
  field?: string;
  retry_after_ms?: number;
};

export type Ok<T> = { ok: true; data: T; invalidates: Tag[] };
export type Err = { ok: false; error: AppError };
export type Result<T> = Ok<T> | Err;

/** **الوسومُ إلزاميّةٌ في نجاح الكتابة وفارغةٌ في القراءة** — لا سهوَ صامت. */
export const ok = <T>(data: T, invalidates: Tag[] = []): Ok<T> => ({
  ok: true,
  data,
  invalidates,
});

export const err = (
  code: ErrorCode,
  message_key: string,
  extra?: Omit<AppError, "code" | "message_key">,
): Err => ({ ok: false, error: { code, message_key, ...extra } });

/**
 * رمزُ HTTP لكلِّ صنفِ خطأ — **يسكن هنا لا في كلِّ مسار**، فلا يفترق
 * مسارٌ عن مسارٍ في وصف الحالة نفسِها.
 */
export const httpStatus: Record<ErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  invalid_input: 422,
  rate_limited: 429,
  conflict: 409,
  upstream: 502,
  internal: 500,
};
