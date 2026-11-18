import { redirect } from "next/navigation";

/**
 * 🆕 T413 — **«تقريرك» صار قسمَ «ملخص» في «إحصائياتك»** (صفحةٌ واحدة كالتطبيق، D-1586 ثمّ مطابقةُ الويب ١٨ نوفمبر).
 * البابُ باقٍ كي لا يكسر رابطٌ محفوظ أو زرٌّ قديم: يحوّل بمدّته إلى `/statistics` (والشهرُ افتراضيٌّ هناك فلا يُكتب).
 */
export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const period = p === "week" || p === "year" || p === "all" ? p : null;
  redirect(period ? `/statistics?p=${period}` : "/statistics");
}
