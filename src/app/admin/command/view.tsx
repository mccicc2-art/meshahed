import Link from "next/link";
import type { CommandAgent, CommandBoard, QueuedTask } from "@/lib/command";
import { approveReleaseAction } from "@/lib/commandActions";
import { AdminNotice } from "@/components/admin/AdminNotice";
import { buttonClass } from "@/components/ui/Button";
import {
  DEPT_AR,
  DEPT_ORDER,
  DecideForm,
  byUrgency,
  dotColor,
  riyadhTime,
  worst,
} from "./parts";

/** جسمُ غرفة القيادة بلا جلبٍ ولا حارس — كي يُرسم ويُفحص ببياناتٍ ثابتة */
const BACK = "/admin/command";

function todayRiyadh(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const f = (d: Date) =>
    d.toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
  return f(new Date(iso)) === f(new Date());
}

function Counter({
  n,
  label,
  href,
}: {
  n: string;
  label: string;
  href?: string;
}) {
  const body = (
    <>
      <span className="block text-24 font-bold tabular-nums">{n}</span>
      <span className="text-12 text-muted">{label}</span>
    </>
  );
  return href ? (
    <Link
      href={href}
      className="rounded-xl bg-surface p-3 text-center hover:bg-surface-2 transition-colors"
    >
      {body}
    </Link>
  ) : (
    <div className="rounded-xl bg-surface p-3 text-center">{body}</div>
  );
}

