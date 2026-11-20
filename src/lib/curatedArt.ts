import "server-only";
import { getMovieFor, getTvFor } from "@/lib/tmdb";

/**
 * 🆕 T495 — **قوائمُ لوبز بقاعدة «نظام لوبز» نفسِها** (أحمد ٢١ نوفمبر: «ليه ما تكون القوائم بنفس نظام لوبز —
 * جميع الاعمال باللغة الانجليزية الا العربية تبقى عربية»).
 *
 * ================= لماذا =================
 *
 * عناصرُ القوائم المنسّقة كُتبت بأسماءٍ إنجليزيّة **وملصقاتٍ عربيّة** (بُنيت من جلسةٍ عربيّة)، والقارئُ لا يُعاد
 * جلبُ ملصقه إلا إذا كان **الاسمُ** بغير لغته (`localizeCore`) — فقارئٌ إنجليزيٌّ يرى «Dune: Part Two» بغلافٍ عربيّ
 * وصفحةُ العمل نفسُها بغلافٍ إنجليزيّ. **الحلُّ عند الكتابة لا عند القراءة**: يُخزَّن الصحيحُ مرّةً فلا نداءَ زائدٌ
 * مع كلِّ فتح (أحمد: «كذا ممكن يسير بطء»)، وأغلفةُ البطاقات المجمّعة تُصلح معه لأنها تقرأ الملصقَ المخزَّن.
 *
 * ================= القاعدة =================
 *
 * - **العملُ الأجنبيّ**: اسمُه المخزَّن كما هو (إنجليزيٌّ أصلاً) وملصقُه الإنجليزيّ (`en-US`).
 * - **العملُ العربيُّ الأصل** (`original_language = ar`): اسمُه وملصقُه العربيّان (`ar-SA`).
 * - **ونداءٌ يسقط يُبقي الصفَّ كما هو** — ملصقٌ قديمٌ خيرٌ من فراغ (D-063).
 */
export type CuratedArtRow = { tmdbId: number; mediaType: "movie" | "tv"; title: string | null; posterPath: string | null };

type Detail = { title?: string; name?: string; poster_path?: string | null; original_language?: string };

async function detail(row: CuratedArtRow, language: "en-US" | "ar-SA"): Promise<Detail> {
  return (row.mediaType === "tv" ? getTvFor(row.tmdbId, language) : getMovieFor(row.tmdbId, language)) as Promise<Detail>;
}

/** الاسمُ والملصقُ بقاعدة لوبز لصفٍّ واحد — `null` حين يسقط النداءُ (يبقى الصفُّ كما هو) */
export async function loopzArt(row: CuratedArtRow): Promise<{ title: string; posterPath: string | null } | null> {
  try {
    const en = await detail(row, "en-US");
    if (en.original_language === "ar") {
      const ar = await detail(row, "ar-SA").catch(() => null);
      const name = (ar?.title ?? ar?.name ?? "").trim();
      return { title: name || row.title || "", posterPath: ar?.poster_path ?? en.poster_path ?? row.posterPath };
    }
    return { title: row.title || en.title || en.name || "", posterPath: en.poster_path ?? row.posterPath };
  } catch {
    return null;
  }
}

/** دفعاتٌ صغيرة لا موجةٌ واحدة — قائمةُ «أفضل ٢٥٠» لا تفتح ٢٥٠ نداءً في اللحظة نفسِها */
export async function loopzArtAll<T extends CuratedArtRow>(rows: T[], batch = 8): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < rows.length; i += batch) {
    const part = rows.slice(i, i + batch);
    const art = await Promise.all(part.map(loopzArt));
    part.forEach((r, k) => {
      const a = art[k];
      out.push(a ? { ...r, title: a.title, posterPath: a.posterPath } : r);
    });
  }
  return out;
}
