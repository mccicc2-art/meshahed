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
  /* 🆕 `nfx` — حلقةٌ من مزامنة نتفليكس (`core/netflix.ts`): معرّفُ مسلسلها هناك واسمُ الحلقة بالإنجليزيّة. المسلسلُ يُطابَق بهما
     (`netflix-tv`) لا بالاسم وحده: «One Piece» الحيّ و«One Piece» الأنمي اسمٌ واحد، وحلقةٌ منه تفرّق بينهما */
  | { kind: "ep-name"; show: string; year?: number; s: number; e: number; at?: string; nfx?: { show: string; title: string } }
  | { kind: "ep-tvdb"; episodeTvdbId: number; at?: string }
  /* `name` · `rating` · `state` 🆕 من Bingers (عملٌ بلا معرّف TMDB في تصديره) — اختياريّةٌ: TV Time لا يحملها */
  | { kind: "show-tvdb"; tvdbId: number; name?: string; rating?: number; state?: "dropped" }
  /* 🆕 **حلقةٌ بمعرّف مسلسلها في TVDB ورقمَيها** (Bingers) — مفتاحُها مفتاحُ `show-tvdb` نفسُه فتُطابَق مرّةً للمسلسل كلِّه */
  | { kind: "ep-tvdbshow"; tvdbId: number; name: string; s: number; e: number; at?: string }
  /* 🆕 **عملٌ في قائمةٍ من قوائم صاحبه** (`list`)، **أو في مفضّلته** (`list: null`) — بمعرّف TMDB، أو TVDB لمسلسلٍ بلا معرّف TMDB
     (Bingers «١ أ» · «٢ أ»). القائمةُ تدخل قوائمَه الخاصّة باسمها وترتيبها، والمفضّلةُ قائمةَ «المفضّلة» الواحدة */
  | {
      kind: "list-item";
      list: string | null;
      pos: number;
      mediaType: "tv" | "movie";
      title: string;
      tmdbId?: number;
      tvdbId?: number;
    }
  /* 🆕 T507 — `review`: رأيُ صاحبه بنصّه المنظَّف (`cleanReviewText`) ويومِ كتابته `reviewAt` (Letterboxd) */
  | { kind: "movie-name"; name: string; year?: number; at?: string; rating?: number; review?: string; reviewAt?: string }
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
      /** 🆕 Bingers — «توقّفتُ عن مشاهدته» ⇐ متروك */
      state?: "dropped";
    }
  | {
      kind: "tmdb-movie";
      tmdbId: number;
      title: string;
      at?: string;
      rating?: number;
      planned?: boolean;
    }
  /* 🆕 **صفٌّ من IMDb** — بمعرّفه هناك (`tt…`) فالمطابقةُ بالمعرّف لا بالاسم. `role` ما يعنيه الصفُّ:
     - `rated`: قيّمه صاحبُه ⇐ شاهده (فيلمٌ مشاهَد · مسلسلٌ كلُّه «١ ب» · حلقةٌ وما قبلها «٢ أ»)، و`at` يومُ التقييم «٣ أ».
     - `watchlist`: «أنوي مشاهدته» — يدخل المكتبة بلا مشاهدة.
     - `list`: عملٌ في قائمةٍ من قوائمه (`list` اسمُها، `pos` موضعُه) — يدخل تلك القائمة وحدَها «٤ أ». */
  | {
      kind: "imdb";
      imdb: string;
      media: "movie" | "tv" | "episode";
      /** العنوانُ كما في الملف — للمطابَق الذي لم يُوجد، ولاسم المسلسل من صفِّ حلقته («المسلسل: الحلقة») */
      name: string;
      role: "rated" | "watchlist" | "list";
      rating?: number;
      at?: string;
      list?: string;
      pos?: number;
    }
  /* 🆕 T500 — **صفٌّ من تطبيقٍ لا نعرفه** (`importAuto.ts`): ما فهمناه من أعمدته بعد مراجعة صاحبه. فيلمٌ أو مسلسل، بأقوى معرّفٍ
     وُجد (TMDB ثمّ IMDb ثمّ TVDB ثمّ الاسمُ والسنة)، وحلقةٌ إن حمل موسماً ورقماً، وحالُه (`status`) لصفِّ العمل كلِّه */
  | {
      kind: "auto";
      media: "movie" | "tv";
      name: string;
      year?: number;
      tmdb?: number;
      imdb?: string;
      tvdb?: number;
      s?: number;
      e?: number;
      status: "watched" | "watching" | "plan" | "dropped" | "paused";
      rating?: number;
      at?: string;
      /** 🆕 T507 — نصُّ رأيه منظَّفاً */
      review?: string;
    }
  /* 🆕 **صفٌّ من MyAnimeList** (`mal.ts`) — رقمُه هناك، وما سجّله منه (`watched` من `total`)، وحالتُه. ومعناه على مواسم TMDB
     يُعرف بعد المطابقة (جدولُ Fribb يعطي الموسمَ والإزاحة) — فالحلقاتُ تُحسب على الخادم لا هنا */
  | {
      kind: "mal";
      mal: number;
      name: string;
      status: "watching" | "completed" | "onhold" | "dropped" | "plan";
      watched: number;
      total: number;
      rating?: number;
      at?: string;
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

/**
 * 🆕 D-1369 (V-C · C6) — **الفكُّ يُحقَن حيث لا يحمله المحرّك**: `DecompressionStream` في كلِّ متصفّحٍ حديث،
 * **وليست في محرّك التطبيق** (لا أثرَ لها في React Native ولا في Expo — قُرئ مصدرُهما). فالتطبيقُ يسجّل
 * فاكَّه (`fflate`، جافاسكربت خالص) قبل أوّل قراءة، والويبُ لا يسجّل شيئاً فيبقى على أداة المتصفّح:
 * لا مكتبةَ ضغطٍ تدخل حزمةَ الويب لأجل التطبيق.
 */
let customInflate: ((data: Uint8Array) => Uint8Array | Promise<Uint8Array>) | null = null;
export function setInflateRaw(fn: typeof customInflate) {
  customInflate = fn;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (customInflate) return customInflate(data);
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * 🆕 **gzip** (تصديرُ MyAnimeList `.xml.gz`) — ترويسةٌ ثمّ deflate خامٌ ثمّ ذيلٌ من ثمانية بايتات (RFC 1952). يُقصّ الطرفان
 * ويُفكّ الوسطُ بالفاكّ نفسِه (`inflateRaw`) — فالتطبيقُ يفكّه بـ`fflate` الذي سجّله، والويبُ بأداة المتصفّح، بلا فاكٍّ ثانٍ.
 */
export async function gunzip(b: Uint8Array): Promise<Uint8Array> {
  if (b.length < 18 || b[0] !== 0x1f || b[1] !== 0x8b || b[2] !== 8) throw new Error("not gzip");
  const flags = b[3];
  let off = 10;
  if (flags & 4) off += 2 + (b[off] | (b[off + 1] << 8)); // FEXTRA
  if (flags & 8) while (off < b.length && b[off++] !== 0); // FNAME
  if (flags & 16) while (off < b.length && b[off++] !== 0); // FCOMMENT
  if (flags & 2) off += 2; // FHCRC
  return inflateRaw(b.slice(off, b.length - 8));
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

/** `delim` 🆕 T500 — المستوردُ العامّ يقرأ TSV وفاصلةً منقوطة (تصديرُ Excel في لغاتٍ كثيرة) بالقارئ نفسِه؛ الافتراضيُّ الفاصلة */
export function parseCsv(text: string, delim = ","): string[][] {
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
    else if (c === delim) {
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
      /* 🆕 نتفليكس ⇐ مفتاحُ مسلسلها هناك: مسلسلان باسمٍ واحد لا يندمجان في مطابقةٍ واحدة */
      return r.nfx ? `nfx:${r.nfx.show}` : `tv:${r.show.toLowerCase()}:${r.year ?? ""}`;
    case "rating-show":
      return `tv:${r.show.toLowerCase()}:`;
    case "movie-name":
    case "movie-watchlist":
      return `mv:${r.name.toLowerCase()}:${r.year ?? ""}`;
    case "show-tvdb":
    case "ep-tvdbshow":
      return `tvdb:${r.tvdbId}`;
    /* بمعرّف TMDB ⇐ مفتاحُ العمل نفسُه (لا يُطلب)؛ وبـTVDB وحدَه ⇐ مفتاحُ مسلسله فيُطابَق مع حلقاته مرّةً واحدة */
    case "list-item":
      return r.tmdbId ? `${r.mediaType === "tv" ? "tmdbtv" : "tmdbmv"}:${r.tmdbId}` : `tvdb:${r.tvdbId}`;
    case "ep-tvdb":
      return `tvdbe:${r.episodeTvdbId}`;
    /* مفتاحٌ لا يُطلب من الخادم — موجودٌ ليكتمل الفرز وحده */
    case "tmdb-show":
      return `tmdbtv:${r.tmdbId}`;
    case "tmdb-movie":
      return `tmdbmv:${r.tmdbId}`;
    /* المعرّفُ وحدَه يكفي — لكنّ الجهةَ في المفتاح لأنها جزءٌ من الطلب (`media`) */
    case "imdb":
      return `imdb:${r.media}:${r.imdb}`;
    case "mal":
      return `mal:${r.mal}`;
    /* T500 — أقوى معرّفٍ يحمله الصفّ؛ ومفاتيحُ الاسم مفاتيحُ `ep-name`/`movie-name` نفسُها فيُطابَق العملُ مرّةً مهما تكرّر */
    case "auto":
      return r.tmdb
        ? `${r.media === "tv" ? "tmdbtv" : "tmdbmv"}:${r.tmdb}`
        : r.imdb
          ? `imdb:any:${r.imdb}`
          : r.tvdb
            ? `tvdb:${r.tvdb}`
            : `${r.media === "tv" ? "tv" : "mv"}:${r.name.toLowerCase()}:${r.year ?? ""}`;
  }
}

export function groupForResolve(records: RawRecord[]): GroupedRaw {
  const map = new Map<string, ResolveRequest>();
  for (const r of records) {
    const key = recordKey(r);
    if (map.has(key)) continue;
    if (r.kind === "ep-name")
      map.set(key, r.nfx ? { kind: "netflix-tv", name: r.show, show: r.nfx.show, s: r.s, e: r.e, title: r.nfx.title } : { kind: "name-tv", name: r.show, year: r.year });
    else if (r.kind === "rating-show") map.set(key, { kind: "name-tv", name: r.show });
    else if (r.kind === "movie-name" || r.kind === "movie-watchlist")
      map.set(key, { kind: "name-movie", name: r.name, year: r.year });
    else if (r.kind === "show-tvdb" || r.kind === "ep-tvdbshow") map.set(key, { kind: "tvdb-tv", id: r.tvdbId });
    else if (r.kind === "list-item") {
      if (!r.tmdbId && r.tvdbId && r.mediaType === "tv") map.set(key, { kind: "tvdb-tv", id: r.tvdbId });
    }
    else if (r.kind === "ep-tvdb") map.set(key, { kind: "tvdb-episode", id: r.episodeTvdbId });
    else if (r.kind === "imdb") map.set(key, { kind: "imdb", id: r.imdb, media: r.media });
    else if (r.kind === "mal") map.set(key, { kind: "mal", id: r.mal });
    else if (r.kind === "auto") {
      /* بمعرّف TMDB لا يُطلب (D-154) */
      if (r.tmdb) continue;
      if (r.imdb) map.set(key, { kind: "imdb", id: r.imdb, media: "any" });
      else if (r.tvdb) map.set(key, { kind: "tvdb-tv", id: r.tvdb });
      else map.set(key, r.media === "tv" ? { kind: "name-tv", name: r.name, year: r.year } : { kind: "name-movie", name: r.name, year: r.year });
    }
    /* `tmdb-*` لا يُطلب: معرّفه بيده. **وإدراجه هنا كان سيكلّف رحلةَ
       خادمٍ لكل عملٍ بلا فائدة** — وهي مئاتُ الطلبات في مكتبةٍ كبيرة */
  }
  return { requests: [...map.values()], keys: [...map.keys()] };
}

/** 🆕 T507 — سقفُ نصِّ الرأي هو سقفُ `saveRating` نفسُه: الرأيُ المستورد لا يملك مساحةً لا يملكها المكتوبُ بيد صاحبه */
export const REVIEW_MAX = 2000;

const ENTITY: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

/** الوسومُ التي يكتبها محرّرو الآراء (Letterboxd) — **بأسمائها**: نزعُ كلِّ `<…>` كان يأكل «I <3 x > y» من نصِّ صاحبه */
const REVIEW_TAG = /<\s*\/?\s*(a|b|i|em|strong|u|s|strike|del|ins|p|div|span|blockquote|ul|ol|li|h[1-6]|img|hr|code|pre|sup|sub|small|big|font|center|q|cite|abbr|tt)\b[^<>]*>/gi;

/**
 * 🆕 T507 — **نصُّ رأيٍ مستوردٍ إلى نصٍّ عاديّ**. Letterboxd يصدّر الرأيَ بوسوم HTML (`<br />` · `<p>` · `<i>` · `<a>` …)
 * وكياناتها (`&amp;`)، ولوبز يعرض الرأيَ نصّاً — فلو حُفظ كما هو لظهرت الوسومُ حروفاً أمام القرّاء. فواصلُ الأسطر
 * والفقرات تصير أسطراً، والوسومُ المعروفة تُنزع **ولا تُفسَّر** (لا رابطَ ولا تنسيقَ يعبر من ملفٍّ إلى صفحةٍ يقرؤها غيرُه)،
 * وما سواها من `<` و`>` يبقى حرفاً كتبه صاحبُه. ويُقطع عند سقف `saveRating` بعلامة «…» لا في منتصف كلمةٍ بلا أثر.
 */
export function cleanReviewText(raw: string | undefined | null): string {
  let s = String(raw ?? "");
  if (!s.trim()) return "";
  s = s
    .replace(/\r\n?/g, "\n")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|blockquote|li)\s*>/gi, "\n\n")
    .replace(REVIEW_TAG, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
      const k = e.toLowerCase();
      const code = k.startsWith("#x") ? parseInt(k.slice(2), 16) : k.startsWith("#") ? parseInt(k.slice(1), 10) : NaN;
      if (k.startsWith("#")) return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
      return ENTITY[k] ?? m;
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return s.length > REVIEW_MAX ? `${s.slice(0, REVIEW_MAX - 1).trimEnd()}…` : s;
}

/** 🆕 T507 — أبكرُ تاريخٍ يُقبل لرأيٍ مستورد: قبله لا تطبيقَ يُصدَّر منه، وتاريخٌ أقدمُ خطأُ ملفّ */
export const REVIEW_EARLIEST = "2000-01-01T00:00:00.000Z";

/**
 * 🆕 T507 — **يومُ الرأي كما يقبله الخادم** (مراجعةُ الوكيل المستقلّ، البند ١): التاريخُ يأتي من ملفِّ صاحبه، ويصير
 * `updated_at` الذي ترتّب به صفحاتُ المجتمع — فتاريخٌ في المستقبل يثبّت رأيه أعلى المجتمع ما بقي. يُقبل ما بين
 * ٢٠٠٠ واللحظة (`now`) وحده، ويُعاد ISO؛ وما سواه `null` — **ولا رجوعَ إلى «الآن»**: رأيٌ بلا يومٍ صحيحٍ لا يُستورد،
 * لأنّ «الآن» تُدخله نشاطَ الأصدقاء دفعةً واحدة (قرارُ أحمد ٢٢ نوفمبر «١ أ»).
 */
export function reviewDate(at: string | undefined | null, now: number): string | null {
  if (!at) return null;
  const t = Date.parse(at);
  if (!Number.isFinite(t) || t < Date.parse(REVIEW_EARLIEST) || t > now) return null;
  return new Date(t).toISOString();
}
