/**
 * ====== «أرسل مشكلة أو اقتراح» — العقد (D-1499) ======
 *
 * جسمٌ واحدٌ للتطبيق (`POST /api/v1/feedback`) وللويب (`sendFeedback`): النوعُ والنصّ،
 * ومعهما ما يعيد المشكلةَ دون أن يكتبه أحد — المنصّةُ والنسخةُ والجهازُ والشاشة.
 * الحدودُ نفسُها في القاعدة (216_feedback.sql)؛ وهنا لتُقال في الواجهة قبل الرحلة.
 */
export type FeedbackKind = "bug" | "idea";
export type FeedbackPlatform = "android" | "ios" | "web";

export const FEEDBACK_MIN = 3;
export const FEEDBACK_MAX = 1000;

export type FeedbackBody = {
  kind: FeedbackKind;
  body: string;
  platform: FeedbackPlatform;
  appVersion?: string | null;
  device?: string | null;
  screen?: string | null;
};

/** النصُّ صالحٌ للإرسال؟ — الزرُّ يبهت بهذه الدالّة نفسِها في المنصّتين */
export function feedbackReady(body: string): boolean {
  const n = body.trim().length;
  return n >= FEEDBACK_MIN && n <= FEEDBACK_MAX;
}
