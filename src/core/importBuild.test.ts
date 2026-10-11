import { test } from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { buildImport } from "./importBuild.ts";
import { groupForResolve, readZip, recordKey, setInflateRaw, type RawRecord } from "./importParse.ts";
import type { ResolveResult } from "./importer.ts";

const hit = (tmdbId: number, title: string, extra: Partial<NonNullable<ResolveResult>> = {}): ResolveResult => ({
  tmdbId,
  mediaType: "tv",
  title,
  posterPath: `/${tmdbId}.jpg`,
  ...extra,
});

function resolve(records: RawRecord[], answers: Record<string, ResolveResult>) {
  const { keys } = groupForResolve(records);
  return new Map<string, ResolveResult>(keys.map((k) => [k, answers[k] ?? null]));
}

test("حلقاتُ مسلسلٍ بالاسم تُجمع تحت عملٍ واحد، والمكرّرُ يُحذف", () => {
  const records: RawRecord[] = [
    { kind: "ep-name", show: "Dark", year: 2017, s: 1, e: 1, at: "2020-01-01T00:00:00.000Z" },
    { kind: "ep-name", show: "Dark", year: 2017, s: 1, e: 2 },
    { kind: "ep-name", show: "Dark", year: 2017, s: 1, e: 1 },
  ];
  const out = buildImport(records, resolve(records, { "tv:dark:2017": hit(70523, "Dark") }));
  assert.equal(out.shows.length, 1);
  assert.deepEqual(out.shows[0].episodes, [{ s: 1, e: 1, at: "2020-01-01T00:00:00.000Z" }, { s: 1, e: 2, at: undefined }]);
  assert.equal(out.shows[0].posterPath, "/70523.jpg");
  assert.deepEqual(out.unmatched, []);
});

test("ما لم يُطابَق يُذكر باسمه مرّةً واحدة", () => {
  const records: RawRecord[] = [
    { kind: "ep-name", show: "Nope", s: 1, e: 1 },
    { kind: "ep-name", show: "Nope", s: 1, e: 2 },
    { kind: "movie-name", name: "Ghost Film" },
  ];
  const out = buildImport(records, resolve(records, {}));
  assert.deepEqual(out.unmatched, ["Nope", "Ghost Film"]);
  assert.equal(out.shows.length + out.movies.length, 0);
});

test("حلقةٌ بمعرّف TVDB تأخذ موسمَها وحلقتَها من المطابقة", () => {
  const records: RawRecord[] = [{ kind: "ep-tvdb", episodeTvdbId: 9, at: "2021-05-05T00:00:00.000Z" }];
  const out = buildImport(records, resolve(records, { "tvdbe:9": hit(1, "Show", { season: 2, episode: 4 }) }));
  assert.deepEqual(out.shows[0].episodes, [{ s: 2, e: 4, at: "2021-05-05T00:00:00.000Z" }]);
});

test("قائمةُ المشاهدة لاحقاً لا تدهس مشاهدةً سبقتها، والعكسُ يختمها مشاهَدة", () => {
  const mv = hit(5, "Heat", { mediaType: "movie" });
  const a: RawRecord[] = [
    { kind: "movie-name", name: "Heat", at: "2019-01-01T00:00:00.000Z", rating: 8 },
    { kind: "movie-watchlist", name: "Heat" },
  ];
  const outA = buildImport(a, resolve(a, { "mv:heat:": mv }));
  assert.equal(outA.movies[0].watched, true);
  assert.equal(outA.movies[0].rating, 8);
  const b: RawRecord[] = [a[1], a[0]];
  assert.equal(buildImport(b, resolve(b, { "mv:heat:": mv })).movies[0].watched, true);
});

test("أقدمُ تاريخٍ لمشاهدة الفيلم يُحفظ", () => {
  const records: RawRecord[] = [
    { kind: "movie-name", name: "Heat", at: "2022-01-01T00:00:00.000Z" },
    { kind: "movie-name", name: "Heat", at: "2019-01-01T00:00:00.000Z" },
  ];
  const out = buildImport(records, resolve(records, { "mv:heat:": hit(5, "Heat", { mediaType: "movie" }) }));
  assert.equal(out.movies[0].at, "2019-01-01T00:00:00.000Z");
});

test("ما وصل بمعرّف TMDB يُبنى بلا مطابقة، و«أنوي مشاهدته» لا يُختم", () => {
  const records: RawRecord[] = [
    { kind: "tmdb-show", tmdbId: 10, title: "A", episodes: [{ s: 1, e: 1 }], rating: 9 },
    { kind: "tmdb-movie", tmdbId: 20, title: "B", planned: true },
    { kind: "tmdb-movie", tmdbId: 21, title: "C" },
  ];
  assert.equal(groupForResolve(records).requests.length, 0);
  const out = buildImport(records, new Map());
  assert.equal(out.shows[0].rating, 9);
  assert.equal(out.shows[0].posterPath, null);
  assert.deepEqual(out.movies.map((m) => m.watched), [false, true]);
});

test("مفتاحُ السجلّ هو مفتاحُ التجميع", () => {
  const r: RawRecord = { kind: "rating-show", show: "Dark", rating: 10 };
  assert.equal(groupForResolve([r]).keys[0], recordKey(r));
  const out = buildImport([r], new Map([[recordKey(r), hit(70523, "Dark")]]));
  assert.equal(out.shows[0].rating, 10);
});

/** zip بمدخلٍ واحدٍ مضغوط (طريقة ٨) — يكفي لقارئ الدليل المركزيّ */
function zipOf(name: string, text: string): ArrayBuffer {
  const data = deflateRawSync(Buffer.from(text));
  const n = Buffer.from(name);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt16LE(n.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt16LE(n.length, 28);
  central.writeUInt32LE(0, 42);
  const cdOff = 30 + n.length + data.length;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(46 + n.length, 12);
  eocd.writeUInt32LE(cdOff, 16);
  const all = Buffer.concat([local, n, data, central, n, eocd]);
  return all.buffer.slice(all.byteOffset, all.byteOffset + all.length) as ArrayBuffer;
}

test("readZip يقرأ بالفاكّ المحقون كما يقرأ بأداة المنصّة", async () => {
  const text = "Name,Year\nمرحبا,2020\n".repeat(500);
  const buf = zipOf("watched.csv", text);
  const native = await readZip(buf);
  assert.equal(new TextDecoder().decode(native[0].bytes), text);
  const { inflateRawSync } = await import("node:zlib");
  let called = 0;
  setInflateRaw((d) => {
    called++;
    return new Uint8Array(inflateRawSync(d));
  });
  try {
    const injected = await readZip(buf);
    assert.equal(called, 1);
    assert.equal(injected[0].name, "watched.csv");
    assert.equal(new TextDecoder().decode(injected[0].bytes), text);
  } finally {
    setInflateRaw(null);
  }
});
