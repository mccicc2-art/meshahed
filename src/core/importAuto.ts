// ====== 🆕 T500 — «من تطبيقٍ آخر»: مستوردٌ يقرأ ملفّاً لا نعرف صاحبه ======
//
// أحمد ٢١ نوفمبر: «فيه كثير تطبيقات ممكن نعمل منها استيراد… هل بالإمكان بناء أداة ذكية تقرأ أي صيغة» — ثمّ «1أ 2أ نفذ»:
// المرحلةُ الأولى وحدها (بلا ذكاءٍ اصطناعيّ — **الملفُّ لا يغادر الجهاز**، D-041)، والأزرارُ الستّةُ باقيةٌ وزرٌّ سابعٌ لها.
//
// ثلاث خطوات، كلُّها نقيّةٌ هنا ليقرأها الويبُ والتطبيقُ بحرفها:
// ١. **الفكّ** (`unpackAuto`): zip · gz · csv · tsv · txt · json — نصوصاً.
// ٢. **التعرّف** (`detectKnown`): ملفٌّ من مصدرٍ نعرفه (IMDb · Letterboxd · MAL · Bingers · TV Time · Simkl) يذهب لقارئه هو —
//    فمن ضغط «من تطبيق آخر» ومعه تصديرُ IMDb لا يخسر دقّةَ قارئ IMDb.
// ٣. **التخمين** (`tablesOf` · `guessRoles`): كلُّ عمودٍ يُعطى معنىً من اسمه (عربيّاً وإنجليزيّاً) ومن شكل قيمه (`tt…` معرّفُ IMDb،
//    `S02E06` حلقة، أربعةُ أرقامٍ سنة…). **ثمّ يراجعه صاحبُه** في شاشة «هكذا فهمنا ملفّك» — التخمينُ الخاطئ يكتب في مكتبته،
//    فلا يُكتب شيءٌ قبل أن يراه. وبعد المراجعة `autoRecords` تحوّل الصفوفَ سجلّاتٍ (`kind: "auto"`) تمرّ من المسار نفسِه:
//    المطابقةُ على الخادم، والتجميعُ في `buildImport`، والكتابةُ دفعاتٍ بقاعدة «ما في Loopz يبقى».
import { cleanReviewText, gunzip, parseCsv, readZip, type RawRecord } from "./importParse.ts";
import { headerOk } from "./importer.ts";

export type AutoRole =
  | "title"
  | "show"
  | "year"
  | "type"
  | "imdb"
  | "tmdb"
  | "tvdb"
  | "season"
  | "episode"
  | "epcode"
  | "date"
  | "rating"
  | "status"
  /** 🆕 T507 — نصُّ رأيه (أحمد ٢٢ نوفمبر «٢ أ»). والملاحظاتُ الشخصيّة ليست منه: كتبها صاحبُها لنفسه، والرأيُ يقرؤه الناس */
  | "review"
  | "skip";

/** ترتيبُ الرقاقات في شاشة المراجعة — الاسمُ والمعرّفاتُ أوّلاً، و«تجاهل» آخراً */
export const AUTO_ROLES: readonly AutoRole[] = ["title", "show", "year", "type", "imdb", "tmdb", "tvdb", "season", "episode", "epcode", "date", "rating", "review", "status", "skip"];

export type AutoEntry = { name: string; text: string };
export type AutoTable = { file: string; headers: string[]; rows: string[][]; roles: AutoRole[] };
export type KnownSource = "imdb" | "mal" | "letterboxd" | "simkl" | "bingers" | "tvtime";
export type AutoStatus = "watched" | "plan";
export type AutoOptions = {
  /** نوعُ الأعمال لملفٍّ لا يقول نوعَها (لا عمودَ نوعٍ ولا مسلسلٍ ولا حلقة) */
  media: "movie" | "tv";
  /** معنى صفٍّ بلا حالة — «شاهدته» أو «أنوي مشاهدته» */
  status: AutoStatus;
};

/** سقوفٌ دفاعيّة: ملفٌّ ضخمٌ أو خبيثٌ لا يفجّر ذاكرةَ الجهاز */
const CAPS = { entries: 60, rows: 50_000, cols: 80 } as const;
const TEXT_EXT = /\.(csv|tsv|txt|json)$/i;

