import type { NextRequest } from "next/server";
import { handle, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { finishImport } from "@/lib/actions";
import { recordImportRun } from "@/lib/importRuns";
import { allow } from "@/core/ratelimit";

/**
 * `POST /api/v1/me/import/finish` — **ختامُ الاستيراد، مرّةً واحدة** (🆕 D-1369 · V-C · C6).
 * `finishImport` تحتسب دعوةَ من تجاوز الأعمالَ الثلاثة باستيراده (D-768) وتُبطل صفحاتِ الويب؛
 * **والوسومُ هنا تُبطل ما يقرؤه التطبيق**: الرئيسيّةُ والمكتبةُ والإحصاءاتُ والتقارير — كلُّها تغيّرت بما كُتب.
 * 🆕 T507 — **وسطرُ «استيراداتك»** (`import_runs`) من حصيلةٍ في الجسم: والسطحُ `app` يقوله هذا الطريقُ لا الجسم، ولذلك
 * لا يمرّ الملخّصُ إلى `finishImport` (فعلُ الويب يكتب `web`). وتطبيقٌ قديمٌ يرسل `{}` أو لا جسم ⇐ لا سطر، والختامُ كما كان.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    let body: unknown = null;
    try {
      body = await req.json();
    } catch {
      /* لا جسمَ ⇐ تطبيقٌ قبل T507 */
    }
    await finishImport();
    /* ثلاثون سطراً في اليوم سقفٌ — كما في فعل الويب */
    if (body && allow(`${auth.user.id}:import-run-log`, 30, 86_400_000)) await recordImportRun(auth.user.id, body, "app");
    return ok({ done: true }, ["home", "me:library", "me:stats", "me:reports", "me:ratings", "me:diary", "me:invites"]);
  });
}
