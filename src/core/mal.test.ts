import { test } from "node:test";
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { malStatusOf, parseMalFiles, parseMalXml } from "./mal.ts";
import { buildImport } from "./importBuild.ts";
import { groupForResolve, type RawRecord } from "./importParse.ts";
import type { ResolveResult } from "./importer.ts";
import { malPlacementOf } from "./kitsuEpisode.ts";
import { airedEpisodesSpan, impliedEpisodes } from "./progress.ts";

/* شكلُ تصدير MAL (`animelist_….xml.gz`) — مختصراً إلى ما نقرؤه */
const XML = `<?xml version="1.0" encoding="UTF-8" ?>
<myanimelist>
  <myinfo><user_name>me</user_name></myinfo>
  <anime>
    <series_animedb_id>16498</series_animedb_id>
    <series_title><![CDATA[Shingeki no Kyojin]]></series_title>
    <series_type>TV</series_type>
    <series_episodes>25</series_episodes>
    <my_watched_episodes>25</my_watched_episodes>
    <my_start_date>2019-01-01</my_start_date>
    <my_finish_date>2019-02-01</my_finish_date>
    <my_score>9</my_score>
    <my_status>Completed</my_status>
  </anime>
  <anime>
    <series_animedb_id>25777</series_animedb_id>
    <series_title>Shingeki no Kyojin Season 2 &amp; more</series_title>
    <series_type>TV</series_type>
    <series_episodes>12</series_episodes>
    <my_watched_episodes>5</my_watched_episodes>
    <my_start_date>2020-03-03</my_start_date>
    <my_finish_date>0000-00-00</my_finish_date>
    <my_score>7</my_score>
    <my_status>Dropped</my_status>
  </anime>
  <anime>
    <series_animedb_id>52991</series_animedb_id>
    <series_title><![CDATA[Sousou no Frieren]]></series_title>
    <series_episodes>28</series_episodes>
    <my_watched_episodes>0</my_watched_episodes>
    <my_start_date>0000-00-00</my_start_date>
    <my_finish_date>0000-00-00</my_finish_date>
    <my_score>0</my_score>
    <my_status>Plan to Watch</my_status>
  </anime>
  <anime>
    <series_animedb_id>199</series_animedb_id>
    <series_title><![CDATA[Sen to Chihiro no Kamikakushi]]></series_title>
    <series_episodes>1</series_episodes>
    <my_watched_episodes>1</my_watched_episodes>
    <my_start_date>0000-00-00</my_start_date>
    <my_finish_date>2018-05-05</my_finish_date>
    <my_score>10</my_score>
    <my_status>Completed</my_status>
  </anime>
  <anime>
    <series_animedb_id>18397</series_animedb_id>
    <series_title><![CDATA[Shingeki no Kyojin OVA]]></series_title>
    <series_episodes>8</series_episodes>
    <my_watched_episodes>8</my_watched_episodes>
    <my_score>0</my_score>
    <my_status>2</my_status>
  </anime>
</myanimelist>`;

test("الحالاتُ نصّاً ورقماً", () => {
  assert.equal(malStatusOf("Plan to Watch"), "plan");
  assert.equal(malStatusOf("On-Hold"), "onhold");
  assert.equal(malStatusOf("4"), "dropped");
  assert.equal(malStatusOf("Rewatching?"), null);
});

test("قراءةُ XML: CDATA والكيانات، والتاريخُ «٢ أ» (المكتمل بالانتهاء وغيرُه بالبدء)، والصفرُ ليس تقييماً", () => {
  const out = parseMalXml(XML)!;
  assert.equal(out.length, 5);
  const [aot, aot2, frieren] = out as Extract<RawRecord, { kind: "mal" }>[];
  assert.deepEqual(aot, { kind: "mal", mal: 16498, name: "Shingeki no Kyojin", status: "completed", watched: 25, total: 25, rating: 9, at: "2019-02-01T00:00:00.000Z" });
  assert.equal(aot2.name, "Shingeki no Kyojin Season 2 & more");
  assert.equal(aot2.at, "2020-03-03T00:00:00.000Z");
  assert.equal(frieren.rating, undefined);
  assert.equal(frieren.at, undefined);
  assert.equal(parseMalXml("<mangalist></mangalist>"), null);
});