// ============================================================
//  ١. الفكّ
// ============================================================

function decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes).replace(/^﻿/, "");
}

/** كلُّ ما يُقرأ نصّاً من الملفّات المرفوعة — وما سواه يُسمّى في `skipped` بدل أن يُبتلع */
export async function unpackAuto(files: { name: string; buf: ArrayBuffer }[]): Promise<{ entries: AutoEntry[]; skipped: string[] }> {
  const entries: AutoEntry[] = [];
  const skipped: string[] = [];
  const take = async (name: string, bytes: Uint8Array) => {
    if (entries.length >= CAPS.entries) return;
    const lower = name.toLowerCase();
    if (lower.endsWith(".gz")) {
      try {
        return take(name.slice(0, -3), await gunzip(bytes));
      } catch {
        return void skipped.push(name);
      }
    }
    if (TEXT_EXT.test(lower) || lower.endsWith(".xml")) entries.push({ name, text: decode(bytes) });
    else skipped.push(name);
  };
  for (const f of files) {
    const lower = f.name.toLowerCase();
    if (lower.endsWith(".zip")) {
      try {
        for (const e of await readZip(f.buf)) {
          /* ملفّاتُ النظام في zip ماك (`__MACOSX/`) ليست من التصدير */
          if (e.name.startsWith("__MACOSX/") || e.name.split("/").pop()?.startsWith(".")) continue;
          await take(e.name, e.bytes);
        }
      } catch {
        skipped.push(f.name);
      }
    } else await take(f.name, new Uint8Array(f.buf));
  }
  return { entries, skipped };
}

// ============================================================
//  ٢. التعرّف على مصدرٍ نعرفه
// ============================================================

