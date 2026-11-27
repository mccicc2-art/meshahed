import { notFound } from "next/navigation";
import { getAmAdmin } from "@/lib/data";
import { getCommandBoard, getLatestRun } from "@/lib/command";
import { MetricsView } from "./view";

/** المؤشّرات (مهمّة ٥٩٧) — الجلبُ والحارس هنا، والجسمُ في `view.tsx` */
export const dynamic = "force-dynamic";

export default async function AdminMetricsPage() {
  const admin = await getAmAdmin();
  if (!admin) notFound();
  const [board, product, strategist] = await Promise.all([
    getCommandBoard(),
    getLatestRun("product").catch(() => null),
    getLatestRun("strategist").catch(() => null),
  ]);

  return <MetricsView board={board} product={product} strategist={strategist} />;
}