export function CommandRoomView({
  board,
  queue,
  canDecide,
  sp,
}: {
  board: CommandBoard | null;
  queue: QueuedTask[] | null;
  canDecide: boolean;
  sp: { err?: string; ok?: string };
}) {
  if (!board) {
    return (
      <div className="space-y-4">
        <h1 className="text-22 font-bold">غرفة القيادة</h1>
        <AdminNotice err={sp.err} ok={sp.ok} />
        <p className="rounded-xl bg-surface p-4 text-14 text-muted">
          سجلُّ الوكلاء غير متاحٍ الآن — باقي أقسام الإدارة تعمل. أعد التحميل بعد
          قليل.
        </p>
      </div>
    );
  }

  const open = board.items_open
    .filter((i) => i.status === "open")
    .sort(byUrgency);
  const top = open[0];
  const scheduled = board.agents.filter((a) => a.schedule && !a.paused);
  const ranToday = scheduled.filter((a) =>
    todayRiyadh(a.last_run?.started_at),
  ).length;
  /* طابورٌ كلُّه في موافقةٍ لم تُستهلك = لا زرَّ ثانٍ؛ موافقتان على الشيء نفسِه ضجيج */
  const okd = new Set((board.releases_pending ?? []).flatMap((r) => r.tasks));
  const approvedBy =
    queue && queue.length > 0 && queue.every((q) => okd.has(q.task_id))
      ? (board.releases_pending ?? [])
          .map((r) => r.by)
          .filter((v, i, a) => a.indexOf(v) === i)
          .join(" و")
      : null;
  const byKey = new Map(board.agents.map((a) => [a.key, a]));

  const depts = DEPT_ORDER.map((d) => ({
    d,
    agents: board.agents.filter((a) => a.department === d),
  }));
  const live = depts.filter((x) => x.agents.length > 0);
  const pending = depts.length - live.length;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-22 font-bold">غرفة القيادة</h1>
        <p className="text-12 text-muted">
          ما ينتظر قرارك الآن · آخرُ تحديثٍ {riyadhTime(board.generated_at)}
        </p>
      </header>

      <AdminNotice err={sp.err} ok={sp.ok} />

      <div className="grid grid-cols-3 gap-2">
        <Counter
          n={String(open.length)}
          label="بنودٌ تنتظرك"
          href="/admin/items"
        />
        <Counter
          n={queue ? String(queue.length) : "—"}
          label="في طابور الرفع"
        />
        <Counter
          n={`${ranToday} من ${scheduled.length}`}
          label="تشغيلات اليوم"
          href="/admin/agents"
        />
      </div>

      {top ? (
        <section className="rounded-xl bg-surface p-4 space-y-2">
          <h2 className="text-12 font-bold text-muted">أهمّ بندٍ الآن</h2>
          <DecideForm
            item={top}
            back={BACK}
            canDecide={canDecide}
            agentName={byKey.get(top.source)?.name}
          />
          {open.length > 1 && (
            <Link
              href="/admin/items"
              className="block pt-1 text-12 text-accent"
            >
              {open.length === 2 ? "وبندٌ آخر" : `و${open.length - 1} بنودٍ أخرى`}{" "}
              في «البنود» ←
            </Link>
          )}
        </section>
      ) : (
        <p className="rounded-xl bg-surface p-4 text-14 text-muted">
          لا بندَ ينتظر قرارك.
        </p>
      )}

      {queue && queue.length > 0 && (
        <section className="rounded-xl bg-surface p-4 space-y-3">
          <h2 className="text-12 font-bold text-muted">طابورُ الرفع</h2>
          <ul className="space-y-2">
            {queue.map((q) => (
              <li key={q.task_id} className="text-14">
                <span dir="ltr" className="text-12 text-muted tabular-nums">
                  #{q.task_id}
                </span>{" "}
                {q.description}
                {q.native_build && (
                  <span className="ms-2 text-12 text-accent">
                    يحتاج بناءً مدفوعاً
                  </span>
                )}
              </li>
            ))}
          </ul>
          {approvedBy ? (
            <p className="text-12 text-success">
              ✓ وافق {approvedBy} على الرفع — ينتظر محادثةً تقول «ارفع».
            </p>
          ) : (
            canDecide && (
              <form action={approveReleaseAction} className="space-y-2">
                <input type="hidden" name="back" value={BACK} />
                <input
                  type="hidden"
                  name="tasks"
                  value={queue.map((q) => q.task_id).join(",")}
                />
                <input
                  name="reason"
                  required
                  minLength={3}
                  maxLength={500}
                  placeholder="السبب — يُحفظ مع الموافقة"
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-14"
                />
                <button className={buttonClass({ size: "sm", full: true })}>
                  وافق على الرفع
                </button>
                <p className="text-12 text-muted">
                  تُسجَّل موافقتك، والرفعُ في محادثةٍ تقرأها.
                </p>
              </form>
            )
          )}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-14 font-bold">الأقسام</h2>
        <div className="grid grid-cols-2 gap-2">
          {live.map(({ d, agents }) => (
            <DeptCard key={d} label={DEPT_AR[d]} agents={agents} />
          ))}
        </div>
        {pending > 0 && (
          <p className="rounded-xl border border-dashed border-border p-3 text-center text-12 text-muted">
            {pending === 1
              ? "قسمٌ واحد قيد الإنشاء"
              : `${pending} أقسامٍ قيد الإنشاء`}
          </p>
        )}
      </section>

      {board.kpi && (
        <section className="rounded-xl bg-surface p-4 space-y-3">
          <h2 className="text-12 font-bold text-muted">نبضُ المنتج</h2>
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-14">يعود في اليوم التالي</span>
              <span className="text-20 font-bold tabular-nums" dir="ltr">
                {board.kpi.d1_return_pct}%
              </span>
            </div>
            {/* المقياسُ ٠–١٠٠ بعلامةِ الهدف — مراجعةُ ٢٧ نوفمبر: شريطٌ بلا مقياسٍ يكذب */}
            <div
              className="relative mt-2 h-2 rounded-full bg-surface-2"
              dir="ltr"
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-accent"
                style={{
                  width: `${Math.min(100, Math.max(0, board.kpi.d1_return_pct))}%`,
                }}
              />
              <div
                className="absolute -inset-y-1 w-0.5 bg-foreground"
                style={{ left: `${board.kpi.d1_target_pct}%` }}
                aria-hidden
              />
            </div>
            <p className="mt-1 text-12 text-muted">
              الهدف {board.kpi.d1_target_pct}%
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div>
              <span className="block text-20 font-bold tabular-nums">
                {board.kpi.active_yesterday}
              </span>
              <span className="text-12 text-muted">نشطٌ أمس</span>
            </div>
            <div>
              <span className="block text-20 font-bold tabular-nums">
                {board.kpi.active_7d}
              </span>
              <span className="text-12 text-muted">نشطٌ هذا الأسبوع</span>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function DeptCard({
  label,
  agents,
}: {
  label: string;
  agents: CommandAgent[];
}) {
  const s = worst(agents);
  return (
    <Link
      href="/admin/agents"
      className="rounded-xl bg-surface p-3 space-y-1.5 hover:bg-surface-2 transition-colors"
    >
      <div className="flex items-center gap-2">
        <span
          className="size-2 rounded-full"
          style={{ background: dotColor(s) }}
          aria-hidden
        />
        <span className="text-14 font-bold">{label}</span>
      </div>
      {agents.map((a) => (
        <p
          key={a.key}
          className="flex justify-between gap-2 text-12 text-muted"
        >
          <span className="truncate">
            {a.name}
            {a.paused && " · موقوف"}
          </span>
          <span className="shrink-0">{riyadhTime(a.last_run?.started_at)}</span>
        </p>
      ))}
    </Link>
  );
}
