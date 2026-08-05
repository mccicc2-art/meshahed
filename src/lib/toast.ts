"use client";

/**
 * ناقل الرسائل العابرة.
 *
 * كان في التطبيق نظاما توست: واحدٌ عامّ للأخطاء في الـlayout، وآخران
 * محلّيان داخل ملفٍ واحد (تراجع ونسخ رابط) بشكلين ولونين مختلفين — ومن
 * لا يملك واحداً منهما (إجراءات المكتبة السريعة) كان يبتلع نتيجته بصمت.
 * مضيفٌ واحد في الـlayout، ودالةٌ واحدة تصله بحدث نافذة: بلا مكتبة ولا
 * سياق React مشترك، فتعمل من أي مكوّن مهما عمق موضعه في الشجرة.
 *
 * `run` تُمرَّر كما هي داخل الحدث لأن المرسل والمستقبل في نفس سياق
 * الجافاسكربت — لا تسلسل ولا تحويل.
 */

export type ToastTone = "error" | "success" | "info";

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface ToastPayload {
  message: string;
  tone: ToastTone;
  duration: number;
  action?: ToastAction;
}

export const TOAST_EVENT = "loopz:toast";

export function toast(
  message: string,
  opts: { tone?: ToastTone; action?: ToastAction; duration?: number } = {},
) {
  const tone = opts.tone ?? "success";
  // الرسالة ذات الفعل تبقى أطول: الفعل لا يُقرأ ويُنقر في ثانيتين
  const duration = opts.duration ?? (opts.action ? 6000 : tone === "error" ? 3500 : 2400);
  try {
    window.dispatchEvent(
      new CustomEvent<ToastPayload>(TOAST_EVENT, {
        detail: { message, tone, duration, action: opts.action },
      }),
    );
  } catch {
    /* لا شيء — الرسالة تحسينٌ لا التزام */
  }
}

/** اختصار الخطأ — أكثر الاستعمالات شيوعاً */
export function flashError(message: string) {
  toast(message, { tone: "error" });
}