/** اسمُ العمود موحَّداً: حروفٌ صغيرة، والشرطاتُ والنقاطُ مسافات — `tv_show_name` و`TV Show Name` شيءٌ واحد */
export function normHeader(h: string): string {
  return h
    .toLowerCase()
    .replace(/[_\-./\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstLine(text: string): string {
  const i = text.search(/\r?\n/);
  return i < 0 ? text : text.slice(0, i);
}

/** مصدرٌ نعرفه من أسماء ملفّاته وأعمدته — أو `null`. الأدقُّ أوّلاً: Letterboxd وIMDb لهما أعمدةٌ لا يحملها غيرُهما */
export function detectKnown(entries: AutoEntry[]): KnownSource | null {
  const heads = entries.filter((e) => /\.(csv|tsv|txt)$/i.test(e.name)).map((e) => normHeader(firstLine(e.text)));
  const has = (re: RegExp) => heads.some((h) => re.test(h));
  if (has(/letterboxd uri/)) return "letterboxd";
  if (has(/(^|,)\s*const\s*(,|$)/) && has(/title type|your rating/)) return "imdb";
  if (entries.some((e) => /<myanimelist[\s>]/i.test(e.text.slice(0, 4000)))) return "mal";
  if (has(/list status|first watched at/)) return "bingers";
  if (entries.some((e) => /seen_episode|tracking-prod-records|followed_tv_show|user_tv_show_data/i.test(e.name)) || (has(/tv show name/) && has(/episode season number/))) return "tvtime";
  if (has(/simkl/) || entries.some((e) => /\.json$/i.test(e.name) && /"simkl"\s*:/i.test(e.text.slice(0, 200_000)))) return "simkl";
  return null;
}

/**
 * شجرةُ JSON بمعرّفات TMDB **ومواسمَ أو حلقاتٍ متداخلة** (نسخُ Trakt وأمثالها): الجدولُ المسطَّح يُسقط الحلقات، وقارئُ المتتبّعات
 * يمشي على الشجرة ولا يفترض شكلها (D-154) — فهي له. وملفٌّ مسطَّحٌ فيه `ids.tmdb` بلا حلقاتٍ متداخلة يُقرأ جدولاً بحالته ونوعه.
 */
export function treeFallback(entries: AutoEntry[]): KnownSource | null {
  return entries.some((e) => {
    if (!/\.json$/i.test(e.name)) return false;
    const head = e.text.slice(0, 400_000);
    return /"tmdb(_id)?"\s*:\s*"?\d/i.test(head) && /"(seasons|episodes)"\s*:\s*\[\s*\{/i.test(head);
  })
    ? "simkl"
    : null;
}

// ============================================================
//  ٣. الجداول وتخمينُ المعاني
// ============================================================

/** الفاصلُ من سطر الترويسة: الأكثرُ فيه من `,` `;` `\t` `|` */
function delimiterOf(head: string): string {
  let best = ",";
  let n = 0;
  for (const d of [",", ";", "\t", "|"]) {
    const c = head.split(d).length - 1;
    if (c > n) {
      n = c;
      best = d;
    }
  }
  return best;
}

function tableFromRows(file: string, all: string[][]): AutoTable | null {
  if (all.length < 2) return null;
  const headers = all[0].slice(0, CAPS.cols).map((h) => h.trim());
  if (headers.every((h) => !h)) return null;
  const rows = all
    .slice(1, CAPS.rows + 1)
    .map((r) => headers.map((_, i) => (r[i] ?? "").trim()))
    .filter((r) => r.some((v) => v !== ""));
  if (!rows.length) return null;
  return { file, headers, rows, roles: guessRoles(headers, rows) };
}

/** كائنٌ مسطَّح: `{ids: {imdb: "tt1"}}` ⇐ `ids.imdb` — أكثرُ تصديرات JSON تضع المعرّفاتِ في كائنٍ فرعيّ */
function flatten(o: Record<string, unknown>, prefix = "", out: Record<string, string> = {}, depth = 0): Record<string, string> {
  for (const [k, v] of Object.entries(o)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v == null) out[key] = "";
    else if (typeof v === "object" && !Array.isArray(v)) {
      if (depth < 2) flatten(v as Record<string, unknown>, key, out, depth + 1);
    } else if (Array.isArray(v)) {
      if (v.every((x) => x == null || typeof x !== "object")) out[key] = v.join(" | ");
    } else out[key] = String(v);
  }
  return out;
}

/** مصفوفاتُ الكائنات في شجرة JSON — كلُّ واحدةٍ جدول (`movies` · `shows` · …)، ولا يُنزل داخل صفوف جدولٍ وُجد */
function jsonTables(file: string, root: unknown): AutoTable[] {
  const out: AutoTable[] = [];
  const walk = (v: unknown, path: string) => {
    if (out.length >= 12 || v == null || typeof v !== "object") return;
    if (Array.isArray(v)) {
      const objs = v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x));
      if (objs.length && objs.length >= v.length / 2) {
        const flat = objs.slice(0, CAPS.rows).map((o) => flatten(o));
        const headers = [...new Set(flat.flatMap((f) => Object.keys(f)))].slice(0, CAPS.cols);
        const t = tableFromRows(path ? `${file} › ${path}` : file, [headers, ...flat.map((f) => headers.map((h) => f[h] ?? ""))]);
        if (t) out.push(t);
        return;
      }
      v.forEach((x, i) => walk(x, path ? `${path}[${i}]` : String(i)));
      return;
    }
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) walk(x, path ? `${path}.${k}` : k);
  };
  walk(root, "");
  return out;
}

/** ما فيه عمودٌ يعرّف العمل (اسمٌ أو معرّف) يُقبل جدولاً؛ وما سواه يُسمّى في `skipped` */
export function tablesOf(entries: AutoEntry[]): { tables: AutoTable[]; skipped: string[] } {
  const tables: AutoTable[] = [];
  const skipped: string[] = [];
  for (const e of entries) {
    let got: AutoTable[] = [];
    if (/\.json$/i.test(e.name)) {
      try {
        got = jsonTables(e.name, JSON.parse(e.text));
      } catch {
        got = [];
      }
    } else if (/\.(csv|tsv|txt)$/i.test(e.name)) {
      const t = tableFromRows(e.name, parseCsv(e.text, delimiterOf(firstLine(e.text))));
      if (t) got = [t];
    }
    const ok = got.filter((t) => t.roles.some((r) => r === "title" || r === "show" || r === "imdb" || r === "tmdb" || r === "tvdb"));
    if (ok.length) tables.push(...ok);
    else skipped.push(e.name);
  }
  return { tables, skipped };
}

// ---------- قواميسُ المعاني ----------

