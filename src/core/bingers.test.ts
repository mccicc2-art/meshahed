import { test } from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { parseBingersFiles } from "./bingers.ts";
import { buildImport } from "./importBuild.ts";
import { groupForResolve, setInflateRaw, type RawRecord } from "./importParse.ts";
import type { ResolveResult } from "./importer.ts";

// أعمدةُ تصدير Bingers كما يقرؤها مستوردان مفتوحا المصدر (أحدُهما على تصديرٍ حقيقيّ) — بعلامة BOM في أوّل المكتبة كما تصل
const library = `﻿type,title,original_title,year,tvdb_id,tmdb_id,favorite,list_status,added_at,for_later_at,stopped_watching_at,hidden_at
movie,Mystic River,Mystic River,2003,,322,no,following,2026-09-16T22:10:47.674Z,,,
movie,"Monsters, Inc.","Monsters, Inc.",2001,,585,yes,following,2019-10-03T20:56:50.000Z,,,
movie,Gone Girl,Gone Girl,2014,,210577,no,for_later,2023-02-19T23:17:45.000Z,2023-02-19T23:17:45.000Z,,
show,Game of Thrones,Game of Thrones,2011,121361,1399,yes,watching,2018-01-14T20:56:20.000Z,,,
show,Zindagi Gulzar Hai,Zindagi Gulzar Hai,2012,,60694,no,watching,2019-06-15T21:40:24.000Z,,,
show,The 100,The 100,2014,268592,48866,no,stopped,2018-01-14T20:56:20.000Z,,2018-01-14T20:56:20.000Z,
show,The Haunting,The Haunting,2018,345246,,no,watching,2019-06-14T21:27:36.000Z,,,
`;

const watches = `type,title,tvdb_id,tmdb_id,season_number,episode_number,first_watched_at,last_watched_at,plays
episode,Game of Thrones,121361,1399,1,1,2019-05-03T18:15:08.000Z,2021-05-03T18:15:08.000Z,2
episode,Game of Thrones,121361,1399,1,2,2019-05-04T18:15:08.000Z,2019-05-04T18:15:08.000Z,1
episode,Game of Thrones,121361,1399,0,1,2019-05-05T18:15:08.000Z,2019-05-05T18:15:08.000Z,1
episode,The Haunting,345246,,1,1,2019-06-14T21:27:36.000Z,2019-06-14T21:27:36.000Z,1
movie,Mystic River,,322,,,2026-09-16T22:10:47.674Z,2026-09-16T22:10:47.674Z,1
movie,"Monsters, Inc.",,585,,,2019-10-03T20:56:50.000Z,2024-10-03T20:56:50.000Z,2
movie,Predestination,,206487,,,2020-01-01T00:00:00.000Z,2020-01-01T00:00:00.000Z,1
`;

const ratings = `type,title,tvdb_id,tmdb_id,season_number,episode_number,rating,favorite_character,emotions
episode,Game of Thrones,121361,1399,1,1,5,,shocked
show,Game of Thrones,121361,1399,,,4.5,,
movie,Mystic River,,322,,,4,,touched
`;

const lists = `list_name,list_description,title,type,tvdb_id,tmdb_id
Rainy days,Comfort watches,"Monsters, Inc.",movie,,585
Rainy days,Comfort watches,Game of Thrones,show,121361,1399
Rainy days,Comfort watches,The Haunting,show,345246,
Mixed,,Mystic River,movie,,322
`;

const enc = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer;
const csvs = () => [
  { name: "library.csv", buf: enc(library) },
  { name: "watches.csv", buf: enc(watches) },
  { name: "ratings.csv", buf: enc(ratings) },
  { name: "lists.csv", buf: enc(lists) },
];

