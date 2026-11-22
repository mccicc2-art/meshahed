import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getTv } from "@/lib/tmdb";
import { episodeKey } from "@/core/keys";
import { nextUnwatchedEpisode } from "@/core/progress";
import { skipKeysForTv } from "@/core/skipProgress";
import { skipModeOf } from "@/lib/skipProgress";

/** أقصى ما يُحسب له قرصُ «الحلقة التالية» في ملفٍّ واحد — سقفُ المكتبة نفسُه (T492) وحدُّ الدالّة */
const NEXT_CAP = 80;
/** مهلةُ تفاصيل العمل الواحد: خبيئةٌ تردّ في أجزاء الثانية، ورحلةُ TMDB باردةٌ لا تحبس الملفّ */
const NEXT_WAIT_MS = 1_500;

/**
 * 🆕 T523 — **قرصُ «الحلقة التالية» على ملصقات ملفِّ عضو** (أحمد ٢٢ نوفمبر: «اللي يدخل ملفي يشوف انا وش شفت و وين واصل فيه»،
 * «١٩ مثل ف المكتبة»): الحسابُ حسابُ المكتبة حرفاً (`nextUnwatchedEpisode` · فلرُ صاحب الملفّ · بدايةُ إعادته) لكن **بحلقات
 * صاحب الملفّ لا القارئ** — من `profile_episode_keys` (الهجرة ٢٦٢) بحارس `can_view_profile` نفسِه الذي يحرس خيطَ التقدّم.
 * غيابُ الدالّة (الكودُ قبل الهجرة) أو فشلُها ⇒ خريطةٌ فارغة: الملصقُ بلا قرص، لا ملفٌّ مكسور.
 */
export async function profileNextEpisodes(ownerId: string, showIds: readonly number[]): Promise<Map<number, { s: number; e: number }>> {
  const out = new Map<number, { s: number; e: number }>();
  const ids = [...new Set(showIds)].slice(0, NEXT_CAP);
  if (!ids.length) return out;
  try {
    const sb = await createClient();
    const timeout = <T,>(p: Promise<T>) => Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), NEXT_WAIT_MS))]);
    const [rows, tvs] = await Promise.all([
      readKeys(sb, ownerId, ids),
      Promise.all(ids.map((id) => timeout(getTv(id)).catch(() => null))),
    ]);
    if (!rows) return out;
    const mode = skipModeOf({ skip_mode: rows[0]?.skip_mode ?? null });
    const keys = new Map<number, Set<string>>();
    for (const r of rows) {
      let set = keys.get(r.show_tmdb_id);
      if (!set) keys.set(r.show_tmdb_id, (set = new Set()));
      set.add(episodeKey(r.season_number, r.episode_number));
    }
    ids.forEach((id, n) => {
      const tv = tvs[n];
      if (!tv) return;
      const next = nextUnwatchedEpisode(tv, keys.get(id) ?? new Set(), skipKeysForTv(tv, mode));
      if (next) out.set(id, { s: next.season, e: next.episode });
    });
  } catch {
    /* زينةٌ لا شرط — الملصقُ يُرسم بلا قرص */
  }
  return out;
}

type KeyRow = { show_tmdb_id: number; season_number: number; episode_number: number; skip_mode: string | null };

/** PostgREST يردّ ألفَ صفٍّ على الأكثر للطلب — صفحاتٌ حتى لا تضيع حلقات (نهجُ `pageAll` في `lib/data`). خطأٌ ⇒ `null` */
async function readKeys(sb: Awaited<ReturnType<typeof createClient>>, ownerId: string, ids: number[]): Promise<KeyRow[] | null> {
  const PAGE = 1000;
  const rows: KeyRow[] = [];
  for (let from = 0; from < 100_000; from += PAGE) {
    const { data, error } = await sb.rpc("profile_episode_keys", { target: ownerId, p_shows: ids }).range(from, from + PAGE - 1);
    if (error) return null;
    const page = (data ?? []) as KeyRow[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows;
}