const words = (s: string) => s.split(" ");
/* 🆕 T507 — «المراجعة» لا تُخمَّن أبداً (مراجعةُ الوكيل، البند ٨ب): عمودُ «تعليق» أو «ملاحظات» في أكثر التطبيقات ملاحظةٌ
   كتبها صاحبُها لنفسه، والرأيُ في Loopz يقرؤه الناس — فلا يصير عمودٌ رأياً عامّاً إلّا بيد صاحبه في شاشة المراجعة */
const HEAD: Record<Exclude<AutoRole, "skip" | "epcode" | "review">, string[]> = {
  title: ["title", "name", "movie", "film", "movie title", "movie name", "film title", "primary title", "english title", "original title", "العنوان", "الاسم", "اسم العمل", "العمل", "الفيلم", "اسم الفيلم"],
  show: ["show", "series", "show name", "series name", "tv show", "tv show name", "show title", "series title", "tv series", "المسلسل", "اسم المسلسل"],
  year: ["year", "release year", "released year", "start year", "release date", "released", "first air date", "premiere", "السنة", "سنة الإصدار", "سنة العرض", "تاريخ الإصدار"],
  type: ["type", "media type", "kind", "category", "title type", "content type", "format", "media", "النوع", "نوع العمل"],
  imdb: ["imdb", "imdb id", "imdbid", "const", "tconst", "ids imdb", "imdb url", "imdb link"],
  tmdb: ["tmdb", "tmdb id", "tmdbid", "themoviedb", "ids tmdb", "the movie db"],
  tvdb: ["tvdb", "tvdb id", "tvdbid", "thetvdb", "ids tvdb"],
  season: ["season", "season number", "season no", "season num", "s", "الموسم", "رقم الموسم"],
  episode: ["episode", "episode number", "episode no", "episode num", "ep", "e", "الحلقة", "رقم الحلقة"],
  date: ["watched at", "watched", "date watched", "watched date", "watch date", "watched on", "last watched", "last watched at", "viewed", "viewed at", "seen at", "seen", "date", "date rated", "rated at", "logged", "logged at", "logged date", "created at", "created", "updated at", "added", "date added", "added at", "التاريخ", "تاريخ المشاهدة"],
  rating: ["rating", "my rating", "your rating", "user rating", "score", "my score", "stars", "rate", "التقييم", "تقييمي"],
  status: ["status", "state", "list", "watch status", "watchlist status", "progress", "الحالة"],
};
/** أعمدةٌ تشبه المعنى وليست هو: «تقييم IMDb» تقييمُ الناس لا تقييمُه، و«عدد الحلقات» عددٌ لا رقمُ حلقة */
const NOT: Partial<Record<AutoRole, RegExp>> = {
  rating: /imdb|tmdb|trakt|average|avg|vote|critic|metascore|public|community|count/,
  imdb: /rating|score|votes/,
  tmdb: /rating|score|votes|popularity/,
  episode: /title|name|episodes|count|total|runtime/,
  season: /seasons|count|total/,
  title: /episode|original language|sort|file|url|uri/,
  date: /release|premiere|air|birth/,
  /* «Device Type: TV» جهازٌ لا نوعُ عمل (Netflix) */
  type: /device|file|mime|supplemental|video type|rating|account|profile/,
};
/** أولويّةُ أعمدة التاريخ: يومُ المشاهدة أصدقُ من يوم التقييم، وكلاهما أصدقُ من يوم الإضافة */
const DATE_RANK = (h: string) => (/watch|view|seen|مشاهد/.test(h) ? 3 : /rated|logged/.test(h) ? 2 : /added|created|updated/.test(h) ? 0 : 1);

const RE = {
  imdb: /tt\d{6,10}/,
  epcode: /^s(\d{1,3})\s*e(\d{1,4})$|^(\d{1,3})x(\d{1,4})$/i,
  year: /^(18[89]\d|19\d\d|20\d\d|21\d\d)$/,
  int: /^\d{1,9}$/,
  num: /^\d+([.,]\d+)?$/,
};

