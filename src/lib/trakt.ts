// Trakt — عميل خادمٍ صغير للاستيراد. لا يُستورد في المتصفّح أبداً.
//
// لماذا Trakt أسهل من TV Time: كل عملٍ في ردّه يحمل معرّفاته كلها
// (`ids.tmdb` و`ids.tvdb` و`ids.imdb`)، فلا بحث بالاسم ولا تخمين —
// المطابقة قراءةُ حقل. والمشاهدات تأتي مجمّعة: المسلسل ومواسمه وحلقاته
// في كائنٍ واحد.

const API = "https://api.trakt.tv";

/**
 * 🆕 R275 — **PKCE لا السرّ** (اكتُشف ١٩ نوفمبر عند إنشاء تطبيق Loopz في بوّابة مطوّري Trakt الجديدة): التطبيقاتُ الجديدة
 * «Not issued» للـClient Secret — تسجّل الدخول بـPKCE وحده. فالمفتاحُ المطلوبُ واحد (`TRAKT_CLIENT_ID`)، والسرُّ إن وُجد
 * (تطبيقٌ قديم) يُرسَل ولا يُشترط. والتحقّقُ في كلِّ رحلةٍ مُتحقِّقٌ عشوائيٌّ يُحفظ في كوكي ويُرسل بصمتُه (S256) فقط.
 */
export function traktConfigured() {
  return !!process.env.TRAKT_CLIENT_ID;
}

const b64url = (buf: ArrayBuffer | Uint8Array) =>
  Buffer.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** مُتحقِّقُ PKCE (٤٣–١٢٨ حرفاً من الأبجديّة المسموحة) وبصمتُه S256 */
export async function traktPkce(): Promise<{ verifier: string; challenge: string }> {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  return { verifier, challenge };
}

export function traktAuthorizeUrl(redirectUri: string, state: string, challenge: string) {
  const u = new URL("https://trakt.tv/oauth/authorize");
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", process.env.TRAKT_CLIENT_ID ?? "");
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("state", state);
  u.searchParams.set("code_challenge", challenge);
  u.searchParams.set("code_challenge_method", "S256");
  return u.toString();
}

/** السرُّ يُرفق إن وُجد (تطبيقٌ قديم) ولا يُشترط — تطبيقُ PKCE بلا سرّ */
const secret = () => (process.env.TRAKT_CLIENT_SECRET ? { client_secret: process.env.TRAKT_CLIENT_SECRET } : {});

