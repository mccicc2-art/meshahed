// قارئُ تصديرِ المتتبّعات التي تحمل معرّفات TMDB — Simkl أوّلها (D-154).
//
// **لماذا هذا الملفّ منفصلٌ عن `letterboxd.ts` و`tvtime.ts`:** ذانك يقرآن
// **أسماءً** فيحتاجان مطابقةً ببحث TMDB بكل مخاطرها (D-144). وهذا يقرأ
// **معرّفاً**، فالمطابقة قراءةُ حقل: صفرُ بحثٍ، صفرُ التباس، صفرُ سقوطٍ
// صامت — ولا رحلةَ خادمٍ واحدة للمطابقة أصلاً.
//
// **ولماذا JSON لا CSV عند Simkl:** تنزيل JSON عندهم **مجانيٌّ لكل
// الأعضاء**، وCSV ميزةُ Pro — وهي مع ذلك **أفقر**: بلا طوابع زمنية وبلا
// تتبّع حلقات (توثيقهم). فالمجاني هنا هو الأغنى، ولا مقايضة.
//
// **وقارئٌ يمشي على الشجرة لا يفترض شكلها:** بنيةُ نسخة Simkl الاحتياطية
// غير موثّقة رسمياً، وقد تتغيّر. فبدل أن نكتب مساراً ثابتاً
// (`data.shows[].seasons[]`) نمشي على الشجرة ونلتقط **كل كائنٍ يحمل
// معرّف TMDB وعنواناً** أينما كان. نفس منهج قارئ JSON في `tvtime.ts`،
// ولنفس السبب: ما لا يُوثَّق لا يُفترض.

import { parseCsv, readZip, type ParseOutcome, type RawRecord } from "./importParse";

/** أسماءٌ محتملة لكل معنى — الشجرة تعرّف نفسها ولا نفرض عليها اسماً */
const K = {
  tmdb: ["tmdb", "tmdb_id", "tmdbid", "themoviedb"],
  title: ["title", "name", "show_title", "movie_title"],
  rating: ["user_rating", "rating", "my_rating", "score"],
  watchedAt: ["last_watched_at", "watched_at", "watcheddate", "watched_date", "last_watched"],
  status: ["status", "watchlist_status", "list"],
  seasons: ["seasons"],
  episodes: ["episodes"],
  number: ["number", "episode", "episode_number"],
  seasonNumber: ["number", "season", "season_number"],
  animeType: ["anime_type", "type"],
  epCount: ["watched_episodes_count", "total_episodes", "episodes_count", "episodes_watched"],
} as const;

function get(o: Record<string, unknown>, names: readonly string[]): unknown {
  for (const k of Object.keys(o)) {
    if (names.includes(k.toLowerCase())) return o[k];
  }
  return undefined;
}