/** حصّةُ القيم غير الفارغة التي تطابق الشرط (في أوّل مئتي صفّ) */
function share(rows: string[][], i: number, ok: (v: string) => boolean): number {
  let n = 0;
  let m = 0;
  for (const r of rows.slice(0, 200)) {
    const v = r[i];
    if (!v) continue;
    n++;
    if (ok(v)) m++;
  }
  return n ? m / n : 0;
}

export function mediaOf(v: string): "movie" | "tv" | "episode" | null {
  const s = v.toLowerCase().replace(/[_\-]+/g, " ").trim();
  if (!s) return null;
  if (/episode|حلقة/.test(s)) return "episode";
  if (/movie|film|feature|فيلم|أفلام|افلام/.test(s)) return "movie";
  if (/tv|show|series|serie|anime|مسلسل|انمي|أنمي/.test(s)) return "tv";
  return null;
}

export function statusOf(v: string): "watched" | "watching" | "plan" | "dropped" | "paused" | null {
  const s = v.toLowerCase().replace(/[_\-]+/g, " ").trim();
  if (!s) return null;
  if (/drop|abandon|gave up|stopped|تركت|متروك/.test(s)) return "dropped";
  if (/hold|pause|موقوف|متوقف/.test(s)) return "paused";
  if (/plan|want|watchlist|to watch|wish|queue|later|أنوي|انوي|لاحق/.test(s)) return "plan";
  if (/watching|in progress|ongoing|current|أشاهد|اشاهد|جار/.test(s)) return "watching";
  if (/watched|complete|seen|finish|done|شاهدت|مكتمل|شوهد|اكتمل/.test(s)) return "watched";
  return null;
}

/** معنى كلِّ عمود — كلُّ معنىً لعمودٍ واحد، وكلُّ عمودٍ لمعنىً واحد، والأقوى أوّلاً. ما لم يبلغ العتبةَ «تجاهل» */
export function guessRoles(headers: string[], rows: string[][]): AutoRole[] {
  const H = headers.map(normHeader);
  const cand: { col: number; role: AutoRole; score: number }[] = [];
  H.forEach((h, col) => {
    const hw = words(h);
    for (const role of Object.keys(HEAD) as (keyof typeof HEAD)[]) {
      if (NOT[role]?.test(h)) continue;
      const syn = HEAD[role];
      let score = syn.includes(h) ? 3 : syn.some((s) => s.length > 2 && (hw.includes(s) || h.includes(s))) ? 2 : 0;
      if (role === "imdb" || role === "tmdb" || role === "tvdb") score = h.includes(role) ? Math.max(score, 3) : score;
      cand.push({ col, role, score });
    }
  });
  const add = (col: number, role: AutoRole, score: number) => cand.push({ col, role, score });
  /* القيمُ تتكلّم أيضاً — ولها الكلمةُ الأقوى حيث لا تخطئ */
  headers.forEach((_, col) => {
    if (share(rows, col, (v) => RE.imdb.test(v)) >= 0.6) add(col, "imdb", 5);
    if (share(rows, col, (v) => RE.epcode.test(v)) >= 0.6) add(col, "epcode", 5);
    if (share(rows, col, (v) => mediaOf(v) != null) >= 0.8) add(col, "type", 1.5);
    if (share(rows, col, (v) => statusOf(v) != null) >= 0.8) add(col, "status", 1.5);
  });
  /* شرطُ القيمة لكلِّ معنىً رقميّ: «year» بأربعة أرقام، والموسمُ والحلقةُ أعدادٌ صغيرة، والتقييمُ رقمٌ حتى المئة */
  const valueOk = (role: AutoRole, col: number): boolean => {
    switch (role) {
      case "year":
        return share(rows, col, (v) => RE.year.test(v) || /^\d{4}[-/.]/.test(v) || /[-/.]\d{4}$/.test(v)) >= 0.6;
      case "season":
      case "episode":
        return share(rows, col, (v) => RE.int.test(v) && Number(v) < 10_000) >= 0.8;
      case "tmdb":
      case "tvdb":
        return share(rows, col, (v) => RE.int.test(v)) >= 0.8;
      case "rating":
        return share(rows, col, (v) => RE.num.test(v) && Number(v.replace(",", ".")) <= 100) >= 0.8;
      case "date":
        return share(rows, col, (v) => parseDate(v) != null) >= 0.6;
      case "type":
        return share(rows, col, (v) => mediaOf(v) != null) >= 0.6;
      case "status":
        return share(rows, col, (v) => statusOf(v) != null) >= 0.6;
      case "title":
      case "show":
        return share(rows, col, (v) => /\p{L}/u.test(v) && !RE.imdb.test(v)) >= 0.6;
      default:
        return true;
    }
  };
  const ranked = cand
    /* الاستثناءُ على القيم أيضاً لا على الاسم وحده: «Device Type» قيمُه «TV» ولا يصير نوعَ عمل */
    .filter((c) => !NOT[c.role]?.test(H[c.col]))
    .filter((c) => c.score >= 2 || (c.score >= 1.5 && valueOk(c.role, c.col)))
    .filter((c) => valueOk(c.role, c.col))
    .map((c) => ({ ...c, score: c.role === "date" ? c.score + DATE_RANK(H[c.col]) / 10 : c.score }))
    .sort((a, b) => b.score - a.score || a.col - b.col);
  const roles: AutoRole[] = headers.map(() => "skip");
  const used = new Set<AutoRole>();
  for (const c of ranked) {
    if (roles[c.col] !== "skip" || used.has(c.role)) continue;
    roles[c.col] = c.role;
    used.add(c.role);
  }
  return roles;
}