test("الملفُّ كما نزل (xml.gz) يُفكّ ويُقرأ", async () => {
  const gz = gzipSync(Buffer.from(XML));
  const buf = gz.buffer.slice(gz.byteOffset, gz.byteOffset + gz.byteLength) as ArrayBuffer;
  const out = await parseMalFiles([{ name: "animelist_1730000000_-_123.xml.gz", buf }, { name: "x.gz", buf: new Uint8Array([1, 2, 3]).buffer }]);
  assert.equal(out.records.length, 5);
  assert.deepEqual(out.skippedFiles, ["x.gz"]);
  assert.deepEqual(groupForResolve(out.records).requests[0], { kind: "mal", id: 16498 });
});

/* مداخلُ Fribb الحقيقيّة (قُرئت ٤ نوفمبر) */
test("موضعُ MAL على TMDB: موسمٌ صريح · خاصّةٌ لا شيء · ترقيمٌ متّصلٌ لمسلسلٍ وحيد · فيلم", () => {
  assert.deepEqual(malPlacementOf({ mal_id: 25777, type: "TV", themoviedb_id: { tv: 1429 }, season: { tmdb: 2 } }, 7), { mediaType: "tv", tmdbId: 1429, span: { season: 2, offset: 0 } });
  assert.deepEqual(malPlacementOf({ mal_id: 48583, type: "TV", themoviedb_id: { tv: 1429 }, season: { tmdb: 4 }, episode_offset: { tmdb: 16 } }, 7), { mediaType: "tv", tmdbId: 1429, span: { season: 4, offset: 16 } });
  assert.equal(malPlacementOf({ mal_id: 18397, type: "OVA", themoviedb_id: { tv: 1429 }, season: { tmdb: 0 } }, 7), null);
  assert.deepEqual(malPlacementOf({ mal_id: 21, type: "TV", themoviedb_id: { tv: 37854 } }, 1), { mediaType: "tv", tmdbId: 37854, span: { season: null, offset: 0 } });
  assert.equal(malPlacementOf({ mal_id: 99, type: "TV", themoviedb_id: { tv: 5 } }, 2), null); // لا موسمَ ومعه غيرُه ⇐ تخمين
  assert.deepEqual(malPlacementOf({ mal_id: 199, type: "MOVIE", themoviedb_id: { movie: [129] } }, 0), { mediaType: "movie", tmdbId: 129 });
});

const tvHit = (tmdbId: number, season: number | null, offset = 0): ResolveResult => ({ tmdbId, mediaType: "tv", title: "", posterPath: null, span: { season, offset } });

test("التجميع «١ أ»: المكتملُ موسمُه بعدده · المتروكُ ما شاهده وحالةُ أبعدِ المواسم · أنوي ⇐ مكتبةٌ بلا مدى · والتقييمُ متوسّط", () => {
  const records = parseMalXml(XML)!;
  const answers: Record<string, ResolveResult> = {
    "mal:16498": tvHit(1429, 1),
    "mal:25777": tvHit(1429, 2),
    "mal:52991": tvHit(209867, 1),
    "mal:199": { tmdbId: 129, mediaType: "movie", title: "", posterPath: null },
  };
  const { keys } = groupForResolve(records);
  const out = buildImport(records, new Map(keys.map((k) => [k, answers[k] ?? null])));

  const aot = out.shows.find((s) => s.tmdbId === 1429)!;
  assert.equal(aot.title, "Shingeki no Kyojin");
  assert.deepEqual(aot.spans, [
    { season: 1, offset: 0, count: 25, at: "2019-02-01T00:00:00.000Z" },
    { season: 2, offset: 0, count: 5, at: "2020-03-03T00:00:00.000Z" },
  ]);
  assert.equal(aot.state, "dropped"); // ترك الموسمَ الثاني — أبعدَ ما وصل
  assert.equal(aot.rating, 8); // (٩ + ٧) ÷ ٢

  const fr = out.shows.find((s) => s.tmdbId === 209867)!;
  assert.deepEqual([fr.spans, fr.state, fr.rating], [undefined, undefined, undefined]);

  assert.deepEqual(out.movies, [{ tmdbId: 129, title: "Sen to Chihiro no Kamikakushi", posterPath: null, watched: true, at: "2018-05-05T00:00:00.000Z", rating: 10 }]);
  assert.deepEqual(out.unmatched, ["Shingeki no Kyojin OVA"]); // «٣ أ»
});