/** المعرّف قد يعود رقماً أو نصّاً، وقد يسكن `ids` أو الجذر */
function tmdbOf(o: Record<string, unknown>): number | null {
  const ids = o["ids"];
  const src = ids && typeof ids === "object" ? (ids as Record<string, unknown>) : o;
  const raw = get(src, K.tmdb) ?? get(o, K.tmdb);
  if (raw == null) return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  return Number.isInteger(n) && n > 0 ? n : null;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function num1to10(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 && n <= 10 ? Math.round(n) : undefined;
}

function iso(v: unknown): string | undefined {
  const s = str(v);
  if (!s) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** «أنوي مشاهدته» بأسمائه عند الخدمات — يدخل المكتبة بلا ختم مشاهدة */
function isPlanned(o: Record<string, unknown>): boolean {
  const s = str(get(o, K.status)).toLowerCase().replace(/[\s_-]/g, "");
  return s === "plantowatch" || s === "watchlist" || s === "plantowatchlist";
}

/**
 * **هل هذا الكائن عملٌ متتبَّع أصلاً؟**
 *
 * الشجرة مليئةٌ بكائناتٍ فيها `title` — عناوينُ الحلقات أوّلها. فلو
 * قبِلنا كلَّ ذي عنوانٍ لأرسلنا مئات أسماء الحلقات إلى بحث TMDB.
 * الدليل المقبول: **صندوق معرّفات، أو حالةُ قائمة، أو تقييمُ صاحبه** —
 * وهذه لا تكون إلا على العمل نفسه.
 */
function isTrackedItem(o: Record<string, unknown>): boolean {
  const ids = o["ids"];
  if (ids && typeof ids === "object") return true;
  if (str(get(o, K.status))) return true;
  return get(o, K.rating) != null && Array.isArray(get(o, K.seasons));
}

function episodesOf(o: Record<string, unknown>): { s: number; e: number; at?: string }[] {
  const out: { s: number; e: number; at?: string }[] = [];
  const seasons = get(o, K.seasons);
  if (!Array.isArray(seasons)) return out;

  for (const sRaw of seasons) {
    if (!sRaw || typeof sRaw !== "object") continue;
    const so = sRaw as Record<string, unknown>;
    const sNum = Number(get(so, K.seasonNumber));
    if (!Number.isInteger(sNum) || sNum < 0) continue;

    const eps = get(so, K.episodes);
    if (!Array.isArray(eps)) continue;
    for (const eRaw of eps) {
      if (!eRaw || typeof eRaw !== "object") continue;
      const eo = eRaw as Record<string, unknown>;
      const eNum = Number(get(eo, K.number));
      if (!Number.isInteger(eNum) || eNum <= 0) continue;
      out.push({ s: sNum, e: eNum, at: iso(get(eo, K.watchedAt)) });
    }
  }
  return out;
}

/**
 * **الفرز بين مسلسلٍ وفيلم — بالبيانات لا بالقائمة التي جاء منها.**
 *
 * الأنمي عند Simkl قائمةٌ ثالثة تضمّ الاثنين، فمن فرز بالقائمة جعل
 * «أكيرا» مسلسلاً بموسمٍ واحد. الدليل الحاسم **وجود المواسم**، ثم
 * `anime_type: "movie"` صراحةً. (نفس مبدأ `isTvProgram` في D-089:
 * تصنيفٌ بالبيانات لا بالاسم.)
 */
function looksLikeShow(o: Record<string, unknown>, eps: number): boolean {
  const type = str(get(o, K.animeType)).toLowerCase();
  if (type === "movie" || type === "film") return false;
  if (eps > 0) return true;
  if (Array.isArray(get(o, K.seasons))) return true;
  /* **عدّادُ الحلقات دليلٌ كافٍ ولو غابت الحلقات نفسها.** أمسك الاختبار
     هذا: أنميٌ تلفزيونيّ مكتملٌ بلا مصفوفة مواسم كان يُقرأ فيلماً —
     وأسوأ ما فيه أنه يمرّ صامتاً ويستقرّ في المكتبة بالنوع الخطأ. */
  if (get(o, K.epCount) != null) return true;
  // نوعٌ معلَنٌ ليس فيلماً (anime_type: "tv" مثلاً) — تصريحُ المصدر يُحترم
  return !!type;
}

function walkJson(text: string): RawRecord[] | null {
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch {
    return null;
  }

  const out: RawRecord[] = [];
  /* عملٌ واحد قد يظهر مرّتين في الشجرة (قائمةٌ وسجلّ) — والمعرّف يمنع
     تكراره، والأغنى يغلب: من حمل حلقاتٍ يزيح من جاء بلا حلقات */
  const seen = new Map<string, number>();

  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      for (const x of node) visit(x);
      return;
    }
    if (!node || typeof node !== "object") return;
    const o = node as Record<string, unknown>;

    const tmdbId = tmdbOf(o);
    const title = str(get(o, K.title));

    if (tmdbId && title) {
      const eps = episodesOf(o);
      const rating = num1to10(get(o, K.rating));
      const planned = isPlanned(o);
      const kind = looksLikeShow(o, eps.length) ? "tv" : "movie";
      const key = `${kind}:${tmdbId}`;
      const at = iso(get(o, K.watchedAt));

      const rec: RawRecord =
        kind === "tv"
          ? { kind: "tmdb-show", tmdbId, title, episodes: eps, rating, planned }
          : { kind: "tmdb-movie", tmdbId, title, at, rating, planned };

      const prev = seen.get(key);
      if (prev == null) {
        seen.set(key, out.length);
        out.push(rec);
      } else {
        const old = out[prev];
        // الأغنى يغلب: حلقاتٌ أكثر، أو تقييمٌ حيث لا تقييم
        if (old.kind === "tmdb-show" && rec.kind === "tmdb-show") {
          if (rec.episodes.length > old.episodes.length) old.episodes = rec.episodes;
          old.rating = old.rating ?? rec.rating;
          old.planned = old.planned && rec.planned;
        } else if (old.kind === "tmdb-movie" && rec.kind === "tmdb-movie") {
          old.at = old.at ?? rec.at;
          old.rating = old.rating ?? rec.rating;
          old.planned = old.planned && rec.planned;
        }
      }
    } else if (title && !tmdbId && isTrackedItem(o)) {
      /* **عملٌ متتبَّعٌ بلا معرّف TMDB** — شائعٌ في أنمي Simkl (معرّفاته
         anidb/mal). إسقاطُه صامتاً يخالف قاعدتنا «ما لا يُفهم يُقال
         بالاسم»، وتخمينُ معرّفٍ له يخالف درس D-144. فالحلّ الثالث:
         **يسقط إلى المطابقة بالاسم** كبقية المستوردات — فإن أكّدته TMDB
         دخل، وإلا ظهر لصاحبه في «لم تُطابَق» بالاسم ليضيفه بنفسه. */
      const eps2 = episodesOf(o);
      if (looksLikeShow(o, eps2.length)) {
        out.push({ kind: "rating-show", show: title, rating: num1to10(get(o, K.rating)) ?? 0 });
      } else {
        out.push({
          kind: "movie-name",
          name: title,
          at: iso(get(o, K.watchedAt)),
          rating: num1to10(get(o, K.rating)),
        });
      }
    }

    for (const v of Object.values(o)) if (v && typeof v === "object") visit(v);
  };

  visit(root);
  return out.length ? out : null;
}