/** ملفٌّ لا يقول نوعَ أعماله — لا عمودَ نوعٍ ولا مسلسلٍ ولا موسمٍ ولا حلقة: صاحبُه يختار «أفلام» أو «مسلسلات» */
export function needsMedia(t: AutoTable): boolean {
  return !t.roles.some((r) => r === "type" || r === "show" || r === "season" || r === "episode" || r === "epcode");
}
/* ملفٌّ كـNetflix (عنوانٌ وتاريخٌ فقط) يخلط الأفلامَ بالحلقات: ما انقسم عنوانُه حلقةٌ، والسؤالُ يبقى لِما سواه — الأفلام غالباً */

// ============================================================
//  ٤. من الصفوف إلى السجلّات
// ============================================================

/** `dmy` أو `mdy` لتاريخٍ رقميّ — من العمود كلِّه: جزءٌ أوّلُ فوق ١٢ ⇐ يومٌ أوّلاً؛ ثانٍ فوق ١٢ ⇐ شهرٌ أوّلاً؛ وإلا اليومُ أوّلاً */
function dateOrder(values: string[]): "dmy" | "mdy" {
  for (const v of values) {
    const m = v.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})/);
    if (!m) continue;
    if (Number(m[1]) > 12) return "dmy";
    if (Number(m[2]) > 12) return "mdy";
  }
  return "dmy";
}

/** تاريخٌ بأيِّ صيغةٍ شائعة ⇐ ISO، أو `null`. طابعُ يونكس بالثواني أو الأجزاء، وISO، و«٢١/١١/٢٠٢٦» بترتيب عموده */
export function parseDate(v: string, order: "dmy" | "mdy" = "dmy"): string | null {
  const s = v.trim();
  if (!s) return null;
  let d: Date | null = null;
  if (/^\d{10}$/.test(s)) d = new Date(Number(s) * 1000);
  else if (/^\d{13}$/.test(s)) d = new Date(Number(s));
  else {
    const m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})(?:,?[ T](\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]\.?m\.?|ص|م)?)?/i);
    if (m) {
      const [a, b] = order === "dmy" ? [Number(m[2]), Number(m[1])] : [Number(m[1]), Number(m[2])];
      /* «9:30 PM» مساءً — الساعةُ ١٢ ظهراً حين لا وقت، فلا ينقلب اليومُ في أيِّ منطقةٍ زمنيّة */
      const pm = /^(p|م)/i.test(m[6] ?? "");
      const am = /^(a|ص)/i.test(m[6] ?? "");
      const hh = m[4] == null ? 12 : (Number(m[4]) % 12) + (pm ? 12 : am ? 0 : Number(m[4]) >= 12 ? 12 : 0);
      d = new Date(Date.UTC(Number(m[3]), a - 1, b, hh, Number(m[5] ?? 0)));
    } else if (/^\d{4}/.test(s) || /[a-z]{3}/i.test(s)) d = new Date(s);
  }
  if (!d || isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  return y >= 1950 && y <= new Date().getUTCFullYear() + 1 ? d.toISOString() : null;
}

