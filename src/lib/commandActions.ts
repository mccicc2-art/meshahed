"use server";

import { redirect } from "next/navigation";
import { getAmAdmin, getUser } from "@/lib/data";
import { COMMAND_APPROVERS, commandApproveRelease, commandDecide, commandRequestControl } from "@/lib/command";

/**
 * ====== أفعالُ غرفة القيادة — كلُّها تسجيلُ قرارٍ لا تنفيذ ======
 *
 * قرارُ أحمد «٢أ» (٢٧ نوفمبر ٢٠٢٦): زرُّ الإدارة **يسجّل الموافقة فقط**؛ التنفيذُ
 * والرفعُ يقعان في محادثةٍ تقرأ الموافقات («نفّذ الموافَق عليه»). فلا فعلَ هنا
 * يبني كوداً أو يرفع أو يغيّر مهمّةً مجدولة — بل صفٌّ في سجلّ المعاينة يقرؤه
 * المجلسُ والمحادثات.
 *
 * **ومن يقرّر**: أحمد وخالد وحدهما («٣أ»)، بالمعرّف لا بالاسم، وبعد التحقّق أنّ
 * الحسابَ مديرٌ أصلاً. **والسببُ إلزاميّ** (≥ ثلاثة أحرف) — يبطّئ الضغطةَ ويصير
 * سطرَ التاريخ في البند.
 */

async function approver(): Promise<{ id: string; name: string }> {
  const [user, admin] = await Promise.all([getUser(), getAmAdmin()]);
  const name = user ? COMMAND_APPROVERS[user.id] : undefined;
  if (!user || !admin || !name) throw new Error("not_approver");
  return { id: user.id, name };
}

function reasonOf(formData: FormData): string {
  const r = String(formData.get("reason") ?? "").trim();
  if (r.length < 3) throw new Error("reason_required");
  return r.slice(0, 500);
}

function back(formData: FormData): string {
  const to = String(formData.get("back") ?? "/admin/command");
  /* لا نعيد التوجيه إلا داخل الإدارة — قيمةٌ من النموذج لا يُوثق بها */
  return to.startsWith("/admin/") && !to.startsWith("//") ? to.split("?")[0] : "/admin/command";
}

const DECISIONS = ["approve", "accept", "defer", "reject"] as const;

export async function decideItemAction(formData: FormData) {
  const to = back(formData);
  try {
    const who = await approver();
    const item = String(formData.get("item") ?? "");
    const decision = String(formData.get("decision") ?? "") as (typeof DECISIONS)[number];
    if (!/^[A-Z]{1,3}-\d{1,4}$/.test(item) || !DECISIONS.includes(decision)) throw new Error("bad_decision");
    await commandDecide(item, decision, who.name, who.id, reasonOf(formData));
  } catch (e) {
    redirect(`${to}?err=${encodeURIComponent((e as Error).message.slice(0, 140))}`);
  }
  redirect(`${to}?ok=decided`);
}

export async function approveReleaseAction(formData: FormData) {
  const to = back(formData);
  try {
    const who = await approver();
    const ids = String(formData.get("tasks") ?? "")
      .split(",")
      .map((s) => Number(s))
      .filter((n) => Number.isInteger(n) && n > 0)
      .slice(0, 50);
    if (ids.length === 0) throw new Error("bad_decision");
    await commandApproveRelease(ids, who.name, who.id, reasonOf(formData));
  } catch (e) {
    redirect(`${to}?err=${encodeURIComponent((e as Error).message.slice(0, 140))}`);
  }
  redirect(`${to}?ok=release`);
}

export async function controlAgentAction(formData: FormData) {
  const to = back(formData);
  try {
    const who = await approver();
    const agent = String(formData.get("agent") ?? "");
    const action = String(formData.get("action") ?? "");
    if (!/^[a-z_]{2,40}$/.test(agent) || !["pause", "resume", "run_now"].includes(action)) throw new Error("bad_decision");
    await commandRequestControl(agent, action as "pause" | "resume" | "run_now", who.name, who.id, reasonOf(formData));
  } catch (e) {
    redirect(`${to}?err=${encodeURIComponent((e as Error).message.slice(0, 140))}`);
  }
  redirect(`${to}?ok=control`);
}