export async function traktToken(code: string, redirectUri: string, verifier: string): Promise<string | null> {
  try {
    const res = await fetch(`${API}/oauth/token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      /* A-28 — مهلةٌ كي لا يحبس Trakt المتعثّرُ الطلبَ حتى حدّ الدالّة؛ تسقط في `catch` ⇒ null */
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        code,
        client_id: process.env.TRAKT_CLIENT_ID,
        ...secret(),
        code_verifier: verifier,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { access_token?: string };
    return j.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * 🆕 R273 — **فكُّ الربط بعد الاستيراد** (أحمد ١٩ نوفمبر: «نبي نفعّل الاستيراد من تراكت»).
 * الحسابُ المجانيُّ في Trakt يسمح اليوم بتطبيقٍ واحدٍ مربوطٍ فقط؛ ونحن لا نحتاج الربطَ إلّا لحظةَ الاستيراد. فالمفتاحُ يُلغى
 * فورَ انتهاء الجلب — ومن ربط Plex أو Infuse لا يخسر مكانَه عندنا إلّا ثوانيَ الاستيراد. والفشلُ صمت: مفتاحٌ لم يُلغَ
 * ينتهي وحدَه، ولا يستحقّ أن يُسقط استيراداً نجح.
 */
export async function traktRevoke(token: string): Promise<void> {
  try {
    await fetch(`${API}/oauth/revoke`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
      body: JSON.stringify({ token, client_id: process.env.TRAKT_CLIENT_ID, ...secret() }),
    });
  } catch {
    /* صمت */
  }
}

async function traktGet<T>(path: string, token: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, {
      headers: {
        "content-type": "application/json",
        "trakt-api-version": "2",
        "trakt-api-key": process.env.TRAKT_CLIENT_ID ?? "",
        authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      /* A-28 — المهلةُ نفسُها */
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

interface TraktIds {
  tmdb?: number | null;
  tvdb?: number | null;
  imdb?: string | null;
}

interface TraktWatchedShow {
  show?: { title?: string; year?: number; ids?: TraktIds };
  seasons?: {
    number?: number;
    episodes?: { number?: number; last_watched_at?: string }[];
  }[];
}

interface TraktWatchedMovie {
  movie?: { title?: string; year?: number; ids?: TraktIds };
  last_watched_at?: string;
}

interface TraktRating {
  rating?: number;
  show?: { ids?: TraktIds };
  movie?: { ids?: TraktIds };
}

export interface TraktHarvest {
  shows: {
    tmdbId: number;
    title: string;
    episodes: { s: number; e: number; at?: string }[];
    rating?: number;
  }[];
  movies: { tmdbId: number; title: string; at?: string; rating?: number }[];
  /** ما لا معرّف TMDB له عند Trakt — يُعرض بالاسم بدل أن يُبتلع */
  unmatched: string[];
}

/**
 * جمعُ كل ما يلزم في أربعة طلبات.
 *
 * `/sync/watched` يعطي المشاهد التاريخية مجمّعةً (لا سجلّاً بكل مشاهدة)،
 * وهو المطلوب هنا: نريد «ماذا شاهد» لا «كم مرّة». وتاريخ آخر مشاهدةٍ
 * للحلقة يكفي لليوميات.
 */
export async function harvestTrakt(token: string): Promise<TraktHarvest> {
  const [ws, wm, rs, rm] = await Promise.all([
    traktGet<TraktWatchedShow[]>("/sync/watched/shows", token),
    traktGet<TraktWatchedMovie[]>("/sync/watched/movies", token),
    traktGet<TraktRating[]>("/sync/ratings/shows", token),
    traktGet<TraktRating[]>("/sync/ratings/movies", token),
  ]);

  const showRating = new Map<number, number>();
  for (const r of rs ?? []) {
    const id = r.show?.ids?.tmdb;
    if (id && r.rating) showRating.set(id, r.rating);
  }
  const movieRating = new Map<number, number>();
  for (const r of rm ?? []) {
    const id = r.movie?.ids?.tmdb;
    if (id && r.rating) movieRating.set(id, r.rating);
  }

  const unmatched: string[] = [];

  const shows: TraktHarvest["shows"] = [];
  for (const row of ws ?? []) {
    const tmdbId = row.show?.ids?.tmdb;
    const title = row.show?.title ?? "";
    if (!tmdbId) {
      if (title) unmatched.push(title);
      continue;
    }
    const episodes: { s: number; e: number; at?: string }[] = [];
    for (const season of row.seasons ?? []) {
      const s = season.number;
      if (s == null) continue;
      for (const ep of season.episodes ?? []) {
        if (ep.number == null) continue;
        episodes.push({ s, e: ep.number, at: ep.last_watched_at ?? undefined });
      }
    }
    shows.push({ tmdbId, title, episodes, rating: showRating.get(tmdbId) });
  }

  const movies: TraktHarvest["movies"] = [];
  for (const row of wm ?? []) {
    const tmdbId = row.movie?.ids?.tmdb;
    const title = row.movie?.title ?? "";
    if (!tmdbId) {
      if (title) unmatched.push(title);
      continue;
    }
    movies.push({
      tmdbId,
      title,
      at: row.last_watched_at ?? undefined,
      rating: movieRating.get(tmdbId),
    });
  }

  return { shows, movies, unmatched };
}