function yearOf(v: string): number | undefined {
  const m = v.match(/(18[89]\d|19\d\d|20\d\d|21\d\d)/);
  return m ? Number(m[1]) : undefined;
}

/** مقياسُ التقييم من أكبر قيمةٍ في عموده: حتى ٥ نجومٌ (×٢)، حتى ١٠ كما هو، وما فوقه من مئة (÷١٠) — ومقياسُنا ١–١٠ صحيحاً */
function ratingScale(values: string[]): number {
  const max = Math.max(0, ...values.map((v) => Number(v.replace(",", "."))).filter((n) => Number.isFinite(n)));
  return max > 10 ? 0.1 : max > 5 ? 1 : 2;
}

/**
 * عنوانُ حلقةٍ في سطرٍ واحد كما تصدّره Netflix وأمثالُها: «The Crown: Season 1: Wolferton Splash (Episode 1)» ·
 * «Dark: Limited Series: …» · «الحشاشين: الموسم 1: الحلقة 3» ⇐ المسلسلُ وموسمُه ورقمُ حلقته إن ذُكر. بلا رقمٍ يُتابَع المسلسلُ
 * وحدَه — اسمُ الحلقة لا يكفي لمعرفة أيِّها شوهدت.
 */
export function splitEpisodeTitle(v: string): { show: string; s: number; e?: number } | null {
  const m = v.match(/^(.+?):\s*(?:(?:season|series|part|volume|chapter|book|الموسم|الجزء)\s*(\d{1,3})|(limited series|miniseries|مسلسل قصير))\s*:\s*(.*)$/i);
  if (!m) return null;
  const ep = m[4].match(/\((?:episode|ep\.?|الحلقة)\s*(\d{1,4})\)\s*$/i) ?? m[4].match(/^(?:episode|ep\.?|الحلقة)\s*(\d{1,4})\b/i);
  return { show: m[1].trim(), s: m[2] ? Number(m[2]) : 1, e: ep ? Number(ep[1]) : undefined };
}

