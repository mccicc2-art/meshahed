// قارئُ تصدير Bingers — «Export My Data» في إعداداته: zip فيه أربعةُ ملفّات CSV.
//
// **لماذا ملفٌّ خاصٌّ لا سطرٌ في `trackerExport` (Simkl):** صيغةُ Bingers جداولُ مترابطةٌ لا شجرة — المكتبةُ في ملفّ
// (`library.csv`: الحالُ والمفضّلة)، والمشاهداتُ في آخر (`watches.csv`: حلقةً حلقة بتاريخها)، والتقييماتُ في ثالث، والقوائمُ
// في رابع. فالمعنى يُبنى بربطها بالمعرّف، وقارئُ الأشجار لا يربط ملفّين.
//
// **والصيغةُ غيرُ موثّقةٍ رسميّاً** — أُخذت أعمدتُها من مستوردَين مفتوحَي المصدر يقرآنها (أحدُهما بُني على تصديرٍ حقيقيّ).
// فالملفُّ يُعرف **بأعمدته لا باسمه** (`findCol`، قاعدةُ `importParse`)، وما لم يُفهم يُقال باسمه في `skippedFiles`.
//
// **والمعرّفُ بيد الملفّ** (TMDB في كلِّ صفٍّ تقريباً): لا بحثَ بالاسم ولا رحلةَ خادمٍ للمطابقة — إلّا مسلسلاً لا يحمل إلّا
// معرّف TVDB فيُطابَق به (`show-tvdb` · `ep-tvdbshow`)، وفيلماً بلا معرّفٍ فيُبحث باسمه وسنته.

import { findCol, parseCsv, readZip, toDate, toInt, type ParseOutcome, type RawRecord } from "./importParse.ts";

type Media = "tv" | "movie";

/** نوعُ الصفّ عند Bingers ⇐ جهتُه عندنا. الحلقةُ تتبع مسلسلها */
function mediaOf(v: string | undefined): Media | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "movie" || s === "film") return "movie";
  if (s === "show" || s === "tv" || s === "series" || s === "episode") return "tv";
  return null;
}

/** أيُّ ملفٍّ هذا؟ — من أعمدته: الحالُ للمكتبة، وتاريخُ المشاهدة للمشاهدات، والتقييمُ للتقييمات، واسمُ القائمة للقوائم */
type Kind = "library" | "watches" | "ratings" | "lists";
function kindOf(h: string[]): Kind | null {
  if (findCol(h, ["list_name"]) >= 0) return "lists";
  if (findCol(h, ["list_status"]) >= 0) return "library";
  if (findCol(h, ["first_watched_at", "last_watched_at", "watched_at"]) >= 0) return "watches";
  if (findCol(h, ["rating"]) >= 0) return "ratings";
  return null;
}

interface Table {
  rows: string[][];
  col: (names: readonly string[]) => (r: string[]) => string;
}

function table(text: string): { kind: Kind; t: Table } | null {
  /* علامةُ BOM في أوّل الملفّ تلتصق باسم العمود الأوّل («﻿type») فلا يُعرف — تُنزع قبل القراءة */
  const rows = parseCsv(text.replace(/^﻿/, ""));
  if (rows.length < 1) return null;
  const head = rows[0];
  const kind = kindOf(head);
  if (!kind) return null;
  const col = (names: readonly string[]) => {
    const i = findCol(head, names);
    return (r: string[]) => (i >= 0 ? String(r[i] ?? "").trim() : "");
  };
  return { kind, t: { rows: rows.slice(1), col } };
}

/**
 * **مقياسُ التقييم:** Bingers نجومٌ من خمس بأنصافها، ومقياسُنا من عشرة — فيُضاعَف. **وإن حمل الملفُّ رقماً فوق الخمسة
 * فمقياسُه عشرةٌ أصلاً** ويؤخذ كما هو: حكمٌ على الملفّ كلِّه لا على الصفّ، كي لا يُقرأ «٤» نصفَ «٨» في ملفٍّ و«٤» في آخر.
 */
function ratingScale(values: number[]): (n: number) => number | undefined {
  const factor = values.some((v) => v > 5) ? 1 : 2;
  return (n) => {
    if (!Number.isFinite(n) || n <= 0) return undefined;
    return Math.min(10, Math.max(1, Math.round(n * factor)));
  };
}

