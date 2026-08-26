import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/data";
import { allow, retryAfter } from "@/lib/ratelimit";
import { getTv, getMovie } from "@/lib/tmdb";

/** خمسون عملاً في الدفعة تعني خمسين نداءَ TMDB */
export const maxDuration = 60;

/**
 * 🆕 **تعبئةُ تصنيفاتِ الأعمالِ القديمة** (D-648) — بابُ تشغيلٍ لا ميزة.
 *
 * ================= لماذا مسارٌ لا فعلُ خادم =================
 *
 * **الصفوفُ التي سبقت العمودَ لا مالكَ واحدٌ لها**: ثمانمئةٌ وأربعةٌ
 * وستّون صفّاً عند واحدٍ وثلاثين عضواً، **وفعلُ خادمٍ يكتب صفوفَ غيرِك
 * ليس فعلَ مستخدم.** **والدورةُ تجري مرّةً في عمر العمود** — فالمناسبُ
 * لها نداءٌ لا سطح (وصفةُ `‎/api/curated` نفسُها، D-329).
 *
 * ================= والحارسُ في القاعدة لا هنا =================
 *
 * `admin_set_title_genres` ترفع `forbidden` لغير `am_admin()`
 * (D-011/D-314) — **فمسجَّلٌ عاديٌّ ينادي هذا الباب يأخذ خطأً لا صفّاً**،
 * والضررُ الأقصى نداءاتُ TMDB التي يقطعها حدُّ المعدّل. **ولا سرَّ
 * جديداً في البيئة** (D-135).
 *
 * ================= والدفعةُ بالأعمال لا بالصفوف =================
 *
 * «صراع العروش» عند عشرةِ أعضاءٍ **نداءٌ واحدٌ يملأ عشرةَ صفوف** —
 * **والقاعدةُ هي التي تجمع** (`admin_titles_missing_genres`)، فلا
 * ينزل إلى هنا إلا عملٌ فريد. **والأكثرُ تكراراً أوّلاً** فأثرُ أوّلِ
 * دفعةٍ أكبرُ ما يمكن.
 *
 * ⚠️ **والكتابةُ تعبئةٌ لا استبدال** (`genres is null` في جسم الدالّة):
 * **أسوأُ ما يفعله تشغيلٌ مكرَّرٌ لا شيء.**
 *
 * الاستعمال (من تبويب loopztv مسجَّلٍ فيه بحساب الإدارة):
 *   let r; do { r = await (await fetch('/api/genres?n=50')).json(); console.log(r); }
 *   while (r.rows > 0);
 *
 * ⚠️ **والشرطُ `rows` لا `titles`**: عملٌ حُذف من TMDB يفشل في كلِّ دفعة
 * ويبقى `null`، **فدورةٌ تنتظر `titles = 0` لا تنتهي أبداً** — **وصفرُ
 * صفوفٍ مكتوبةٍ هو النهايةُ الصادقة.**
 */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });

  const key = `genres:${user.id}`;
  if (!allow(key, 40, 60_000)) {
    return NextResponse.json(
      { error: "rate" },
      { status: 429, headers: { "Retry-After": String(retryAfter(key)) } },
    );
  }

  const url = new URL(request.url);
  const n = Math.max(1, Math.min(Number(url.searchParams.get("n") ?? 50) || 50, 100));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_titles_missing_genres", { lim: n });
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });

  const titles = (data ?? []) as { tmdb_id: number; media_type: string; rows_waiting: number }[];
  if (!titles.length) return NextResponse.json({ titles: 0, rows: 0, failed: 0 });

  let rows = 0;
  let failed = 0;
  for (const it of titles) {
    try {
      const d =
        it.media_type === "tv" ? await getTv(it.tmdb_id) : await getMovie(it.tmdb_id);
      const ids = (d.genres ?? []).map((g) => g.id).filter((x) => Number.isInteger(x));
      const { data: wrote, error: werr } = await supabase.rpc("admin_set_title_genres", {
        p_tmdb_id: it.tmdb_id,
        p_media_type: it.media_type,
        p_genres: ids,
      });
      if (werr) throw new Error(werr.message);
      rows += Number(wrote ?? 0);
    } catch {
      /* **عملٌ حُذف من TMDB لا يوقف الدورة** — يُعدّ ويُترك `null`،
         **ودورةٌ تسقط عند أوّل عملٍ ميّت لا تُكمل أبداً** (D-063). */
      failed++;
    }
  }

  return NextResponse.json({ titles: titles.length, rows, failed });
}
