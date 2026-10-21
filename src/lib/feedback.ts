"use server";

import { createClient } from "@/lib/supabase/server";
import { FEEDBACK_MAX, feedbackReady, type FeedbackBody } from "@/core/contracts/feedback";

/**
 * ====== «أرسل مشكلة أو اقتراح» — الخادم (D-1499) ======
 *
 * فعلٌ واحدٌ للويب والتطبيق (المسارُ `/api/v1/feedback` يستدعيه). الكاتبُ والسقفُ يقرّرهما
 * `send_feedback` في القاعدة لا هنا: عدّادُ الذاكرة يخصّ نسخةً واحدةً من Vercel، وصفوفُ الساعة
 * الأخيرة لا تكذب مهما تعدّدت النسخ.
 */
export async function sendFeedback(input: FeedbackBody): Promise<{ ok: true }> {
  const kind = input.kind === "idea" ? "idea" : "bug";
  const platform = input.platform === "android" || input.platform === "ios" ? input.platform : "web";
  const body = String(input.body ?? "").slice(0, FEEDBACK_MAX + 50);
  if (!feedbackReady(body)) throw new Error("مدخل غير صالح — اكتب جملةً قصيرةً على الأقلّ / Write at least a short sentence.");
  const clip = (v: unknown, n: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);

  const supabase = await createClient();
  const { error } = await supabase.rpc("send_feedback", {
    p_kind: kind,
    p_body: body.trim(),
    p_platform: platform,
    /* الويبُ لا يعرف نسختَه في المتصفّح؛ الخادمُ يعرفها (رقمُ «عن Loopz» نفسُه) */
    p_app_version: platform === "web" ? (process.env.VERCEL_GIT_COMMIT_SHA ?? "dev").slice(0, 7) : clip(input.appVersion, 40),
    p_device: clip(input.device, 80),
    p_screen: clip(input.screen, 60),
  });
  if (error) {
    const m = error.message ?? "";
    if (m.includes("feedback_rate_limited")) {
      /* «طلبات كثيرة» حرفاً: `handle` يترجمها إلى `rate_limited` فيقول التطبيقُ جملتَه */
      throw new Error("طلبات كثيرة — أرسلتَ خمساً خلال ساعة، جرّب بعد قليل / Five in an hour — try again later.");
    }
    if (m.includes("not_signed_in")) throw new Error("غير مسجّل الدخول");
    /* الهجرةُ ٢١٦ لم تُشغَّل بعد: يُقال ذلك بدل «تعذّر» صامتة */
    if ((error as { code?: string }).code === "PGRST202" || (error as { code?: string }).code === "42883") {
      throw new Error("الملاحظاتُ غير مفعّلة بعد / Feedback is not enabled yet.");
    }
    console.error("[feedback]", error);
    throw new Error("تعذّر الإرسال، جرّب مرة أخرى / Couldn't send, try again.");
  }
  return { ok: true };
}

export type AdminFeedbackRow = {
  id: string;
  kind: "bug" | "idea";
  body: string;
  platform: string;
  appVersion: string | null;
  device: string | null;
  screen: string | null;
  createdAt: string;
  doneAt: string | null;
  author: string | null;
  username: string | null;
  nickname: string | null;
};

/** صفحةُ الإدارة — `am_admin()` في جسم الدالّة يقرّر، فغيرُ المدير يأخذ صفراً */
export async function getAdminFeedback(state: "open" | "bug" | "idea" | "done"): Promise<AdminFeedbackRow[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_feedback_queue", { p_state: state, lim: 200 });
    if (error || !data) return [];
    return (data as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      kind: r.kind === "idea" ? "idea" : "bug",
      body: String(r.body ?? ""),
      platform: String(r.platform ?? ""),
      appVersion: (r.app_version as string) ?? null,
      device: (r.device as string) ?? null,
      screen: (r.screen as string) ?? null,
      createdAt: String(r.created_at),
      doneAt: (r.done_at as string) ?? null,
      author: (r.author as string) ?? null,
      username: (r.username as string) ?? null,
      nickname: (r.nickname as string) ?? null,
    }));
  } catch {
    return [];
  }
}

/** «تمّت» أو إعادةُ الفتح */
export async function adminFeedbackDone(id: string, done: boolean): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_feedback_done", { p_id: id, p_done: done });
  if (error) throw new Error(error.message);
}