interface Title {
  media: Media;
  tmdbId?: number;
  tvdbId?: number;
  title: string;
  year?: number;
  /** من المكتبة */
  inLibrary: boolean;
  status?: string;
  stopped?: boolean;
  favorite?: boolean;
  /** فيلم: أبكرُ مشاهدة · مسلسل: حلقاتُه */
  watchedAt?: string;
  watched: boolean;
  episodes: { s: number; e: number; at?: string }[];
  rating?: number;
}

export async function parseBingersFiles(files: { name: string; buf: ArrayBuffer }[]): Promise<ParseOutcome> {
  const parsedFiles: string[] = [];
  const skippedFiles: string[] = [];
  /* ملفّان من النوع نفسِه (تصديران رُفعا معاً) يُقرأ كلٌّ بأعمدته — قد يختلف ترتيبُها — والمعرّفُ يطوي المكرّر بعدُ */
  const tables: Record<Kind, Table[]> = { library: [], watches: [], ratings: [], lists: [] };

  const handle = async (name: string, buf: ArrayBuffer) => {
    const lower = name.toLowerCase();
    if (lower.endsWith(".zip")) {
      try {
        for (const entry of await readZip(buf)) await handle(entry.name, entry.bytes.buffer as ArrayBuffer);
      } catch {
        skippedFiles.push(name);
      }
      return;
    }
    /* نسخُ macOS الظلّيّة («__MACOSX/._library.csv») ليست ملفّاتٍ — تُتجاوز بصمتٍ لا تُذكر «لم تُفهم» */
    if (lower.startsWith("__macosx/") || /(^|\/)\._/.test(lower)) return;
    const got = lower.endsWith(".csv") ? table(new TextDecoder().decode(buf)) : null;
    if (!got) {
      skippedFiles.push(name);
      return;
    }
    tables[got.kind].push(got.t);
    parsedFiles.push(name);
  };

  for (const f of files) await handle(f.name, f.buf);
  const all = (kind: Kind): Table[] => tables[kind];

  // ===== الأعمال: مفتاحُها جهتُها ومعرّفُها (TMDB أوّلاً، وإلّا TVDB) =====
  const titles = new Map<string, Title>();
  const keyOf = (media: Media, tmdbId?: number | null, tvdbId?: number | null) =>
    tmdbId ? `${media}:tmdb:${tmdbId}` : tvdbId ? `${media}:tvdb:${tvdbId}` : null;
  const titleOf = (t: Table, r: string[], media: Media): Title | null => {
    const tmdbId = toInt(t.col(["tmdb_id", "tmdb"])(r)) ?? undefined;
    const tvdbId = toInt(t.col(["tvdb_id", "tvdb"])(r)) ?? undefined;
    const name = t.col(["title", "name"])(r);
    /* فيلمٌ بلا معرّفٍ يُعرف باسمه (يُبحث عنه) — ومسلسلٌ بلا معرّفٍ لا يُخمَّن */
    const key = keyOf(media, tmdbId, tvdbId) ?? (media === "movie" && name ? `movie:name:${name.toLowerCase()}` : null);
    if (!key) return null;
    let it = titles.get(key);
    if (!it) {
      it = { media, tmdbId, tvdbId, title: name, inLibrary: false, watched: false, episodes: [] };
      titles.set(key, it);
    }
    if (!it.title && name) it.title = name;
    const year = toInt(t.col(["year"])(r));
    if (year && !it.year) it.year = year;
    return it;
  };

  // ===== المكتبة: الحالُ والمفضّلة =====
  for (const t of all("library")) {
    for (const r of t.rows) {
      const media = mediaOf(t.col(["type"])(r));
      if (!media) continue;
      const it = titleOf(t, r, media);
      if (!it) continue;
      it.inLibrary = true;
      it.status = t.col(["list_status", "status"])(r).toLowerCase();
      /* «توقّفتُ عن مشاهدته» تاريخٌ في عموده، أو حالٌ اسمُه «stopped» — أيُّهما وُجد */
      it.stopped = it.status === "stopped" || !!t.col(["stopped_watching_at"])(r);
      it.favorite = /^(yes|true|1)$/i.test(t.col(["favorite", "favourite", "is_favorite"])(r));
    }
  }

  // ===== المشاهدات: حلقةً حلقة، وفيلماً فيلماً — بيوم المشاهدة **الأوّل** (D-041: هو الصادق) =====
  for (const t of all("watches")) {
    const first = t.col(["first_watched_at", "watched_at"]);
    const last = t.col(["last_watched_at"]);
    for (const r of t.rows) {
      const type = t.col(["type"])(r).toLowerCase();
      const media = mediaOf(type);
      if (!media) continue;
      const it = titleOf(t, r, media);
      if (!it) continue;
      const at = toDate(first(r) || last(r));
      if (media === "movie") {
        it.watched = true;
        it.watchedAt = it.watchedAt && at ? (it.watchedAt < at ? it.watchedAt : at) : (it.watchedAt ?? at);
        continue;
      }
      const s = Number(t.col(["season_number", "season"])(r));
      const e = Number(t.col(["episode_number", "episode"])(r));
      /* الموسمُ صفرٌ مقبول (الخاصّات) والحلقةُ لا — و`toInt` يرفض الصفر فيُقرأ الموسمُ بغيره */
      if (!Number.isInteger(s) || s < 0 || !Number.isInteger(e) || e < 1) continue;
      it.watched = true;
      it.episodes.push({ s, e, at });
    }
  }

  // ===== التقييمات: للعمل وحدَه — تقييمُ الحلقة لا مقابلَ له في الاستيراد بعد =====
  const ratingRows: { it: Title; v: number }[] = [];
  for (const t of all("ratings")) {
    for (const r of t.rows) {
      const type = t.col(["type"])(r).toLowerCase();
      if (type !== "movie" && type !== "show" && type !== "tv") continue;
      const media = mediaOf(type)!;
      const v = Number(t.col(["rating", "score"])(r).replace(",", "."));
      if (!Number.isFinite(v) || v <= 0) continue;
      const it = titleOf(t, r, media);
      if (it) ratingRows.push({ it, v });
    }
  }
  const scale = ratingScale(ratingRows.map((x) => x.v));
  for (const { it, v } of ratingRows) it.rating = scale(v);

  // ===== من الأعمال إلى سجلّات =====
  const records: RawRecord[] = [];
  let favPos = 0;
  for (const it of titles.values()) {
    /* عملٌ لا مكتبةَ له ولا مشاهدةَ ولا تقييم (صفٌّ في قائمةٍ وحدَها) لا يدخل المكتبة — يدخل قائمتَه فقط */
    if (!it.inLibrary && !it.watched && it.rating == null) continue;
    const state = it.stopped ? ("dropped" as const) : undefined;
    if (it.media === "tv") {
      if (it.tmdbId) {
        records.push({ kind: "tmdb-show", tmdbId: it.tmdbId, title: it.title, episodes: it.episodes, rating: it.rating, state });
      } else if (it.tvdbId) {
        records.push({ kind: "show-tvdb", tvdbId: it.tvdbId, name: it.title, rating: it.rating, state });
        for (const ep of it.episodes) records.push({ kind: "ep-tvdbshow", tvdbId: it.tvdbId, name: it.title, ...ep });
      }
    } else if (it.tmdbId) {
      records.push({ kind: "tmdb-movie", tmdbId: it.tmdbId, title: it.title, at: it.watchedAt, rating: it.rating, planned: !it.watched });
    } else if (it.title) {
      records.push(
        it.watched
          ? { kind: "movie-name", name: it.title, year: it.year, at: it.watchedAt, rating: it.rating }
          : { kind: "movie-watchlist", name: it.title, year: it.year },
      );
    }
  }
  /* المفضّلةُ بترتيب المكتبة — والمعرّفُ شرطٌ: قائمةٌ لا تُبنى بالبحث عن اسم */
  for (const it of titles.values()) {
    if (!it.favorite || (!it.tmdbId && !(it.media === "tv" && it.tvdbId))) continue;
    records.push({ kind: "list-item", list: null, pos: favPos++, mediaType: it.media, title: it.title, tmdbId: it.tmdbId, tvdbId: it.tvdbId });
  }

  // ===== القوائمُ الخاصّة («١ أ»): باسمها وترتيبِ صفوفها =====
  const pos = new Map<string, number>();
  for (const t of all("lists")) {
    for (const r of t.rows) {
      const list = t.col(["list_name"])(r).slice(0, 60);
      const media = mediaOf(t.col(["type"])(r));
      if (!list || !media) continue;
      const tmdbId = toInt(t.col(["tmdb_id", "tmdb"])(r)) ?? undefined;
      const tvdbId = toInt(t.col(["tvdb_id", "tvdb"])(r)) ?? undefined;
      if (!tmdbId && !(media === "tv" && tvdbId)) continue;
      const n = pos.get(list) ?? 0;
      pos.set(list, n + 1);
      records.push({ kind: "list-item", list, pos: n, mediaType: media, title: t.col(["title", "name"])(r), tmdbId, tvdbId });
    }
  }

  return { records, parsedFiles, skippedFiles };
}
