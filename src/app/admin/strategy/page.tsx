import { notFound } from "next/navigation";
import { getAmAdmin } from "@/lib/data";
import { getCommandBoard, getLatestRun } from "@/lib/command";
import { canDecideNow } from "../command/parts";
import { StrategyView } from "./view";

/** الاستراتيجية (مهمّة ٥٩٧) — الجلبُ والحارس هنا، والجسمُ في `view.tsx` */
export const dynamic = "force-dynamic";

export default async function AdminStrategyPage({ searchParams }: { searchParams: Promise<{ err?: string; ok?: string }> }) {
  const admin = await getAmAdmin();
  if (!admin) notFound();
  const sp = await searchParams;
  const [board, strategist, market, canDecide] = await Promise.all([
    getCommandBoard(),
    getLatestRun("strategist").catch(() => null),
    getLatestRun("market_analyst").catch(() => null),
    canDecideNow(),
  ]);

  return <StrategyView board={board} strategist={strategist} market={market} canDecide={canDecide} sp={sp} />;
}