test("أكمل الأخيرَ بعد أن ترك الأوّل ⇐ لا حالة", () => {
  const records: RawRecord[] = [
    { kind: "mal", mal: 1, name: "A", status: "dropped", watched: 3, total: 12 },
    { kind: "mal", mal: 2, name: "A2", status: "completed", watched: 12, total: 12 },
  ];
  const out = buildImport(records, new Map([["mal:1", tvHit(7, 1)], ["mal:2", tvHit(7, 2)]]));
  assert.equal(out.shows[0].state, undefined);
});

/* مسلسلٌ من موسمين: الأوّلُ ٤ حلقات، والثاني ٦ عُرضت منها ٥ — ترقيمٌ نسبيّ */
const tv = {
  number_of_episodes: 10,
  seasons: [
    { season_number: 0, episode_count: 1 },
    { season_number: 1, episode_count: 4 },
    { season_number: 2, episode_count: 6 },
  ],
  last_episode_to_air: { season_number: 2, episode_number: 5, air_date: "2020-01-01" },
  next_episode_to_air: { season_number: 2, episode_number: 6, air_date: "2999-01-01" },
} as unknown as Parameters<typeof airedEpisodesSpan>[0];
const keysOf = (eps: { s: number; e: number }[]) => eps.map((x) => `${x.s}x${x.e}`);

test("المدى: من موسمه بإزاحته · يفيض إلى ما بعده · بلا عددٍ بقيّةُ الموسم · بلا موسمٍ من أوّل العمل · ولا يتجاوز المعروض", () => {
  assert.deepEqual(keysOf(airedEpisodesSpan(tv, { season: 2, offset: 2, count: 2 })), ["2x3", "2x4"]);
  assert.deepEqual(keysOf(airedEpisodesSpan(tv, { season: 1, offset: 2, count: 4 })), ["1x3", "1x4", "2x1", "2x2"]);
  assert.deepEqual(keysOf(airedEpisodesSpan(tv, { season: 1, offset: 1, count: null })), ["1x2", "1x3", "1x4"]);
  assert.deepEqual(keysOf(airedEpisodesSpan(tv, { season: null, offset: 0, count: 6 })), ["1x1", "1x2", "1x3", "1x4", "2x1", "2x2"]);
  assert.deepEqual(keysOf(airedEpisodesSpan(tv, { season: 2, offset: 0, count: 50 })), ["2x1", "2x2", "2x3", "2x4", "2x5"]);
  assert.deepEqual(airedEpisodesSpan(tv, { season: 9, offset: 0, count: 3 }), []);
});

test("الضمنيُّ يقرأ المدى بتاريخه", () => {
  const out = impliedEpisodes(tv, { spans: [{ season: 2, offset: 0, count: 2, at: "2021-01-01T00:00:00.000Z" }] });
  assert.deepEqual(out, [
    { s: 2, e: 1, at: "2021-01-01T00:00:00.000Z" },
    { s: 2, e: 2, at: "2021-01-01T00:00:00.000Z" },
  ]);
});
