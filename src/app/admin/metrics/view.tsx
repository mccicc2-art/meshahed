import Link from "next/link";
import type { CommandBoard, CommandRun, ProductMetrics } from "@/lib/command";
import { riyadhDay, riyadhTime } from "../command/parts";
import { pillClass, type PillTone } from "@/components/admin/style";

/**
 * ====== 🆕 المؤشّرات (مهمّة ٥٩٧، التصميم «أ — بطاقة الأداء أوّلاً»، اختيارُ أحمد ٢٧ نوفمبر) ======
 *
 * 🎯 **سؤالُ الصفحة: أين لوبز من أهدافه؟** — الأهدافُ أهدافُ التقرير الاستراتيجيّ الأوّل
 * (تسعون يوماً)، والأرقامُ يكتبها محلّلُ المنتج أسبوعيّاً والمجلسُ يوميّاً في سجلّ المعاينة.
 *
 * 🔑 **الصفحةُ لا تحسب شيئاً من الإنتاج**: كلُّ رقمٍ هنا كتبه وكيلٌ مع دليله في تقريره،
 * فلا مفتاحَ خدمةٍ للإنتاج في الإدارة (سياج D-898 باقٍ) ولا رقمان مختلفان لشيءٍ واحد.
 * وما لم يُقَس بعد يُقال «لا قياس» — **صفرٌ مرسومٌ كذبٌ، وفراغٌ مسمّى صدق.**
 *
 * ⚖️ **لونُ الشريط يتبع الحكم**: المتعثّر أحمر، والمتأخّر أصفر، وعلى المسار أخضر — مراجعةُ
 * ٢٧ نوفمبر: شريطٌ أصفرُ تحت «متعثّر» يقول شيئاً والشارةُ تقول غيره.
 */
type Row = NonNullable<ProductMetrics["scorecard"]>[number];

/* ٦٠١ — الشارةُ من `pillClass` الواحدة (كانت ألوانَها نفسَها مكتوبةً هنا باليد) */
const STATUS: Record<Row["status"], { label: string; tone: PillTone; bar: string }> = {
  stalled: { label: "متعثّر", tone: "bad", bar: "bg-error" },
  behind: { label: "متأخّر", tone: "warn", bar: "bg-accent" },
  on_track: { label: "على المسار", tone: "ok", bar: "bg-success" },
  no_target: { label: "لا هدف بعد", tone: "mute", bar: "bg-muted" },
};

/** حكمُ الاحتياط حين لا تقرير بعد — النسبةُ من الهدف بالعتبات نفسها التي في تعليمات المحلّل */
function judge(value: number, target: number): Row["status"] {
  const r = value / target;
  return r >= 0.9 ? "on_track" : r >= 0.6 ? "behind" : "stalled";
}

function fmt(v: number | null, unit?: string) {
  return v === null ? "—" : `${v}${unit ?? ""}`;
}

