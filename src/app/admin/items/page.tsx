import Link from "next/link";
import { notFound } from "next/navigation";
import { getAmAdmin } from "@/lib/data";
import { getCommandBoard, type CommandItem } from "@/lib/command";
import { AdminNotice } from "@/components/admin/AdminNotice";
import { chipClass, chipRow } from "@/components/ui/controls";
import { DecideForm, byUrgency, canDecideNow } from "../command/parts";

/**
 * ====== 🆕 البنود (مهمّة ٥٩٣) — كلُّ ما رفعه الوكلاءُ ولم يُغلق ======
 * غرفةُ القيادة تعرض **أهمَّ بندٍ واحد**؛ هنا البقيّةُ بالترتيب نفسِه (الأخطرُ ثمّ الأقدم).
 * **والتصفيةُ رقاقاتٌ لا تبويبات** (`controls.ts`): هي تُضيّق القائمةَ نفسَها ولا تغيّر الصفحة.
 * و«مؤجَّل» تصفيةٌ مستقلّة كي لا يدفن المؤجَّلُ ما ينتظر قراراً اليوم.
 */
export const dynamic = "force-dynamic";

const STATES: { key: CommandItem["status"]; label: string }[] = [
  { key: "open", label: "ينتظر قراراً" },
  { key: "approved", label: "موافَقٌ عليه" },
  { key: "in_queue", label: "في الطابور" },
  { key: "deferred", label: "مؤجَّل" },
];

export default async function CommandItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; err?: string; ok?: string }>;
}) {
  const admin = await getAmAdmin();
  if (!admin) notFound();
  const sp = await searchParams;
  const state = STATES.find((s) => s.key === sp.state)?.key ?? "open";
  const [board, canDecide] = await Promise.all([
    getCommandBoard(),
    canDecideNow(),
  ]);
  const back = `/admin/items`;

  const all = board?.items_open ?? [];
  const rows = all.filter((i) => i.status === state).sort(byUrgency);
  const names = new Map((board?.agents ?? []).map((a) => [a.key, a.name]));

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-22 font-bold">البنود</h1>
        <p className="text-12 text-muted">
          ما رفعه الوكلاءُ والمجلس — الأخطرُ أوّلاً ثمّ الأقدم
        </p>
      </header>

      <AdminNotice err={sp.err} ok={sp.ok} />

      <nav className={`${chipRow} flex gap-2`} aria-label="تصفية البنود">
        {STATES.map((s) => {
          const n = all.filter((i) => i.status === s.key).length;
          return (
            <Link
              key={s.key}
              href={`/admin/items?state=${s.key}`}
              className={chipClass(s.key === state)}
            >
              {n ? `${s.label} · ${n}` : s.label}
            </Link>
          );
        })}
      </nav>

      {!board ? (
        <p className="rounded-xl bg-surface p-4 text-14 text-muted">
          سجلُّ الوكلاء غير متاحٍ الآن — أعد المحاولة بعد قليل.
        </p>
      ) : rows.length === 0 ? (
        <p className="text-14 text-muted">لا شيء هنا.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((i) => (
            <li key={i.id} className="rounded-xl bg-surface p-4">
              <DecideForm
                item={i}
                back={back}
                canDecide={canDecide}
                agentName={names.get(i.source)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