/** zip بأسماءٍ داخل مجلّد — كما يضغط نظامُ الملفّات مجلّداً — بلا مكتبة: ترويسةٌ محلّيّة لكلّ ملفٍّ ثمّ دليلٌ مركزيّ */
function zip(files: { name: string; text: string }[]): ArrayBuffer {
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let off = 0;
  for (const f of files) {
    const name = new TextEncoder().encode(f.name);
    const data = deflateRawSync(Buffer.from(f.text, "utf8"));
    const local = new Uint8Array(30 + name.length);
    const dv = new DataView(local.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(8, 8, true);
    dv.setUint32(18, data.length, true);
    dv.setUint16(26, name.length, true);
    local.set(name, 30);
    const cen = new Uint8Array(46 + name.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(10, 8, true);
    cv.setUint32(20, data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, off, true);
    cen.set(name, 46);
    chunks.push(local, data);
    central.push(cen);
    off += local.length + data.length;
  }
  const cenSize = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cenSize, true);
  ev.setUint32(16, off, true);
  const all = [...chunks, ...central, end];
  const out = new Uint8Array(all.reduce((n, c) => n + c.length, 0));
  let p = 0;
  for (const c of all) {
    out.set(c, p);
    p += c.length;
  }
  return out.buffer;
}

const tvdbHit = (tmdbId: number, title: string): ResolveResult => ({ tmdbId, mediaType: "tv", title, posterPath: `/${tmdbId}.jpg` });
function build(records: RawRecord[], answers: Record<string, ResolveResult> = {}) {
  const { keys } = groupForResolve(records);
  return buildImport(records, new Map(keys.map((k) => [k, answers[k] ?? null])));
}

test("الملفّاتُ تُعرف بأعمدتها، وما ليس منها يُذكر باسمه", async () => {
  const out = await parseBingersFiles([...csvs(), { name: "notes.csv", buf: enc("a,b\n1,2\n") }]);
  assert.deepEqual(out.parsedFiles.sort(), ["library.csv", "lists.csv", "ratings.csv", "watches.csv"]);
  assert.deepEqual(out.skippedFiles, ["notes.csv"]);
});

test("المسلسلُ بحلقاته بيومها الأوّل، وتقييمُه من خمسٍ إلى عشر، والمتوقَّفُ عنه متروك", async () => {
  const { records } = await parseBingersFiles(csvs());
  const out = build(records);
  const got = out.shows.find((s) => s.tmdbId === 1399)!;
  assert.deepEqual(got.episodes, [
    { s: 1, e: 1, at: "2019-05-03T18:15:08.000Z" },
    { s: 1, e: 2, at: "2019-05-04T18:15:08.000Z" },
    { s: 0, e: 1, at: "2019-05-05T18:15:08.000Z" },
  ]);
  assert.equal(got.rating, 9);
  assert.equal(got.state, undefined);
  assert.equal(out.shows.find((s) => s.tmdbId === 48866)!.state, "dropped");
  /* مسلسلٌ في المكتبة بلا حلقة يدخلها «لم يبدأ» */
  assert.deepEqual(out.shows.find((s) => s.tmdbId === 60694)!.episodes, []);
});

test("الفيلمُ المشاهَد بيومه الأوّل وتقييمه، و«لاحقاً» يدخل بلا مشاهدة، والمشاهَدُ خارج المكتبة لا يضيع", async () => {
  const { records } = await parseBingersFiles(csvs());
  const out = build(records);
  const by = (id: number) => out.movies.find((m) => m.tmdbId === id)!;
  assert.deepEqual([by(322).watched, by(322).at, by(322).rating], [true, "2026-09-16T22:10:47.674Z", 8]);
  assert.deepEqual([by(585).watched, by(585).at], [true, "2019-10-03T20:56:50.000Z"]);
  assert.equal(by(210577).watched, false);
  assert.equal(by(206487).watched, true);
});

test("مسلسلٌ بمعرّف TVDB وحدَه يُطابَق مرّةً لحلقاته وقائمته", async () => {
  const { records } = await parseBingersFiles(csvs());
  const { requests } = groupForResolve(records);
  assert.deepEqual(requests, [{ kind: "tvdb-tv", id: 345246 }]);
  const out = build(records, { "tvdb:345246": tvdbHit(72844, "The Haunting of Hill House") });
  assert.deepEqual(out.shows.find((s) => s.tmdbId === 72844)!.episodes, [{ s: 1, e: 1, at: "2019-06-14T21:27:36.000Z" }]);
  assert.deepEqual(
    out.lists.find((l) => l.name === "Rainy days")!.items.map((i) => i.tmdbId),
    [585, 1399, 72844],
  );
  /* ولم يُطابَق ⇐ يُذكر باسمه */
  assert.ok(build(records).unmatched.includes("The Haunting"));
});

test("القوائمُ بأسمائها وترتيبها، والمفضّلةُ وحدَها", async () => {
  const { records } = await parseBingersFiles(csvs());
  const out = build(records, { "tvdb:345246": tvdbHit(72844, "The Haunting of Hill House") });
  assert.deepEqual(out.lists.map((l) => l.name), ["Rainy days", "Mixed"]);
  assert.deepEqual(out.favorites.map((f) => [f.mediaType, f.tmdbId]), [["movie", 585], ["tv", 1399]]);
});

test("مقياسُ عشرٍ في الملفّ يُؤخذ كما هو", async () => {
  const r10 = `type,title,tvdb_id,tmdb_id,season_number,episode_number,rating\nmovie,A,,11,,,8\nmovie,B,,12,,,3\n`;
  const { records } = await parseBingersFiles([{ name: "ratings.csv", buf: enc(r10) }]);
  const out = build(records);
  assert.deepEqual(out.movies.map((m) => m.rating), [8, 3]);
});

test("ملفُّ zip كما يُصدَّر — بمجلّده، ونسخُ macOS الظلّيّةُ لا تُذكر", async () => {
  setInflateRaw(null);
  const buf = zip([
    { name: "bingers-export/library.csv", text: library },
    { name: "bingers-export/watches.csv", text: watches },
    { name: "__MACOSX/bingers-export/._library.csv", text: "junk" },
  ]);
  const out = await parseBingersFiles([{ name: "bingers-export.zip", buf }]);
  assert.equal(out.parsedFiles.length, 2);
  assert.deepEqual(out.skippedFiles, []);
  assert.ok(build(out.records).shows.some((s) => s.tmdbId === 1399));
});
