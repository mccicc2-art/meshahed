// محلّل تصدير TV Time — يعمل في المتصفح على ملفات المستخدم نفسها.
//
// TV Time أُغلق في يوليو ٢٠٢٦ وبقيت بأيدي الناس ملفات تصديرهم — بصيغٍ
// ثلاث تبدّلت عبر السنين: CSV قديم بمعرّفات TVDB (seen_episode.csv)،
// ثم CSV أحدث بالأسماء (tracking-prod-records)، ثم مجلدات JSON في آخر
// عهده. لا توثيق رسمياً لأيٍّ منها، فالمحلّل يشمّ الأعمدة والمفاتيح
// بمرادفاتها المعروفة بدل أن يفترض صيغةً واحدة — وما لم يفهمه يقوله
// بالاسم بدل أن يبتلعه بصمت.
//
// التحليل كله محليٌّ في المتصفح: ملف المستخدم لا يُرفع لأي خادم — تُرسل
// للخادم أسماءُ ومعرّفاتُ الأعمال للمطابقة مع TMDB فقط.

import type { ResolveRequest } from "./importer";

/** سجلٌّ خام كما فُهم من الملف — قبل مطابقته مع TMDB */
export type RawRecord =
  | { kind: "ep-name"; show: string; year?: number; s: number; e: number; at?: string }
  | { kind: "ep-tvdb"; episodeTvdbId: number; at?: string }
  | { kind: "show-tvdb"; tvdbId: number }
  | { kind: "movie-name"; name: string; year?: number; at?: string; rating?: number }
  | { kind: "rating-show"; show: string; rating: number };

export interface ParseOutcome {
  records: RawRecord[];
  /** ملفاتٌ قُرئت وفُهمت */
  parsedFiles: string[];
  /** ملفاتٌ لم تُفهم صيغتها — تُعرض للمستخدم بالاسم */
  skippedFiles: string[];
}

// ============================================================
//  فكّ zip بلا مكتبة: DecompressionStream يفكّ deflate والمتصفح
//  الحديث يحمله — قارئ الدليل المركزي وحده ما ينقصنا (~٥٠ سطراً)،
//  ومكتبةُ ضغطٍ كاملة لأجل قراءةٍ واحدة وزنٌ بلا داع.
// ============================================================

interface ZipEntry {
  name: string;
  bytes: Uint8Array;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function readZip(buf: ArrayBuffer): Promise<ZipEntry[]> {
  const b = new Uint8Array(buf);
  const dv = new DataView(buf);

  // سجلّ نهاية الدليل المركزي — يُبحث عنه من الذيل (قد يسبقه تعليق)
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 65535); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a zip");

  const count = dv.getUint16(eocd + 10, true);
  let off = dv.getUint32(eocd + 16, true);
  const entries: ZipEntry[] = [];

  for (let n = 0; n < count; n++) {
    if (dv.getUint32(off, true) !== 0x02014b50) break;
    const method = dv.getUint16(off + 10, true);
    const compSize = dv.getUint32(off + 20, true);
    const nameLen = dv.getUint16(off + 28, true);
    const extraLen = dv.getUint16(off + 30, true);
    const commentLen = dv.getUint16(off + 32, true);
    const localOff = dv.getUint32(off + 42, true);
    const name = new TextDecoder().decode(b.slice(off + 46, off + 46 + nameLen));
    off += 46 + nameLen + extraLen + commentLen;

    if (name.endsWith("/")) continue; // مجلد

    // الترويسة المحلية تحمل أطوالها الخاصة — قد تخالف المركزية
    const lNameLen = dv.getUint16(localOff + 26, true);
    const lExtraLen = dv.getUint16(localOff + 28, true);
    const start = localOff + 30 + lNameLen + lExtraLen;
    const raw = b.slice(start, start + compSize);

    try {
      const bytes = method === 8 ? await inflateRaw(raw) : method === 0 ? raw : null;
      if (bytes) entries.push({ name, bytes });
    } catch {
      /* مدخلٌ معطوب — نتجاوزه ونكمل البقية */
    }
  }
  return entries;
}

// ============================================================
//  CSV — قارئ RFC4180 مصغّر (اقتباسات، فواصل داخل الحقول، أسطر)
// ============================================================

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

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

function findCol(headers: string[], names: readonly string[]): number {
  const h = headers.map((x) => x.trim().toLowerCase());
  for (const n of names) {
    const i = h.indexOf(n);
    if (i >= 0) return i;
  }
  return -1;
}

function toInt(v: string | undefined): number | null {
  const n = Number(String(v ?? "").trim());
  return Number.isInteger(n) && n > 0 ? n : null;
}

function toDate(v: string | undefined): string | undefined {
  const s = String(v ?? "").trim();
  if (!s) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** «اسم العمل (2019)» — السنة تُفصل لأن بحث TMDB يقبلها معاملاً أدقّ */
function splitYear(name: string): { name: string; year?: number } {
  const m = name.match(/^(.*?)\s*\((\d{4})\)\s*$/);
  if (m) return { name: m[1].trim(), year: Number(m[2]) };
  return { name: name.trim() };
}

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

// ============================================================
//  من سجلاتٍ خام إلى طلبات مطابقة — بلا تكرار
// ============================================================

export interface GroupedRaw {
  /** مفتاح المجموعة → طلب المطابقة الواحد لها */
  requests: ResolveRequest[];
  keys: string[];
}

export function groupForResolve(records: RawRecord[]): GroupedRaw {
  const map = new Map<string, ResolveRequest>();
  for (const r of records) {
    if (r.kind === "ep-name" || r.kind === "rating-show") {
      const nm = r.kind === "ep-name" ? r.show : r.show;
      const year = r.kind === "ep-name" ? r.year : undefined;
      const key = `tv:${nm.toLowerCase()}:${year ?? ""}`;
      if (!map.has(key)) map.set(key, { kind: "name-tv", name: nm, year });
    } else if (r.kind === "movie-name") {
      const key = `mv:${r.name.toLowerCase()}:${r.year ?? ""}`;
      if (!map.has(key)) map.set(key, { kind: "name-movie", name: r.name, year: r.year });
    } else if (r.kind === "show-tvdb") {
      const key = `tvdb:${r.tvdbId}`;
      if (!map.has(key)) map.set(key, { kind: "tvdb-tv", id: r.tvdbId });
    } else if (r.kind === "ep-tvdb") {
      const key = `tvdbe:${r.episodeTvdbId}`;
      if (!map.has(key)) map.set(key, { kind: "tvdb-episode", id: r.episodeTvdbId });
    }
  }
  return { requests: [...map.values()], keys: [...map.keys()] };
}
