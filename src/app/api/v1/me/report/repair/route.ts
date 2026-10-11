import { handle, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { repairImpossibleDays } from "@/lib/actions";
import type { ReportRepairPayload } from "@/core/contracts/report";

/**
 * `POST /api/v1/me/report/repair` — **«رتّبها على مواعيد العرض»** لبطاقة «اليوم المستحيل» في التقرير (🆕 D-1366 · C5).
 * الفعلُ فعلُ الويب نفسُه (`repairImpossibleDays` — D-801): ينقل مشاهداتِ يومٍ فيه أكثرُ من ٢٤ ساعة إلى مواعيد عرضها، وحدُّه
 * (٤ في الدقيقة) فيه، والكتابةُ بجلسة صاحبها. الوسمان يُبطلان ما يرسم الأرقامَ نفسَها في بقيّة الشاشات.
 */
export async function POST() {
  return handle<ReportRepairPayload>(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const r = await repairImpossibleDays();
    return ok(r, ["home", "me:library", "me:stats", "me:reports"]);
  });
}