/** الصفوفُ بالمعاني التي أقرّها صاحبُها ⇐ سجلّاتٌ تمرّ من المسار المشترك (المطابقة · التجميع · الكتابة) */
export function autoRecords(tables: AutoTable[], opts: AutoOptions): RawRecord[] {
  const out: RawRecord[] = [];
  for (const t of tables) {
    const col = (role: AutoRole) => t.roles.indexOf(role);
    const c = {
      title: col("title"),
      show: col("show"),
      year: col("year"),
      type: col("type"),
      imdb: col("imdb"),
      tmdb: col("tmdb"),
      tvdb: col("tvdb"),
      season: col("season"),
      episode: col("episode"),
      epcode: col("epcode"),
      date: col("date"),
      rating: col("rating"),
      status: col("status"),
      review: col("review"),
    };
    const at = (r: string[], i: number) => (i < 0 ? "" : (r[i] ?? ""));
    /* تصديرُ Netflix يخلط الإعلاناتِ والمقاطعَ بالمشاهدات — عمودُها يقول ذلك، فتُترك */
    const extra = t.headers.findIndex((h) => normHeader(h) === "supplemental video type");
    const order = c.date < 0 ? "dmy" : dateOrder(t.rows.slice(0, 500).map((r) => r[c.date]));
    const scale = c.rating < 0 ? 1 : ratingScale(t.rows.slice(0, 2000).map((r) => r[c.rating]).filter(Boolean));
    for (const r of t.rows) {
      if (extra >= 0 && at(r, extra)) continue;
      const split = !at(r, c.show) && c.season < 0 && c.epcode < 0 ? splitEpisodeTitle(at(r, c.title)) : null;
      const show = split?.show ?? at(r, c.show);
      const name = (show || at(r, c.title)).trim();
      const imdb = at(r, c.imdb).match(RE.imdb)?.[0];
      const tmdb = Number(at(r, c.tmdb)) || undefined;
      const tvdb = Number(at(r, c.tvdb)) || undefined;
      if (!name && !imdb && !tmdb && !tvdb) continue;
      let s: number | undefined;
      let e: number | undefined;
      const code = at(r, c.epcode).match(RE.epcode);
      if (split) {
        s = split.s;
        e = split.e;
      } else if (code) {
        s = Number(code[1] ?? code[3]);
        e = Number(code[2] ?? code[4]);
      } else if (c.season >= 0 && c.episode >= 0) {
        s = Number(at(r, c.season)) || undefined;
        e = Number(at(r, c.episode)) || undefined;
        if (s == null && e != null && at(r, c.season) === "0") s = 0;
      }
      const kind = mediaOf(at(r, c.type));
      const ep = s != null && e != null;
      const media: "movie" | "tv" = kind === "movie" ? "movie" : kind === "tv" || kind === "episode" || ep || !!show ? "tv" : opts.media;
      /* صفُّ حلقةٍ بلا حالة سجلُّ مشاهدة — هكذا تصدّر التطبيقاتُ حلقاتها؛ وحالُ العمل لصفِّ العمل. وحلقةٌ بلا رقم (عنوانٌ مقسوم)
         تعني أنه يشاهد المسلسل لا أنه أكمله */
      const status = statusOf(at(r, c.status)) ?? (ep ? "watched" : split ? "watching" : opts.status);
      const rawRating = Number(at(r, c.rating).replace(",", "."));
      const rating = rawRating > 0 ? Math.max(1, Math.min(10, Math.round(rawRating * scale))) : undefined;
      out.push({
        kind: "auto",
        media,
        name: name || imdb || String(tmdb ?? tvdb),
        year: yearOf(at(r, c.year)),
        tmdb,
        imdb,
        tvdb,
        s: ep && media === "tv" ? s : undefined,
        e: ep && media === "tv" ? e : undefined,
        status,
        rating,
        at: parseDate(at(r, c.date), order) ?? undefined,
        /* 🆕 T507 — الرأيُ نصُّه منظَّفاً. ويومُه يومُ الصفّ إن وُجد — وبلا يومٍ يُترك على الخادم (`applyImportChunk`) */
        ...(cleanReviewText(at(r, c.review)) ? { review: cleanReviewText(at(r, c.review)) } : {}),
      });
    }
  }
  return out;
}

// ============================================================
//  ٥. المسارُ كلُّه — ما يناديه الويبُ والتطبيق
// ============================================================

export type AutoRead =
  /** مصدرٌ نعرفه — يذهب لقارئه هو بالملفّات نفسِها */
  | { kind: "known"; source: KnownSource }
  /** جداولُ بمعانٍ مخمَّنة — تنتظر مراجعةَ صاحبها */
  | { kind: "tables"; tables: AutoTable[]; skipped: string[] }
  | { kind: "none"; skipped: string[] };

export async function readAuto(files: { name: string; buf: ArrayBuffer }[]): Promise<AutoRead> {
  const { entries, skipped } = await unpackAuto(files);
  const known = detectKnown(entries) ?? treeFallback(entries);
  if (known) return { kind: "known", source: known };
  const t = tablesOf(entries);
  const all = [...skipped, ...t.skipped];
  return t.tables.length ? { kind: "tables", tables: t.tables, skipped: all } : { kind: "none", skipped: all };
}

/**
 * 🆕 T507 — **أسماءُ الأعمدة لسجلّ الاستيراد** (أحمد «٢ أ»): نعرف بها أيَّ تطبيقٍ يكثر الاستيرادُ منه. جدولٌ لم يُعرف فيه
 * عمودٌ واحد (كلُّه «تجاهل») لا تُؤخذ عناوينُه — الأرجحُ أنّ سطرَه الأوّل صفٌّ من سجلِّ صاحبه لا عناوين، وكلُّ اسمٍ يمرّ
 * بـ`headerOk` (قصيرٌ بلا رابطٍ ولا تاريخٍ ولا رقم). والخادمُ يعيد الفحصَ نفسَه.
 */
export function runHeaders(tables: AutoTable[]): string[] {
  const out: string[] = [];
  for (const t of tables) {
    if (!t.roles.some((r) => r !== "skip")) continue;
    for (const h of t.headers) if (headerOk(h) && !out.includes(h.trim())) out.push(h.trim());
  }
  return out.slice(0, 60);
}
