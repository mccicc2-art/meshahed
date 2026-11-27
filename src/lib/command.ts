import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { tracedFetch } from "@/lib/reqTrace";

/**
 * ====== غرفة القيادة — قارئُ سجلّ الوكلاء (أحمد ٢٧ نوفمبر ٢٠٢٦: «كل شي يظهر في لوبز ادمن») ======
 *
 * **لماذا مشروعٌ ثانٍ لا الإنتاج**: قرارُ أحمد «١أ» — سجلُّ الوكلاء وتقاريرُهم
 * يعيشان في مشروع المعاينة بعيداً عن بيانات المستخدمين، كسجلّ الحجز تماماً
 * (قرار ١١ أكتوبر). فالقراءةُ هنا بمفتاح خدمة المعاينة وحده، ولا يلمس هذا
 * الملفُّ قاعدةَ الإنتاج.
 *
 * **لماذا أغلفةُ `cmd_*` لا الجداول**: الجداولُ في مخطّط `command` محميّةٌ من
 * الكتابة المباشرة، وPostgREST لا يعرض إلا `public`؛ فالأغلفةُ (لـservice_role
 * وحده) هي البابُ الوحيد — وهي التي تفرض السببَ الإلزاميّ وتسجّل كلَّ قرار.
 *
 * 🔒 **المفتاحُ يُقرأ هنا وحده** (سياجٌ في `eslint.config.mjs` كسياج D-898).
 * وغيابُه لا يكسر شيئاً: كلُّ قارئٍ يعيد `null` فتقول الصفحةُ «غير متاح» بدل خطأ.
 */

/** عنوانُ مشروع المعاينة `loopz-preview` — ليس سرّاً (السرُّ المفتاح). */
const PREVIEW_URL = "https://zzrbebfuzfimrrutefeg.supabase.co";

let client: SupabaseClient | null = null;

function preview(): SupabaseClient | null {
  const key = process.env.LOOPZ_PREVIEW_SERVICE_ROLE_KEY;
  if (!key) return null;
  client ??= createClient(PREVIEW_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    /* مهلةٌ قصيرة: لوحةٌ تنتظر مشروعاً ثانياً لا يجوز أن تعلّق صفحات الإدارة كلّها */
    global: { fetch: (input, init) => tracedFetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(8000) }) },
  });
  return client;
}

/**
 * **من يوافق** (قرار أحمد «٢أ» و«٣أ»: «احمد و خالد»): الحسابان وحدهما يقرّران
 * في البنود ويوافقان على الرفع — لا كلُّ مدير. المعرّفُ هو الحَكَم لا الاسم.
 */
export const COMMAND_APPROVERS: Record<string, string> = {
  "2fc8b1ec-1c6f-4e87-99aa-f61d894c30d3": "أحمد",
  "e7a9b263-2905-48ee-a052-e502c87f5b66": "خالد",
};

export type RunStatus = "ok" | "warn" | "critical" | "failed" | "skipped";

export interface CommandAgent {
  key: string;
  name: string;
  department: "ops" | "security" | "execution" | "product" | "market" | "strategy" | "content" | "review";
  schedule: string | null;
  paused: boolean;
  paused_reason: string | null;
  next_run_at?: string | null;
  last_run: { id: number; started_at: string; finished_at: string | null; status: RunStatus; summary: string } | null;
  pending_control: number;
}

export interface CommandItem {
  id: string;
  source: string;
  severity: "critical" | "high" | "medium" | "low";
  area: string | null;
  title: string;
  proposal: string | null;
  kind: "code" | "sql" | "decision" | "ops" | "product";
  status: "open" | "approved" | "in_queue" | "deferred";
  task_id: number | null;
  age_days: number;
}

export interface CommandBoard {
  generated_at: string;
  agents: CommandAgent[];
  items_open: CommandItem[];
  approvals_pending: { id: number; item: string; decision: string; by: string; at: string }[];
  /** موافقاتُ رفعٍ لم تستهلكها محادثةُ «ارفع» بعد (الهجرة ٠٢) */
  releases_pending?: { id: number; tasks: number[]; by: string; at: string }[];
  /** آخرُ لقطةٍ لنبض المنتج يكتبها المجلسُ يوميّاً ومحلّلُ المنتج أسبوعيّاً في `runs.metrics.kpi` */
  kpi?: { measured_at: string; d1_return_pct: number; d1_target_pct: number; active_yesterday: number; active_7d: number } | null;
}

