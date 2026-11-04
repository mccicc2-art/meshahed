import "server-only";
import type { FribbEntry } from "@/core/kitsuEpisode";

/**
 * ====== جدولُ Fribb (`anime-lists`) — الفهرسُ الواحد لقارئيه ======
 *
 * 🔑 **قارئان لجدولٍ واحد** (D-145): Stremio يسأل برقم Kitsu (R77)، واستيرادُ MyAnimeList برقم MAL (أحمد ٤ نوفمبر). كان التنزيلُ
 * داخل `stremioResolve.ts`؛ ونسخةٌ ثانيةٌ منه تعني ٧٫٥ م.ب تُنزَّل مرّتين في النسخة الواحدة وفهرسين يفترقان — فخرج إلى هنا.
 *
 * ⚖️ ~٧٫٥ م.ب: أكبرُ من كاش Next (٢ م.ب) فلا يُحفظ هناك — يُنزَّل عند أوّل حاجة ويبقى فهرسُه في ذاكرة النسخة نصفَ يوم،
 * والفشلُ لا يُحفظ (الطلبُ التالي يحاول). وتنزيلان متزامنان يشتركان في رحلةٍ واحدة.
 *
 * 🆕 `malPerTv`: **كم عملاً من MAL يشغل مواسمَ عاديّةً من مسلسل TMDB الواحد** — مدخلٌ بلا موسمٍ صريح يُقرأ ترقيماً متّصلاً من أوّل العمل
 * (One Piece: عملٌ واحدٌ في MAL، مواسمُ في TMDB) **فقط إن كان وحيدَ مسلسله**؛ وإلّا فموضعُه تخمينٌ («٣ أ»: لا يُخمَّن).
 */
const FRIBB = "https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-full.json";
const TTL_MS = 43_200_000;

export type FribbIndex = {
  byKitsu: Map<number, FribbEntry>;
  byMal: Map<number, FribbEntry>;
  malPerTv: Map<number, number>;
};

let cache: { at: number; idx: FribbIndex } | null = null;
let inflight: Promise<{ idx: FribbIndex | null; why: string }> | null = null;

const pos = (n: unknown): n is number => Number.isInteger(n) && (n as number) > 0;

export async function fribbIndex(): Promise<{ idx: FribbIndex | null; why: string }> {
  if (cache && Date.now() - cache.at < TTL_MS) return { idx: cache.idx, why: "ok" };
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch(FRIBB, {
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
        headers: { "User-Agent": "Loopz/1.0 (+https://loopztv.com)", Accept: "application/json" },
      });
      if (!res.ok) return { idx: null, why: `http_${res.status}` };
      const rows = (await res.json()) as unknown;
      if (!Array.isArray(rows)) return { idx: null, why: "bad_shape" };
      const idx: FribbIndex = { byKitsu: new Map(), byMal: new Map(), malPerTv: new Map() };
      for (const r of rows as FribbEntry[]) {
        const tv = r?.themoviedb_id?.tv;
        /* ما بلا رقم TMDB لا ينفع أحداً — لا يُحفظ في الذاكرة */
        const m = r?.themoviedb_id?.movie;
        if (!pos(tv) && !pos(Array.isArray(m) ? m[0] : m)) continue;
        if (pos(r.kitsu_id) && pos(tv)) idx.byKitsu.set(r.kitsu_id, r);
        if (pos(r.mal_id)) {
          idx.byMal.set(r.mal_id, r);
          /* يُعدّ ما يشغل مواسمَ عاديّة وحده (بلا موسمٍ أو موسمٌ ≥ ١) — أفلامُ ناروتو وأوفاه في الموسم ٠ لا تزاحم مسلسلَه */
          const season = r.season?.tmdb;
          if (pos(tv) && (season == null || season >= 1)) idx.malPerTv.set(tv, (idx.malPerTv.get(tv) ?? 0) + 1);
        }
      }
      cache = { at: Date.now(), idx };
      return { idx, why: "ok" };
    } catch (e) {
      return { idx: null, why: e instanceof Error ? `error_${e.name}` : "error" };
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
