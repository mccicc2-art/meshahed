import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/data";
import { allow, retryAfter } from "@/lib/ratelimit";
import { getTv, getMovie, getCredits } from "@/lib/tmdb";

/** خمسةٌ وعشرون عملاً في الدفعة = خمسون نداءَ TMDB (تفاصيلُ + طاقمٌ لكلٍّ) */
export const maxDuration = 60;

/**
 * 🆕 **تعبئةُ بطاقة هويّة الأعمال** (D-700) — بابُ تشغيلٍ لا ميزة،
 * **ووصفةُ `/api/genres` (D-648) حرفاً**: القاعدةُ تجمع الأعمالَ
 * الفريدةَ الناقصة (`admin_titles_missing_meta` — الأكثرُ تكراراً
 * أوّلاً)، والحارسُ الحقيقيُّ في جسم `set_title_meta` (`am_admin()`)،
 * ومسجَّلٌ عاديٌّ يأخذ خطأً لا صفّاً.
 *
 * **والمكتوبُ صفٌّ واحدٌ للعمل يقرؤه الجميع** (`title_meta` — الهجرة
 * ١٥٠): سنةُ الإصدار واللغةُ الأصليّة وبلدانُ المنشأ والمخرجُ (أو صانعُ
 * المسلسل) وأوّلُ ثلاثةِ ممثلين — **حقائقُ كتالوجٍ تُغذّي بطاقةَ «ذوقك»
 * بلا نداء TMDB واحدٍ وقتَ العرض** (درسُ D-649).
 *
 * الاستعمال (من تبويبٍ مسجَّلٍ بحساب الإدارة):
 *   let r; do { r = await (await fetch('/api/title-meta?n=25')).json(); console.log(r); }
 *   while (r.titles > 0 && r.rows > 0);
 * ⚠️ **وشرطُ الخروج `rows` مع `titles`**: عملٌ حُذف من TMDB يفشل في
 * كلِّ دفعةٍ — وصفرُ صفوفٍ مكتوبةٍ نهايةٌ صادقة (نصُّ `/api/genres`).
 */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });

  const key = `titlemeta:${user.id}`;
  if (!allow(key, 40, 60_000)) {
    return NextResponse.json(
      { error: "rate" },
      { status: 429, headers: { "Retry-After": String(retryAfter(key)) } },
    );
  }

  const url = new URL(request.url);
  const n = Math.max(1, Math.min(Number(url.searchParams.get("n") ?? 25) || 25, 50));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_titles_missing_meta", { lim: n });
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });

  const titles = (data ?? []) as { tmdb_id: number; media_type: string }[];
  if (!titles.length) return NextResponse.json({ titles: 0, rows: 0, failed: 0 });

  const rows: Record<string, unknown>[] = [];
  let failed = 0;
  for (const it of titles) {
    try {
      const tv = it.media_type === "tv";
      const [d, credits] = await Promise.all([
        tv ? getTv(it.tmdb_id) : getMovie(it.tmdb_id),
        getCredits(tv ? "tv" : "movie", it.tmdb_id),
      ]);
      const date = tv
        ? (d as { first_air_date?: string | null }).first_air_date
        : (d as { release_date?: string | null }).release_date;
      const year = date ? Number(String(date).slice(0, 4)) : null;
      /* **بلدُ المنشأ أوّلاً** (D-562: أحدثُ من بلدان الإنتاج) والإنتاجُ سدُّه */
      const countries =
        (d as { origin_country?: string[] }).origin_country?.filter(Boolean) ??
        (d as { production_countries?: { iso_3166_1: string }[] }).production_countries?.map(
          (c) => c.iso_3166_1,
        ) ??
        [];
      /* مخرجُ الفيلم من الطاقم — وصانعُ المسلسل من `created_by` (طاقمُ
         المسلسل في TMDB نادراً ما يحمل «Director» على مستوى العمل) */
      const director = tv
        ? ((d as { created_by?: { name: string }[] }).created_by?.[0]?.name ?? null)
        : (credits.crew.find((c) => c.job === "Director")?.name ?? null);
      rows.push({
        media_type: it.media_type,
        tmdb_id: it.tmdb_id,
        release_year: Number.isFinite(year) && year ? year : null,
        original_language:
          (d as { original_language?: string }).original_language ?? null,
        origin_countries: countries.slice(0, 6),
        director,
        top_cast: credits.cast.slice(0, 3).map((c) => c.name),
      });
    } catch {
      /* عملٌ ميّتٌ في TMDB لا يوقف الدورةَ — يُعدّ ويُترك بلا صفّ (D-063) */
      failed++;
    }
  }

  let wrote = 0;
  if (rows.length) {
    const { data: w, error: werr } = await supabase.rpc("set_title_meta", {
      p_rows: rows,
    });
    if (werr) return NextResponse.json({ error: werr.message }, { status: 403 });
    wrote = Number(w ?? 0);
  }

  return NextResponse.json({ titles: titles.length, rows: wrote, failed });
}
