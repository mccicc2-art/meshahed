// محلّل تصدير TV Time — يعمل في المتصفح على ملفات المستخدم نفسها.
//
// TV Time أُغلق في يوليو ٢٠٢٦ وبقيت بأيدي الناس ملفات تصديرهم — بصيغٍ
// ثلاث تبدّلت عبر السنين: CSV قديم بمعرّفات TVDB (seen_episode.csv)،
// ثم CSV أحدث بالأسماء (tracking-prod-records)، ثم مجلدات JSON في آخر
// عهده. لا توثيق رسمياً لأيٍّ منها، فالمحلّل يشمّ الأعمدة والمفاتيح
// بمرادفاتها المعروفة بدل أن يفترض صيغةً واحدة — وما لم يفهمه يقوله
// بالاسم بدل أن يبتلعه بصمت.
//
// ⚠️ **عُدّةُ القراءة نفسها انتقلت إلى `importParse.ts` (D-153)** — فكُّ
// الـzip وقارئ CSV وشمُّ الأعمدة وتجميع الطلبات صارت مشتركةً مع
// Letterboxd. ما بقي هنا هو **معرفةُ TV Time وحدها**: أسماء أعمدتها
// وصيغُها الثلاث.

import {
  findCol,
  parseCsv,
  readZip,
  splitYear,
  toDate,
  toInt,
  type ParseOutcome,
  type RawRecord,
} from "./importParse";

export { groupForResolve, type GroupedRaw, type ParseOutcome, type RawRecord } from "./importParse";

// ============================================================
//  الاستدلال على المعنى: أسماء الأعمدة/المفاتيح بمرادفاتها
// ============================================================

const COL = {
  showName: ["series_name", "tv_show_name", "show_name", "series", "show"],
  season: ["episode_season_number", "season_number", "season"],
  episode: ["episode_number", "number", "episode"],
  at: ["created_at", "watched_at", "date", "updated_at"],
  movieName: ["movie_name", "movie_title"],
  entity: ["entity_type", "type", "item_type"],
  rating: ["rating"],
  showTvdb: ["tv_show_id", "series_id", "tvdb_id"],
  epTvdb: ["episode_id"],
} as const;





function parseCsvRecords(name: string, text: string): RawRecord[] | null {
  const rows = parseCsv(text);
  if (rows.length < 2) return null;
  const headers = rows[0];
  const out: RawRecord[] = [];

  const cShow = findCol(headers, COL.showName);
  const cSeason = findCol(headers, COL.season);
  const cEp = findCol(headers, COL.episode);
  const cAt = findCol(headers, COL.at);
  const cMovie = findCol(headers, COL.movieName);
  const cEntity = findCol(headers, COL.entity);
  const cRating = findCol(headers, COL.rating);
  const cShowTvdb = findCol(headers, COL.showTvdb);
  const cEpTvdb = findCol(headers, COL.epTvdb);

  // «تتبّع» الحديث: أسماءٌ وأرقام مواسم — الصيغة الأوسع بين أيدي الناس
  if (cShow >= 0 && cSeason >= 0 && cEp >= 0) {
    for (const r of rows.slice(1)) {
      const s = toInt(r[cSeason]);
      const e = toInt(r[cEp]);
      const show = String(r[cShow] ?? "").trim();
      if (!show || s == null || e == null) continue;
      const { name: nm, year } = splitYear(show);
      out.push({ kind: "ep-name", show: nm, year, s, e, at: cAt >= 0 ? toDate(r[cAt]) : undefined });
    }
  }

  // أفلامٌ في الصيغة نفسها أو في ملفٍ خاص
  if (cMovie >= 0) {
    for (const r of rows.slice(1)) {
      const nm = String(r[cMovie] ?? "").trim();
      if (!nm) continue;
      const entity = cEntity >= 0 ? String(r[cEntity] ?? "").toLowerCase() : "";
      if (entity && !/movie|watch/.test(entity)) continue;
      const { name: n2, year } = splitYear(nm);
      const rating = cRating >= 0 ? toInt(r[cRating]) ?? undefined : undefined;
      out.push({ kind: "movie-name", name: n2, year, at: cAt >= 0 ? toDate(r[cAt]) : undefined, rating });
    }
  }

  // العتيق: seen_episode.csv بمعرّف حلقة TVDB — يُحلّ عبر /find في TMDB
  if (!out.length && cEpTvdb >= 0) {
    for (const r of rows.slice(1)) {
      const id = toInt(r[cEpTvdb]);
      if (id == null) continue;
      out.push({ kind: "ep-tvdb", episodeTvdbId: id, at: cAt >= 0 ? toDate(r[cAt]) : undefined });
    }
  }

  // followed_tv_show.csv: متابعةٌ بلا حلقات — تدخل المكتبة «لم يبدأ»
  if (!out.length && cShowTvdb >= 0 && /follow/i.test(name)) {
    for (const r of rows.slice(1)) {
      const id = toInt(r[cShowTvdb]);
      if (id != null) out.push({ kind: "show-tvdb", tvdbId: id });
    }
  }

  return out.length ? out : null;
}

// JSON: نمشي على الشجرة ونلتقط ما يشبه سجلّ حلقةٍ أو فيلمٍ أو تقييم
function pick(o: Record<string, unknown>, names: readonly string[]): unknown {
  for (const k of Object.keys(o)) {
    if (names.includes(k.toLowerCase())) return o[k];
  }
  return undefined;
}

function parseJsonRecords(text: string): RawRecord[] | null {
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch {
    return null;
  }
  const out: RawRecord[] = [];

  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      for (const x of node) visit(x);
      return;
    }
    if (!node || typeof node !== "object") return;
    const o = node as Record<string, unknown>;

    const s = toInt(String(pick(o, COL.season) ?? ""));
    const e = toInt(String(pick(o, COL.episode) ?? ""));
    let show = pick(o, COL.showName);
    // الاسم قد يكون كائناً متداخلاً {series:{name}} — نغوص درجةً واحدة
    if (show && typeof show === "object") show = pick(show as Record<string, unknown>, ["name", "title"]);
    const at = toDate(String(pick(o, COL.at) ?? ""));

    if (typeof show === "string" && show.trim() && s != null && e != null) {
      const { name, year } = splitYear(show);
      out.push({ kind: "ep-name", show: name, year, s, e, at });
    } else {
      const movie = pick(o, [...COL.movieName, "title", "name"]);
      const entity = String(pick(o, COL.entity) ?? "").toLowerCase();
      const rating = toInt(String(pick(o, COL.rating) ?? ""));
      if (typeof movie === "string" && movie.trim() && /movie/.test(entity)) {
        const { name, year } = splitYear(movie);
        out.push({ kind: "movie-name", name, year, at, rating: rating ?? undefined });
      } else if (typeof show === "string" && show.trim() && rating != null && s == null) {
        out.push({ kind: "rating-show", show: splitYear(show).name, rating });
      }
    }
    for (const v of Object.values(o)) if (v && typeof v === "object") visit(v);
  };

  visit(root);
  return out.length ? out : null;
}

// ============================================================
//  المدخل: ملفات المستخدم كما رفعها (zip أو csv أو json)
// ============================================================

export async function parseTvTimeFiles(
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
    const got = lower.endsWith(".csv")
      ? parseCsvRecords(lower, text)
      : lower.endsWith(".json")
        ? parseJsonRecords(text)
        : null;
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
