import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * مسبار مؤقّت لقياس المسافة الفعلية بين الدالة وقاعدة البيانات.
 *
 * يقيس ثلاث رحلات متتابعة لأن هذا ما تفعله الصفحة الحقيقية —
 * والاستعلام لا يرجّع أي بيانات (RLS تمنع ذلك للزائر)، فقط الزمن.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const samples: number[] = [];

  for (let i = 0; i < 3; i++) {
    const t0 = Date.now();
    await supabase.from("follows").select("tmdb_id").limit(1);
    samples.push(Date.now() - t0);
  }

  samples.sort((a, b) => a - b);

  return NextResponse.json(
    {
      region: process.env.VERCEL_REGION ?? "unknown",
      dbRoundTripMs: samples,
      median: samples[1],
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