export interface CommandRun {
  id: number;
  agent_key: string;
  started_at: string;
  finished_at: string | null;
  status: RunStatus;
  summary_ar: string;
  report_md: string | null;
  metrics?: { product?: ProductMetrics; scorecard?: unknown; kpi?: unknown } | null;
}

/**
 * 🆕 **ما يكتبه محلّلُ المنتج أسبوعيّاً في `runs.metrics.product`** (مهمّة ٥٩٧) — شكلٌ ثابتٌ
 * مكتوبٌ في تعليماته حرفاً، لأنّ الصفحة ترسمه كما هو: **الوكيلُ يقيس، والصفحةُ لا تحسب شيئاً.**
 * وكلُّ حقلٍ اختياريّ: تقريرٌ ناقصٌ يرسم ما فيه ويقول «لا قياس» لما ليس فيه.
 */
export interface ProductMetrics {
  scorecard?: {
    key: string;
    label: string;
    value: number | null;
    unit?: "%" | "";
    target: number | null;
    status: "on_track" | "behind" | "stalled" | "no_target";
  }[];
  funnel?: {
    cohort_n: number;
    from_days: number;
    to_days: number;
    steps: { label: string; n: number; split?: { returned_pct: number; others_pct: number; n: number; returned_n: number } }[];
  };
}

export interface QueuedTask {
  task_id: number;
  description: string;
  agent: string;
  native_build: boolean;
  queued_at: string;
}

export async function getCommandBoard(): Promise<CommandBoard | null> {
  const db = preview();
  if (!db) return null;
  const { data, error } = await db.rpc("cmd_board");
  if (error || !data) return null;
  return data as CommandBoard;
}

export async function getCommandRuns(agent: string, limit = 20): Promise<CommandRun[]> {
  const db = preview();
  if (!db) return [];
  const { data, error } = await db.rpc("cmd_runs", { p_agent: agent, p_limit: limit });
  if (error || !Array.isArray(data)) return [];
  return data as CommandRun[];
}

/** آخرُ تشغيلٍ لوكيلٍ بعينه — تقريرُ الأسبوع أو لقطةُ المؤشّرات؛ `null` إن لم يعمل بعد */
export async function getLatestRun(agent: string): Promise<CommandRun | null> {
  const runs = await getCommandRuns(agent, 5);
  return runs.find((r) => r.status !== "skipped") ?? null;
}

/** طابورُ الرفع من سجلّ الحجز — بلا نصّ الرقعة. `null` = الغلافُ لم يُنشأ بعد (الهجرة الثانية). */
export async function getReleaseQueue(): Promise<QueuedTask[] | null> {
  const db = preview();
  if (!db) return null;
  const { data, error } = await db.rpc("cmd_queue");
  if (error || !Array.isArray(data)) return null;
  return data as QueuedTask[];
}

export async function commandDecide(item: string, decision: "approve" | "accept" | "defer" | "reject", byName: string, byUser: string, reason: string) {
  const db = preview();
  if (!db) throw new Error("command_unavailable");
  const { error } = await db.rpc("cmd_decide", { p_item: item, p_decision: decision, p_by_name: byName, p_by_user: byUser, p_reason: reason });
  if (error) throw new Error(error.message);
}

export async function commandApproveRelease(taskIds: number[], byName: string, byUser: string, reason: string) {
  const db = preview();
  if (!db) throw new Error("command_unavailable");
  const { error } = await db.rpc("cmd_approve_release", { p_task_ids: taskIds, p_by_name: byName, p_by_user: byUser, p_reason: reason });
  if (error) throw new Error(error.message);
}

export async function commandRequestControl(agent: string, action: "pause" | "resume" | "run_now", byName: string, byUser: string, reason: string) {
  const db = preview();
  if (!db) throw new Error("command_unavailable");
  const { error } = await db.rpc("cmd_request_control", { p_agent: agent, p_action: action, p_cron: null, p_reason: reason, p_by_name: byName, p_by_user: byUser });
  if (error) throw new Error(error.message);
}
