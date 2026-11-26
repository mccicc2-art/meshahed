import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getMovieIn, getTvIn } from "@/lib/tmdb";
import { getLocale } from "@/lib/locale";
import { parseLinkRow, type LinkSignalRow } from "@/core/linkSignals";

/**
 * ====== أسطرُ الجرس من الربوط — الخادم (المهمّة ٥٦١، الهجرة ٢٦٩) ======
 *
 * 🔑 **بجانب أسطر الأشخاص لا داخلها** (`my_link_signals` دالّةٌ وحدَها): الجرسُ القائمُ وشارتُه بالحساب نفسِه، والجديدُ يُجمع إليهما هنا
 * — فنسخةٌ لا تعرف الأسطرَ الجديدة لا ترى رقماً بلا سطر، والكودُ يسبق الهجرةَ بلا كسر (الدالّةُ غائبة ⇒ قائمةٌ فارغة).
 */

/** أسماءٌ تُطلب من TMDB في الطلب الواحد على الأكثر — الباقي يبقى سطراً بلا اسم («شغّلت عملاً…») */
const NAME_LOOKUPS = 12;

/** أسطرُ الجرس من الربوط بلغة القارئ — ما غاب اسمُه من المكتبة يُسأل عنه TMDB (مخبَّأٌ ساعة) */
export async function myLinkSignals(): Promise<LinkSignalRow[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("my_link_signals");
    /* قبل الهجرة (الدالّةُ غائبة) أو خطأٌ عابر: الجرسُ بأسطر الأشخاص كما كان */
    if (error) return [];
    const rows = ((data ?? []) as unknown[]).map(parseLinkRow).filter((r): r is LinkSignalRow => !!r);
    const need = rows.filter((r) => !r.title && r.tmdbId && r.mediaType).slice(0, NAME_LOOKUPS);
    if (need.length) {
      const lang = (await getLocale()) === "en" ? "en-US" : "ar-SA";
      const names = new Map<string, string>();
      await Promise.all(
        [...new Set(need.map((r) => `${r.mediaType}-${r.tmdbId}`))].map(async (k) => {
          const [kind, id] = k.split("-");
          try {
            const d = kind === "tv" ? await getTvIn(Number(id), lang) : await getMovieIn(Number(id), lang);
            const n = ((d as { name?: string }).name ?? (d as { title?: string }).title ?? "").trim();
            if (n) names.set(k, n);
          } catch {
            /* بلا اسم — الجملةُ تقوم بدونه */
          }
        }),
      );
      for (const r of rows) if (!r.title && r.tmdbId && r.mediaType) r.title = names.get(`${r.mediaType}-${r.tmdbId}`) ?? null;
    }
    return rows;
  } catch {
    return [];
  }
}

/** الجديدُ منها بعد آخر فتحةٍ للجرس — يُجمع إلى `unread_signals` في الشارة */
export async function unreadLinkSignals(): Promise<number> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("my_link_signals");
    if (error) return 0;
    return ((data ?? []) as { is_new?: unknown }[]).filter((r) => r.is_new === true).length;
  } catch {
    return 0;
  }
}