/** جسمُ الصفحة بلا جلبٍ ولا حارس — كي يُرسم ويُفحص ببياناتٍ ثابتة */
export function MetricsView({
  board,
  product,
  strategist,
}: {
  board: CommandBoard | null;
  product: CommandRun | null;
  strategist: CommandRun | null;
}) {
  const pm = product?.metrics?.product;
  const kpi = board?.kpi ?? null;
  const productAgent = board?.agents.find((a) => a.key === "product");

  /* بطاقةُ المحلّل إن كتبها، وإلّا فسطرا النبض اليوميّ بأهدافهما من التقرير الأوّل */
  const rows: Row[] =
    pm?.scorecard && pm.scorecard.length > 0
      ? pm.scorecard
      : kpi
        ? [
            {
              key: "d1",
              label: "يعودون في اليوم التالي",
              value: kpi.d1_return_pct,
              unit: "%",
              target: kpi.d1_target_pct,
              status: judge(kpi.d1_return_pct, kpi.d1_target_pct),
            },
            {
              key: "wau",
              label: "نشطون هذا الأسبوع",
              value: kpi.active_7d,
              unit: "",
              target: 120,
              status: judge(kpi.active_7d, 120),
            },
          ]
        : [];

  const updated = product?.finished_at ?? kpi?.measured_at ?? null;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-22 font-bold">لوبز مقابل أهدافه</h1>
        <p className="text-12 text-muted">
          {updated ? `آخر تحديث: ${riyadhDay(updated)}، الساعة ${riyadhTime(updated)}` : "لم يُسجَّل قياسٌ بعد"}
        </p>
      </header>

      <section className="rounded-xl bg-surface p-4">
        <h2 className="text-14 font-bold">بطاقة الأداء</h2>
        {rows.length === 0 ? (
          <p className="mt-2 text-14 text-muted">لا قياس بعد — يكتبه المجلس كلَّ يومٍ ٨:١٧ ص و٨:١٧ م.</p>
        ) : (
          <ul className="mt-1 divide-y divide-border">
            {rows.map((r) => {
              const s = STATUS[r.status];
              const w = r.value !== null && r.target ? Math.min(100, Math.max(2, (r.value / r.target) * 100)) : 0;
              return (
                <li key={r.key} className="py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-14 font-medium">{r.label}</span>
                    <span className={pillClass(s.tone)}>{s.label}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3">
                    <b dir="ltr" className="w-14 shrink-0 text-end text-20 tabular-nums">
                      {fmt(r.value, r.unit)}
                    </b>
                    <div className="h-2 flex-1 rounded-full bg-surface-2">
                      <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${w}%` }} />
                    </div>
                    <span className="w-16 shrink-0 text-end text-12 text-muted tabular-nums">
                      {r.target === null ? (
                        "—"
                      ) : (
                        <>
                          الهدف <span dir="ltr">{fmt(r.target, r.unit)}</span>
                        </>
                      )}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {!pm?.scorecard && rows.length > 0 && (
          <p className="mt-1 text-12 text-muted">باقي الأهداف الثمانية تظهر من أوّل تقرير لمحلّل المنتج.</p>
        )}
      </section>

      <section className="rounded-xl bg-surface p-4">
        <h2 className="text-14 font-bold">ماذا فعل القادم الجديد</h2>
        {pm?.funnel ? (
          <>
            <p className="text-12 text-muted">
              الأعضاء الذين سجّلوا قبل {pm.funnel.from_days} إلى {pm.funnel.to_days} يوماً، وعددهم {pm.funnel.cohort_n}
            </p>
            <ul className="mt-3 space-y-2.5">
              {pm.funnel.steps.map((st) => {
                const pct = pm.funnel!.cohort_n ? Math.round((100 * st.n) / pm.funnel!.cohort_n) : 0;
                return (
                  <li key={st.label}>
                    <div className="flex items-center gap-2">
                      <span className="w-40 shrink-0 text-14 leading-snug">{st.label}</span>
                      <div className="h-2 flex-1 rounded-full bg-surface-2">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(2, pct)}%` }} />
                      </div>
                      <span dir="ltr" className="w-16 shrink-0 text-end text-12 tabular-nums">
                        {st.n} · {pct}%
                      </span>
                    </div>
                    {st.split && (
                      <p className="mt-0.5 text-12 text-accent">
                        عاد منهم في الأسبوع الثاني <span dir="ltr">{st.split.returned_pct}%</span> ({st.split.returned_n} من{" "}
                        {st.split.n}) مقابل <span dir="ltr">{st.split.others_pct}%</span> لغيرهم{st.split.n < 30 ? " — عيّنة صغيرة" : ""}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className="mt-2 text-14 text-muted">
            يُملأ من أوّل تقريرٍ لمحلّل المنتج
            {productAgent?.next_run_at ? ` — ${riyadhDay(productAgent.next_run_at)} ${riyadhTime(productAgent.next_run_at)}` : ""}.
          </p>
        )}
      </section>

      <Link href="/admin/strategy" className="flex items-center justify-between gap-3 rounded-xl bg-surface p-4 hover:bg-surface-2 transition-colors">
        <div className="min-w-0">
          <p className="text-14 font-bold">أولويّة الأسبوع من الاستراتيجيّ</p>
          <p className="truncate text-12 text-muted">{strategist ? strategist.summary_ar : "يصدر أوّل تقريرٍ يوم الأحد ٢:١١ م"}</p>
        </div>
        <span className="shrink-0 text-12 text-accent">الاستراتيجية</span>
      </Link>
    </div>
  );
}