/**
 * CSV احتياطاً — نسخةُ Simkl المدفوعة وبعضُ الأدوات تُخرج جدولاً.
 * **بلا حلقات ولا تواريخ** (توثيق Simkl نفسه)، فالعمل يدخل المكتبة
 * ويُقيَّم؛ والحلقات لا تُخترع.
 */
function fromCsv(text: string): RawRecord[] | null {
  const rows = parseCsv(text);
  if (rows.length < 2) return null;
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const at = (names: readonly string[]) => headers.findIndex((h) => names.includes(h));

  const cTmdb = at(K.tmdb);
  if (cTmdb < 0) return null; // بلا معرّف لا شأن لهذا القارئ بالملفّ
  const cTitle = at(K.title);
  const cRating = at(K.rating);
  const cStatus = at(K.status);
  const cAt = at(K.watchedAt);

  const out: RawRecord[] = [];
  for (const r of rows.slice(1)) {
    const n = Number(String(r[cTmdb] ?? "").trim());
    if (!Number.isInteger(n) || n <= 0) continue;
    const title = cTitle >= 0 ? str(r[cTitle]) : "";
    if (!title) continue;
    const rating = cRating >= 0 ? num1to10(r[cRating]) : undefined;
    const planned = cStatus >= 0 && isPlanned({ status: r[cStatus] });
    /* بلا مواسم في الجدول: يُقرأ فيلماً — واجتهادُ «مسلسلٌ بلا حلقات»
       يُدخل المكتبةَ عملاً يقول «لم يبدأ» وهو مكتمل، وهي كذبة */
    out.push({
      kind: "tmdb-movie",
      tmdbId: n,
      title,
      at: cAt >= 0 ? iso(r[cAt]) : undefined,
      rating,
      planned,
    });
  }
  return out.length ? out : null;
}

/** المدخل: نسخة Simkl الاحتياطية (zip فيه json) أو json/csv مفرد */
export async function parseTrackerExport(
  files: { name: string; buf: ArrayBuffer }[],
): Promise<ParseOutcome> {
  const records: RawRecord[] = [];
  const parsedFiles: string[] = [];
  const skippedFiles: string[] = [];

  const handle = async (name: string, buf: ArrayBuffer) => {
    const lower = name.toLowerCase();
    if (lower.endsWith(".zip")) {
      try {
        for (const entry of await readZip(buf)) {
          await handle(entry.name, entry.bytes.buffer as ArrayBuffer);
        }
      } catch {
        skippedFiles.push(name);
      }
      return;
    }

    const text = new TextDecoder().decode(buf);
    const got = lower.endsWith(".csv") ? fromCsv(text) : walkJson(text);
    if (got) {
      records.push(...got);
      parsedFiles.push(name);
    } else {
      skippedFiles.push(name);
    }
  };

  for (const f of files) await handle(f.name, f.buf);
  return { records, parsedFiles, skippedFiles };
}
