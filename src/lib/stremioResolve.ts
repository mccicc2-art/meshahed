import "server-only";
import { findByImdb, tvSeasonCounts } from "@/lib/tmdb";
import { imdbEpisodeOf, placeOnTmdb, type KitsuMapEntry } from "@/core/kitsuEpisode";
import type { StremioRef, StremioVideo } from "@/core/stremioId";

/**
 * 🆕 **معرّفُ Stremio ⇢ عملٌ في TMDB وحلقتُه** — مسارُ المصادر ومسارُ الترجمة يمرّان من هنا (أحمد ٢٢ أكتوبر «نبني دعم كيتسو»).
 *
 *  - **IMDb** (`tt…`): كما كان — `findByImdb`، والموسمُ والحلقةُ كما أرسلهما Stremio.
 *  - **Kitsu** (`kitsu:{id}[:{ep}]`): 🆕 R74 — **جدولُ ربط إضافة «Anime Kitsu» المنشورُ على GitHub** (Apache-2.0)، لا بيانُها
 *    الحيّ: خادمُها يحجب الخوادمَ السحابيّة (`meta_http_403` في R72، وحتى بهويّة Loopz في R73)، وGitHub لا يحجبنا. المدخلُ
 *    يعطي رقمَ IMDb ومبدأَ الترقيم، فنأخذ IMDb إلى TMDB كالمسار الأوّل، ونضع الحلقةَ على مواسم TMDB (`kitsuEpisode.ts` — سببُه هناك).
 *
 * ⚖️ **لا جسرَ ⇐ لا إشارة** (`null`): أنمي ليس في الجدول، أو بلا رقم IMDb، أو حلقةٌ لا يسعها TMDB — يسكت سطرُنا لهذا العمل
 * وحده كما يسكت لعملٍ لا يعرفه TMDB، ولا يُخمَّن عملٌ بالاسم.
 */
const KITSU_MAP =
  "https://raw.githubusercontent.com/TheBeastLT/stremio-kitsu-anime/master/static/data/imdb_mapping.json";

/**
 * 🆕 R72 — **سطرُ تشخيصٍ لطلبات أنمي Kitsu** (أحمد ٢٢ أكتوبر «نفذ وارفع»؛ يُزال بطلبه): القائمةُ الفارغةُ لا تفرّق بين «لم يُسأل»
 * و«سُئل وفشل». فسطرٌ واحدٌ لكلِّ طلبٍ في سجلّ Vercel: المرحلةُ التي وقف عندها والمدّة — **رقمُ Kitsu والحلقةُ وحدَهما**، لا رمزَ
 * ولا عضو. ولا يغيّر ردّاً، وفشلُه لا يُفشل الطلب.
 */
function trace(fields: Record<string, unknown>) {
  try {
    console.log(`[stremio-kitsu] ${JSON.stringify(fields)}`);
  } catch {
    /* السجلُّ لا يُفشل طلباً */
  }
}

/** معرّفٌ فيه `kitsu` رفضه المحلّل — يفرّق «لم يُسأل» عن «سُئل بشكلٍ لا نعرفه» (النوعُ والمعرّفُ وحدَهما، ٨٠ محرفاً) */
export function traceRejected(type: string, id: string) {
  if (/kitsu/i.test(id)) trace({ stage: "parse_rejected", type: type.slice(0, 20), id: id.slice(0, 80) });
}

/**
 * الجدولُ (~٨٥٠ ك.ب، ~٧ آلاف مدخل): كاشُ Next نصفَ يوم للتنزيل، وفهرسٌ في ذاكرة النسخة لا يُعاد بناؤه مع كلِّ طلب —
 * Stremio يسأل عن الحلقة مرّتين على الأقلّ (فتحٌ ثمّ تشغيل). والفشلُ لا يُحفظ: الطلبُ التالي يحاول من جديد.
 */
const MAP_TTL_MS = 43_200_000;
let mapCache: { at: number; byId: Map<number, KitsuMapEntry> } | null = null;

async function kitsuMap(): Promise<{ byId: Map<number, KitsuMapEntry> | null; why: string }> {
  if (mapCache && Date.now() - mapCache.at < MAP_TTL_MS) return { byId: mapCache.byId, why: "ok" };
  try {
    const res = await fetch(KITSU_MAP, {
      next: { revalidate: 43_200 },
      signal: AbortSignal.timeout(6_000),
      headers: { "User-Agent": "Loopz/1.0 (+https://loopztv.com)", Accept: "application/json" },
    });
    if (!res.ok) return { byId: null, why: `http_${res.status}` };
    const rows = (await res.json()) as unknown;
    if (!Array.isArray(rows)) return { byId: null, why: "bad_shape" };
    const byId = new Map<number, KitsuMapEntry>();
    for (const r of rows as KitsuMapEntry[]) {
      const id = Number(r?.kitsu_id);
      if (Number.isInteger(id) && id > 0) byId.set(id, r);
    }
    mapCache = { at: Date.now(), byId };
    return { byId, why: "ok" };
  } catch (e) {
    return { byId: null, why: e instanceof Error ? `error_${e.name}` : "error" };
  }
}

const IMDB = /^tt\d{5,10}$/;

export async function resolveStremioRef(ref: StremioRef): Promise<{ video: StremioVideo; tmdbId: number } | null> {
  if (ref.kind !== "kitsu") {
    const tmdbId = await findByImdb(ref.imdb, ref.kind);
    return tmdbId ? { video: ref, tmdbId } : null;
  }

  const t0 = Date.now();
  const done = (stage: string, extra: Record<string, unknown> = {}) =>
    trace({ kitsu: ref.kitsu, episode: ref.episode, stage, ms: Date.now() - t0, ...extra });

  const { byId, why } = await kitsuMap();
  if (!byId) return done(`map_${why}`), null;
  const entry = byId.get(ref.kitsu);
  if (!entry) return done("not_in_map"), null;
  const imdb = entry.imdb_id;
  if (!imdb || !IMDB.test(imdb)) return done("no_imdb"), null;

  if (ref.episode === null) {
    const tmdbId = await findByImdb(imdb, "movie");
    if (!tmdbId) return done("tmdb_not_found", { imdb }), null;
    done("ok", { imdb, tmdbId });
    return { video: { kind: "movie", imdb }, tmdbId };
  }

  const at = imdbEpisodeOf(entry, ref.episode);
  if (!at) return done("no_imdb_episode", { imdb }), null;
  const tmdbId = await findByImdb(imdb, "tv");
  if (!tmdbId) return done("tmdb_not_found", { imdb, imdbAt: at }), null;
  const seasons = await tvSeasonCounts(tmdbId);
  const placed = placeOnTmdb(seasons, at);
  if (!placed) return done("no_place", { imdb, tmdbId, imdbAt: at, seasons: seasons.length }), null;
  done("ok", { imdb, tmdbId, imdbAt: at, season: placed.season, ep: placed.episode });
  return { video: { kind: "tv", imdb, season: placed.season, episode: placed.episode }, tmdbId };
}
