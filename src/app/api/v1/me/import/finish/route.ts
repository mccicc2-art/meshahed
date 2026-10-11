import { handle, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { finishImport } from "@/lib/actions";

/**
 * `POST /api/v1/me/import/finish` — **ختامُ الاستيراد، مرّةً واحدة** (🆕 D-1369 · V-C · C6).
 * `finishImport` تحتسب دعوةَ من تجاوز الأعمالَ الثلاثة باستيراده (D-768) وتُبطل صفحاتِ الويب؛
 * **والوسومُ هنا تُبطل ما يقرؤه التطبيق**: الرئيسيّةُ والمكتبةُ والإحصاءاتُ والتقارير — كلُّها تغيّرت بما كُتب.
 */
export async function POST() {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    await finishImport();
    return ok({ done: true }, ["home", "me:library", "me:stats", "me:reports", "me:ratings", "me:diary", "me:invites"]);
  });
}
