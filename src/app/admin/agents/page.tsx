import Link from "next/link";
import { notFound } from "next/navigation";
import { getAmAdmin } from "@/lib/data";
import {
  getCommandBoard,
  getCommandRuns,
  type CommandAgent,
} from "@/lib/command";
import { controlAgentAction } from "@/lib/commandActions";
import { AdminNotice } from "@/components/admin/AdminNotice";
import { buttonClass } from "@/components/ui/Button";
import {
  DEPT_AR,
  DEPT_ORDER,
  STATUS_AR,
  canDecideNow,
  dotColor,
  riyadhDay,
  riyadhTime,
} from "../command/parts";

/**
 * ====== 🆕 الوكلاء (مهمّة ٥٩٣) — من يعمل، متى، وبماذا خرج ======
 *
 * 🔑 **«أوقف» و«شغّل الآن» طلباتٌ لا أوامر**: لا يملك خادمُ لوبز يداً على مهامّ
 * Claude المجدولة. فالزرُّ يكتب طلباً في `command.control_requests`، **والوكيلُ
 * يقرأ علَمَ الإيقاف في أوّل خطوةٍ من تشغيله فيتوقّف بنفسه**، والمجلسُ يطبّق
 * الباقي في تشغيله التالي. فالسطرُ «طلبٌ ينتظر» صادقٌ: لم يحدث بعد.
 *
 * ⚖️ **والتقريرُ الكاملُ يُفتح بالضغط لا يُفرش**: صفحةُ وكلاءٍ تعرض تقاريرَ
 * سبعة وكلاءٍ دفعةً واحدة جدارُ نصٍّ لا لوحة.
 */
export const dynamic = "force-dynamic";

export default async function CommandAgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ agent?: string; err?: string; ok?: string }>;
}) {
  const admin = await getAmAdmin();
  if (!admin) notFound();
  const sp = await searchParams;
  const [board, canDecide] = await Promise.all([
    getCommandBoard(),
    canDecideNow(),
  ]);
  const agents = board?.agents ?? [];
  const pick = agents.find((a) => a.key === sp.agent);
  const runs = pick ? await getCommandRuns(pick.key, 15).catch(() => []) : [];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-22 font-bold">الوكلاء</h1>
        <p className="text-12 text-muted">
          المهامُّ المجدولة بأقسامها — اضغط وكيلاً لترى تشغيلاته
        </p>
      </header>

      <AdminNotice err={sp.err} ok={sp.ok} />

      {!board ? (
        <p className="rounded-xl bg-surface p-4 text-14 text-muted">
          سجلُّ الوكلاء غير متاحٍ الآن — أعد المحاولة بعد قليل.
        </p>
      ) : (
        DEPT_ORDER.map((d) => {
          const list = agents.filter((a) => a.department === d);
          if (list.length === 0) return null;
          return (
            <section key={d} className="space-y-2">
              <h2 className="text-14 font-bold">{DEPT_AR[d]}</h2>
              <ul className="rounded-xl bg-surface overflow-hidden divide-y divide-border">
                {list.map((a) => (
                  <AgentRow
                    key={a.key}
                    a={a}
                    open={a.key === pick?.key}
                    canDecide={canDecide}
                  />
                ))}
              </ul>
            </section>
          );
        })
      )}

      {pick && (
        <section className="space-y-2" id="runs">
          <h2 className="text-14 font-bold">تشغيلات {pick.name}</h2>
          {runs.length === 0 ? (
            <p className="text-14 text-muted">لا تشغيلَ مسجَّلٌ بعد.</p>
          ) : (
            <ul className="space-y-2">
              {runs.map((r) => (
                <li key={r.id} className="rounded-xl bg-surface p-3">
                  <details>
                    <summary className="cursor-pointer list-none space-y-1">
                      <span className="flex items-center gap-2 text-12 text-muted">
                        <span
                          className="size-2 rounded-full"
                          style={{ background: dotColor(r.status) }}
                          aria-hidden
                        />
                        {STATUS_AR[r.status]} · {riyadhDay(r.started_at)}{" "}
                        {riyadhTime(r.started_at)}
                      </span>
                      <span className="block text-14 leading-relaxed">
                        {r.summary_ar}
                      </span>
                    </summary>
                    {r.report_md && (
                      <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-surface-2 p-3 text-12 leading-relaxed">
                        {r.report_md}
                      </pre>
                    )}
                  </details>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function AgentRow({
  a,
  open,
  canDecide,
}: {
  a: CommandAgent;
  open: boolean;
  canDecide: boolean;
}) {
  const back = `/admin/agents`;
  return (
    <li className="p-3 space-y-2">
      <Link
        href={`/admin/agents?agent=${a.key}#runs`}
        className="block space-y-1"
        aria-current={open ? "true" : undefined}
      >
        <span className="flex items-center gap-2">
          <span
            className="size-2 rounded-full"
            style={{ background: dotColor(a.last_run?.status ?? null) }}
            aria-hidden
          />
          <span className={`text-14 font-bold ${open ? "text-accent" : ""}`}>
            {a.name}
          </span>
          {a.paused && (
            <span className="rounded-md bg-surface-2 px-2 py-0.5 text-12 text-muted">
              موقوف
            </span>
          )}
        </span>
        <span className="block text-12 text-muted">
          {a.last_run
            ? `آخرُ تشغيل: ${STATUS_AR[a.last_run.status]} · ${riyadhDay(a.last_run.started_at)} ${riyadhTime(a.last_run.started_at)}`
            : "لم يُسجَّل له تشغيلٌ بعد"}
          {a.next_run_at && ` · التالي ${riyadhTime(a.next_run_at)}`}
        </span>
        {a.last_run?.summary && (
          <span className="block text-12 leading-relaxed">
            {a.last_run.summary}
          </span>
        )}
        {a.paused && a.paused_reason && (
          <span className="block text-12 text-muted">
            سببُ الإيقاف: {a.paused_reason}
          </span>
        )}
      </Link>
      {a.pending_control > 0 && (
        <p className="text-12 text-accent">
          طلبٌ ينتظر أن يطبّقه المجلسُ في تشغيله التالي.
        </p>
      )}
      {canDecide && a.pending_control === 0 && (
        <form
          action={controlAgentAction}
          className="flex flex-wrap items-center gap-2"
        >
          <input type="hidden" name="agent" value={a.key} />
          <input type="hidden" name="back" value={back} />
          <input
            name="reason"
            required
            minLength={3}
            maxLength={500}
            placeholder="السبب"
            className="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-14"
          />
          {a.paused ? (
            <button
              name="action"
              value="resume"
              className={buttonClass({ variant: "surface", size: "sm" })}
            >
              استأنف
            </button>
          ) : (
            <button
              name="action"
              value="pause"
              className={buttonClass({ variant: "surface", size: "sm" })}
            >
              أوقف
            </button>
          )}
          {!a.paused && (
            <button
              name="action"
              value="run_now"
              className={buttonClass({ variant: "surface", size: "sm" })}
            >
              شغّل الآن
            </button>
          )}
        </form>
      )}
    </li>
  );
}
