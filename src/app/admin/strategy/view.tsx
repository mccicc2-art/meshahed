import Link from "next/link";
import type { CommandBoard, CommandRun } from "@/lib/command";
import { AdminNotice } from "@/components/admin/AdminNotice";
import { DecideForm, riyadhDay } from "../command/parts";

/**
 * ====== 🆕 الاستراتيجية (مهمّة ٥٩٧، التصميم «ج — تقرير الأسبوع»، اختيارُ أحمد ٢٧ نوفمبر) ======
 *
 * 🎯 **الصفحةُ تنتهي بقرار**: جملةُ الحال من الاستراتيجيّ، ثمّ أولويّاتُه بنوداً `ST-nn` بأزرار
 * القرار **نفسِها** التي في غرفة القيادة (`DecideForm`) — لا نموذجَ ثانٍ، ولا قرارٌ يُسجَّل
 * هنا بغير ما يُسجَّل هناك. ثمّ سطرُ السوق من بنود `MK-nn`.
 *
 * 🔑 **«السوق» قسمٌ هنا لا تبويب**: محلّلُ السوق يكتب بندين أو ثلاثة أسبوعيّاً؛ صفحةٌ لها
 * وحدَها تبقى فارغةً ستّةَ أيّامٍ من سبعة.
 *
 * ⚖️ **والتقريرُ كاملاً يُفتح بالضغط**: الأولويّاتُ هي ما يُقرَّر، والباقي دليلٌ لمن أراده.
 */
const BACK = "/admin/strategy";

/** جسمُ الصفحة بلا جلبٍ ولا حارس — كي يُرسم ويُفحص ببياناتٍ ثابتة */
export function StrategyView({
  board,
  strategist,
  market,
  canDecide,
  sp,
}: {
  board: CommandBoard | null;
  strategist: CommandRun | null;
  market: CommandRun | null;
  canDecide: boolean;
  sp: { err?: string; ok?: string };
}) {
  const items = board?.items_open ?? [];
  const priorities = items.filter((i) => i.source === "strategist").sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));
  const marketItems = items.filter((i) => i.source === "market_analyst");
  const names = new Map((board?.agents ?? []).map((a) => [a.key, a.name]));

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-22 font-bold">تقرير الأسبوع</h1>
        <p className="text-12 text-muted">
          {strategist ? `الاستراتيجيّ · ${riyadhDay(strategist.started_at)}` : "الاستراتيجيّ · يصدر أوّل تقريرٍ يوم الأحد ٢:١١ م"}
        </p>
      </header>

      <AdminNotice err={sp.err} ok={sp.ok} />

      {strategist ? (
        <section className="rounded-xl bg-surface p-4 space-y-2">
          <p className="text-15 font-bold leading-relaxed">{strategist.summary_ar}</p>
          {strategist.report_md && (
            <details>
              <summary className="cursor-pointer text-12 text-accent">التقرير كاملاً</summary>
              <pre className="mt-2 max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-lg bg-surface-2 p-3 text-12 leading-relaxed">
                {strategist.report_md}
              </pre>
            </details>
          )}
        </section>
      ) : (
        <p className="rounded-xl bg-surface p-4 text-14 text-muted">
          لم يصدر تقريرٌ بعد. يبني الاستراتيجيّ على تقريرَي المنتج (السبت) والسوق (الأحد صباحاً)، ثمّ تظهر هنا جملةُ الحال والأولويّات.
        </p>
      )}

      {priorities.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-12 font-bold text-muted">الأولويّات</h2>
          {priorities.map((p, i) => (
            <div key={p.id} className="rounded-xl bg-surface p-4 space-y-1">
              <p className="text-12 text-muted">الأولويّة {i + 1}</p>
              <DecideForm item={p} back={BACK} canDecide={canDecide} agentName={names.get(p.source)} />
            </div>
          ))}
        </section>
      )}

      <section className="rounded-xl bg-surface p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-14 font-bold">من السوق</h2>
          <Link href="/admin/items" className="text-12 text-accent">
            البنود
          </Link>
        </div>
        {market && <p className="mt-1 text-12 text-muted">{market.summary_ar}</p>}
        {marketItems.length > 0 ? (
          <ul className="mt-2 divide-y divide-border">
            {marketItems.map((m) => (
              <li key={m.id} className="py-2.5">
                <p className="text-14 font-medium">
                  {m.title} <span className="text-12 text-muted tabular-nums">{m.id}</span>
                </p>
                {m.proposal && <p className="text-12 text-muted">{m.proposal}</p>}
              </li>
            ))}
          </ul>
        ) : (
          !market && <p className="mt-2 text-14 text-muted">يصدر أوّل تقريرٍ يوم الأحد ٩:٤١ ص.</p>
        )}
      </section>
    </div>
  );
}
