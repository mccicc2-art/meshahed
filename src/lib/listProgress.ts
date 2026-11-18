import { createClient } from "@/lib/supabase/server";
import { getLibState } from "@/lib/libState";

export type ListProgress = { watched: number; total: number };

/**
 * 🆕 R272 — **كم شاهدتَ من كلِّ قائمة** (أحمد ١٨ نوفمبر — صورةُ «القوائم» على الحاسوب: شريطٌ أخضرُ تحت البطاقة، و«أكملتها»).
 *
 * نداءٌ واحدٌ لكلِّ القوائم المعروضة (`in("list_id", ids)`) بعمودين لا ثلاثة، والحكمُ «شاهدتَه» هو حكمُ الخيط تحت
 * البوستر في صفحة القائمة نفسِها (`getLibState` — المتابعاتُ والحلقاتُ والأفلامُ، مخبّأةٌ في الطلب). السقفُ ٣٠٠٠ صفّ:
 * قائمةُ «أفضل ٢٥٠ فيلماً» وحدها ٢٥٠ — وما فاته السقفُ يُعدّ ناقصاً لا خاطئاً (الشريطُ أقصرُ قليلاً). والفشلُ خريطةٌ فارغة:
 * بطاقاتٌ بلا شريط، لا صفحةٌ ساقطة.
 */
export async function getListProgress(ids: string[]): Promise<Record<string, ListProgress>> {
  if (!ids.length) return {};
  try {
    const supabase = await createClient();
    const [{ data }, lib] = await Promise.all([
      supabase.from("user_list_items").select("list_id, tmdb_id, media_type").in("list_id", ids).limit(3000),
      getLibState(),
    ]);
    const out: Record<string, ListProgress> = {};
    for (const r of (data ?? []) as { list_id: string; tmdb_id: number; media_type: string }[]) {
      const p = (out[r.list_id] ??= { watched: 0, total: 0 });
      p.total++;
      if (lib.of(r.tmdb_id, r.media_type).watched) p.watched++;
    }
    return out;
  } catch {
    return {};
  }
}
