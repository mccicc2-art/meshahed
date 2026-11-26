import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getUserId } from "@/lib/data";
import { buildPeriodStats, type StatTitle } from "@/lib/periodStats";
import { loopzArt } from "@/lib/curatedArt";
import type { Locale } from "@/core/i18n";

/**
 * ====== 🆕 بطاقةُ سجلّ المشاهدة — بياناتُها (أحمد ٢٥ و٢٦ نوفمبر: «١ب» الأسبوعُ الحاليّ من الأحد، «٢ب» الشهرُ من يومه الأوّل،
 * «٣أ» يُخفي العضوُ عملاً قبل المشاركة، «ن٥ ب») ======
 *
 * **المحرّكُ محرّكُ صفحة الإحصائيات** (`buildPeriodStats` بمدّتي «الأسبوع» و«الشهر»؛ الأسبوعُ هناك يبدأ بالأحد) — فلا تقول البطاقةُ
 * عن الأسبوع رقماً غيرَ الصفحة. وما أخفاه صاحبُها يسقط من الأعمال ومن الأرقام معاً، فيبقى المجموعُ صادقاً.
 */
export type HistoryPeriod = "week" | "month";
export const asHistoryPeriod = (v: string | null | undefined): HistoryPeriod => (v === "month" ? "month" : "week");

/** مفاتيحُ «أخفِ» من العنوان: `tv-1,movie-2` — ما لا يطابق الشكلَ يُهمل */
export function parseHide(v: string | null | undefined): Set<string> {
  return new Set(
    String(v ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter((x) => /^(tv|movie)-[1-9]\d{0,9}$/.test(x))
      .slice(0, 50),
  );
}

export type HistoryTitles = { range: string; titles: StatTitle[] };

export async function historyTitles(period: HistoryPeriod, locale: Locale, tz: string): Promise<HistoryTitles> {
  const stats = await buildPeriodStats(period, 0, locale, tz);
  return { range: stats.range.label, titles: stats.empty ? [] : stats.allTitles };
}

/** تقييماتُ صاحب الجلسة لأعمالٍ بعينها — لا كلُّها */
export async function myRatingsFor(keys: { tmdbId: number; mediaType: "tv" | "movie" }[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!keys.length) return out;
  try {
    const uid = await getUserId();
    if (!uid) return out;
    const db = await createClient();
    const { data } = await db
      .from("ratings")
      .select("tmdb_id, media_type, rating")
      .eq("user_id", uid)
      .in("tmdb_id", keys.map((k) => k.tmdbId));
    for (const r of (data ?? []) as { tmdb_id: number; media_type: string; rating: number | null }[]) {
      if (r.rating) out.set(`${r.media_type}-${r.tmdb_id}`, r.rating);
    }
  } catch {
    /* بلا تقييمات خيرٌ من بطاقةٍ لا تُرسم */
  }
  return out;
}

/** الاسمُ بقاعدة لوبز (إنجليزيٌّ إلّا العربيَّ الأصل) والملصقُ المطابق — وما سقط نداؤه يبقى كما في المكتبة */
export async function cardArt(t: StatTitle): Promise<{ title: string; poster: string | null }> {
  const a = await loopzArt({ tmdbId: t.tmdbId, mediaType: t.mediaType, title: null, posterPath: t.poster }).catch(() => null);
  return { title: a?.title || t.title, poster: a?.posterPath ?? t.poster };
}
