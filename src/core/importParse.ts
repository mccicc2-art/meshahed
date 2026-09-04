// عُدّةُ قراءة ملفات التصدير — **مشتركة بين كل الخدمات، لا خاصّة بواحدة**.
//
// كانت هذه الأدوات كلُّها داخل `tvtime.ts` لأنه كان المستورد الوحيد. ثم
// جاء Letterboxd (D-153) يحتاج **نفس** فكّ الـzip ونفس قارئ CSV ونفس
// شمّ الأعمدة ونفس تجميع طلبات المطابقة — ولو استوردها من `tvtime.ts`
// لصار «ليتربوكسد يعتمد على تي‑في‑تايم»، وهو كذبٌ في شجرة الاعتماد؛
// ولو نُسخت لصار عندنا قارئا CSV ينحرفان عند أوّل إصلاح (قاعدة D-145).
//
// فالعُدّة هنا، وكل خدمةٍ ملفٌّ رقيق فوقها: **مصنعٌ واحد، سجلّاتٌ عدّة**
// — نفس شكل `SectionOrderList` في التخصيص (D-129).
//
// والتحليل كلُّه محليٌّ في المتصفّح: ملف المستخدم لا يُرفع لأي خادم —
// تُرسل للخادم أسماءُ الأعمال ومعرّفاتُها للمطابقة مع TMDB فقط (D-041).

import type { ResolveRequest } from "./importer";

/** سجلٌّ خام كما فُهم من الملف — قبل مطابقته مع TMDB */
export type RawRecord =
  | { kind: "ep-name"; show: string; year?: number; s: number; e: number; at?: string }
  | { kind: "ep-tvdb"; episodeTvdbId: number; at?: string }
  | { kind: "show-tvdb"; tvdbId: number }
  | { kind: "movie-name"; name: string; year?: number; at?: string; rating?: number }
  /* فيلمٌ في قائمة المشاهدة لاحقاً — يدخل المكتبة بلا صفّ مشاهدة (D-153).
     `applyImportChunk` يفهمه أصلاً: `watched:false` يكتب `follows` وحدها */
  | { kind: "movie-watchlist"; name: string; year?: number }
  | { kind: "rating-show"; show: string; rating: number }
  /* عملٌ وصل **بمعرّف TMDB جاهز** (Simkl، D-154) — لا يحتاج مطابقةً
     أصلاً: لا رحلةَ خادم، ولا بحثَ اسمٍ يخطئ. ولهذا `groupForResolve`
     تتجاهله عمداً، و`ImportPanel` يبنيه مباشرةً */
  | {
      kind: "tmdb-show";
      tmdbId: number;
      title: string;
      episodes: { s: number; e: number; at?: string }[];
      rating?: number;
      planned?: boolean;
    }
  | {
      kind: "tmdb-movie";
      tmdbId: number;
      title: string;
      at?: string;
      rating?: number;
      planned?: boolean;
    };

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
//  شمُّ الأعمدة — بمرادفاتها لا بأسمائها الحرفية
// ============================================================

/**
 * **لماذا مرادفاتٌ لا أسماءٌ ثابتة، وهي قاعدةٌ لا تحسين:** لا Letterboxd
 * ولا TV Time ينشران ترويسات **التصدير** رسمياً (صفحة Letterboxd توثّق
 * صيغة **الاستيراد** — وهي غير صيغة التصدير، ومن خلط بينهما كتب محلّلاً
 * لا يعمل). فالشمّ يجعل الملفّ يعرّف نفسه، وتغييرُ حرفٍ في الترويسة عند
 * الخدمة لا يُسقط الاستيراد صامتاً. وما لم يُفهم **يُقال بالاسم** في
 * `skippedFiles` بدل أن يُبتلع.
 */
export function findCol(headers: string[], names: readonly string[]): number {
  const h = headers.map((x) => x.trim().toLowerCase());
  for (const n of names) {
    const i = h.indexOf(n);
    if (i >= 0) return i;
  }
  return -1;
}

export function toInt(v: string | undefined): number | null {
  const n = Number(String(v ?? "").trim());
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function toDate(v: string | undefined): string | undefined {
  const s = String(v ?? "").trim();
  if (!s) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** «اسم العمل (2019)» — السنة تُفصل لأن بحث TMDB يقبلها معاملاً أدقّ */
export function splitYear(name: string): { name: string; year?: number } {
  const m = name.match(/^(.*?)\s*\((\d{4})\)\s*$/);
  if (m) return { name: m[1].trim(), year: Number(m[2]) };
  return { name: name.trim() };
}

// ============================================================
//  من سجلاتٍ خام إلى طلبات مطابقة — بلا تكرار
// ============================================================

export interface GroupedRaw {
  /** مفتاح المجموعة → طلب المطابقة الواحد لها */
  requests: ResolveRequest[];
  keys: string[];
}

/** مفتاحُ الصفّ — **واحدٌ للتجميع وللقراءة بعده**، وإلا ضاعت المطابقة */
export function recordKey(r: RawRecord): string {
  switch (r.kind) {
    case "ep-name":
      return `tv:${r.show.toLowerCase()}:${r.year ?? ""}`;
    case "rating-show":
      return `tv:${r.show.toLowerCase()}:`;
    case "movie-name":
    case "movie-watchlist":
      return `mv:${r.name.toLowerCase()}:${r.year ?? ""}`;
    case "show-tvdb":
      return `tvdb:${r.tvdbId}`;
    case "ep-tvdb":
      return `tvdbe:${r.episodeTvdbId}`;
    /* مفتاحٌ لا يُطلب من الخادم — موجودٌ ليكتمل الفرز وحده */
    case "tmdb-show":
      return `tmdbtv:${r.tmdbId}`;
    case "tmdb-movie":
      return `tmdbmv:${r.tmdbId}`;
  }
}

export function groupForResolve(records: RawRecord[]): GroupedRaw {
  const map = new Map<string, ResolveRequest>();
  for (const r of records) {
    const key = recordKey(r);
    if (map.has(key)) continue;
    if (r.kind === "ep-name") map.set(key, { kind: "name-tv", name: r.show, year: r.year });
    else if (r.kind === "rating-show") map.set(key, { kind: "name-tv", name: r.show });
    else if (r.kind === "movie-name" || r.kind === "movie-watchlist")
      map.set(key, { kind: "name-movie", name: r.name, year: r.year });
    else if (r.kind === "show-tvdb") map.set(key, { kind: "tvdb-tv", id: r.tvdbId });
    else if (r.kind === "ep-tvdb") map.set(key, { kind: "tvdb-episode", id: r.episodeTvdbId });
    /* `tmdb-*` لا يُطلب: معرّفه بيده. **وإدراجه هنا كان سيكلّف رحلةَ
       خادمٍ لكل عملٍ بلا فائدة** — وهي مئاتُ الطلبات في مكتبةٍ كبيرة */
  }
  return { requests: [...map.values()], keys: [...map.keys()] };
}
