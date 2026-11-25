import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildNetflixRecords,
  historyRequest,
  isWatched,
  mergeSeasonPages,
  parseSeasonEpisodes,
  parseViewingHistory,
  persistedIdIn,
  seasonRequest,
  seasonsToFetch,
  watchedShare,
  type NetflixSeason,
} from "./netflix.ts";
import { groupForResolve, recordKey } from "./importParse.ts";

/* العيّناتُ من حساب أحمد كما أعادتها نتفليكس في الفحص S0 (٢٥ نوفمبر ٢٠٢٦) — الأسماءُ بالإنجليزيّة (ترويسةُ اللغة) */
const HISTORY = {
  data: {
    profile: {
      __typename: "Profile",
      guid: "PROFILE",
      viewingHistoryPaginated: {
        edges: [
          { cursor: "c1", node: { lastWatchedTimeMs: 1795263080899, video: { __typename: "Episode", videoId: 80014298, title: "Pilot", parentSeason: { videoId: 70101455, title: "Season 1" }, parentShow: { videoId: 70155590, title: "The Mentalist" } } } },
          { cursor: "c2", node: { lastWatchedTimeMs: 1795222838733, video: { __typename: "Episode", videoId: 70274491, title: "Paternity", parentSeason: { videoId: 70032271, title: "Season 1" }, parentShow: { videoId: 70136117, title: "House" } } } },
          { cursor: "c3", node: { lastWatchedTimeMs: 1795220260703, video: { __typename: "Episode", videoId: 70274490, title: "Pilot", parentSeason: { videoId: 70032271, title: "Season 1" }, parentShow: { videoId: 70136117, title: "House" } } } },
          { cursor: "c4", node: { lastWatchedTimeMs: 1794450188310, video: { __typename: "Episode", videoId: 81677444, title: "THE BEGINNING AND THE END", parentSeason: { videoId: 81218765, title: "Season 2" }, parentShow: { videoId: 80217863, title: "ONE PIECE" } } } },
          { cursor: "c5", node: { lastWatchedTimeMs: 1794450045097, video: { __typename: "Episode", videoId: 80218003, title: "ROMANCE DAWN", parentSeason: { videoId: 80217940, title: "Season 1" }, parentShow: { videoId: 80217863, title: "ONE PIECE" } } } },
        ],
        pageInfo: { hasNextPage: false, endCursor: "c5" },
      },
    },
  },
};

const season = (videoId: number, number: number, show: number, eps: [number, number, string, number, number | null][]) => ({
  data: {
    videos: [
      {
        videoId,
        title: `Season ${number}`,
        number,
        hideEpisodeNumbers: false,
        parentShow: { videoId: show },
        episodes: {
          edges: eps.map(([id, n, title, runtime, pos]) => ({ cursor: String(id), node: { videoId: id, number: n, title, runtimeSec: runtime, displayRuntimeSec: runtime, bookmark: pos == null ? null : { position: pos } } })),
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    ],
  },
});

const HOUSE_S1 = season(70032271, 1, 70136117, [
  [70274490, 1, "Pilot", 2652, 2612],
  [70274491, 2, "Paternity", 2598, 2559],
  [70274492, 3, "Occam's Razor", 2651, null],
]);
const MENTALIST_S1 = season(70101455, 1, 70155590, [[80014298, 1, "Pilot", 2698, 689]]);
const ONEPIECE_S2 = season(81218765, 2, 80217863, [[81677444, 1, "THE BEGINNING AND THE END", 4019, 3803]]);

test("السجلّ: كلُّ مشاهدةٍ بموسمها ومسلسلها ووقتها", () => {
  const p = parseViewingHistory(HISTORY);
  assert.equal(p.items.length, 5);
  assert.equal(p.hasNext, false);
  assert.deepEqual(p.items[1], { videoId: 70274491, kind: "episode", title: "Paternity", at: 1795222838733, seasonId: 70032271, seasonTitle: "Season 1", showId: 70136117, showTitle: "House" });
  assert.deepEqual(seasonsToFetch(p.items).sort(), [70032271, 70101455, 80217940, 81218765].sort());
});

test("السجلّ: ردٌّ معطوب لا يُسقط شيئاً", () => {
  assert.deepEqual(parseViewingHistory(null), { items: [], hasNext: false, next: null });
  assert.deepEqual(parseViewingHistory({ errors: [{ message: "NOT_FOUND" }], data: { profile: null } }).items, []);
  const one = parseViewingHistory({ data: { profile: { viewingHistoryPaginated: { edges: [{ node: { video: { videoId: 1 } } }, { node: { lastWatchedTimeMs: 5, video: { __typename: "Movie", videoId: 2, title: "Glass Onion" } } }] } } } });
  assert.equal(one.items.length, 1);
  assert.equal(one.items[0].kind, "movie");
});

test("الموسم: رقمُه، ولكلِّ حلقةٍ رقمُها ومدّتُها وموضعُ التوقّف", () => {
  const s = parseSeasonEpisodes(HOUSE_S1)!;
  assert.equal(s.number, 1);
  assert.equal(s.showId, 70136117);
  assert.deepEqual(s.episodes[0], { videoId: 70274490, number: 1, title: "Pilot", runtimeSec: 2652, positionSec: 2612 });
  assert.equal(s.episodes[2].positionSec, null);
  assert.equal(parseSeasonEpisodes({ data: { videos: [] } }), null);
});

test("٩٠٪: هاوس ٩٨٫٥٪ تُحسب، والمنتاليست ٢٥٫٥٪ لا، وما لم يُشغَّل لا", () => {
  assert.equal(isWatched(2612, 2652), true);
  assert.equal(isWatched(3803, 4019), true);
  assert.equal(isWatched(689, 2698), false);
  assert.equal(isWatched(null, 2651), false);
  assert.equal(isWatched(100, null), false);
  assert.equal(isWatched(2430, 2700), true, "٩٠٪ تماماً تُحسب");
  assert.equal(Math.round(watchedShare(689, 2698)! * 1000), 255);
});

test("البناء: الحلقاتُ المكتملة صفوفٌ برقمَي نتفليكس، والناقصةُ «بدأته»، وما لا موسمَ له يُتخطّى", () => {
  const items = parseViewingHistory(HISTORY).items;
  const seasons = new Map<number, NetflixSeason>(
    [HOUSE_S1, MENTALIST_S1, ONEPIECE_S2].map((j) => {
      const s = parseSeasonEpisodes(j)!;
      return [s.seasonId, s];
    }),
  );
  const b = buildNetflixRecords(items, seasons);
  assert.deepEqual(
    b.records.map((r) => (r.kind === "ep-name" ? `${r.show} S${r.s}E${r.e}` : "?")),
    ["House S1E2", "House S1E1", "ONE PIECE S2E1"],
  );
  const house = b.records[1];
  assert.ok(house.kind === "ep-name");
  assert.deepEqual(house.nfx, { show: "70136117", title: "Pilot" });
  assert.equal(house.at, new Date(1795220260703).toISOString());
  assert.equal(b.partial.length, 1);
  assert.equal(b.partial[0].show, "The Mentalist");
  assert.equal(b.skipped, 1, "موسمُ One Piece الأوّل لم يُطلب في العيّنة");
  assert.equal(b.newest, 1795263080899);
});

test("من الآن فقط / بعد آخر مزامنة: ما شوهد عند الحدّ أو قبله لا يُقرأ، والأحدثُ يبقى من القراءة كلِّها", () => {
  const items = parseViewingHistory(HISTORY).items;
  const seasons = new Map<number, NetflixSeason>([[70032271, parseSeasonEpisodes(HOUSE_S1)!]]);
  const b = buildNetflixRecords(items, seasons, new Map(), { after: 1795220260703 });
  assert.deepEqual(
    b.records.map((r) => (r.kind === "ep-name" ? r.e : 0)),
    [2],
  );
  assert.equal(b.newest, 1795263080899);
});

test("الأفلام: بلا تقدّمٍ معروف «بدأته» لا مشاهدة، وبـ٩٠٪ فيلمٌ بالاسم", () => {
  const items = parseViewingHistory({ data: { profile: { viewingHistoryPaginated: { edges: [{ node: { lastWatchedTimeMs: 10, video: { __typename: "Movie", videoId: 7, title: "Glass Onion" } } }] } } } }).items;
  assert.equal(buildNetflixRecords(items, new Map()).records.length, 0);
  assert.equal(buildNetflixRecords(items, new Map()).partial.length, 1);
  const done = buildNetflixRecords(items, new Map(), new Map([[7, { runtimeSec: 8400, positionSec: 8000 }]]));
  assert.deepEqual(done.records, [{ kind: "movie-name", name: "Glass Onion", at: new Date(10).toISOString() }]);
});

test("موسمٌ يخفي أرقامَ حلقاته لا يُعتمد رقمُه", () => {
  const j = season(1, 1, 9, [[2, 1, "X", 100, 100]]);
  (j.data.videos[0] as { hideEpisodeNumbers: boolean }).hideEpisodeNumbers = true;
  const items = [{ videoId: 2, kind: "episode" as const, title: "X", at: 1, seasonId: 1, seasonTitle: "Season 1", showId: 9, showTitle: "Show" }];
  const b = buildNetflixRecords(items, new Map([[1, parseSeasonEpisodes(j)!]]));
  assert.equal(b.records.length, 0);
  assert.equal(b.skipped, 1);
});

test("المطابقة: مفتاحُ مسلسل نتفليكس لا اسمُه — والطلبُ يحمل حلقةً منه", () => {
  const a = { kind: "ep-name" as const, show: "ONE PIECE", s: 2, e: 1, nfx: { show: "80217863", title: "THE BEGINNING AND THE END" } };
  const b = { kind: "ep-name" as const, show: "ONE PIECE", s: 1, e: 1, nfx: { show: "80217863", title: "ROMANCE DAWN" } };
  const anime = { kind: "ep-name" as const, show: "One Piece", s: 1, e: 1 };
  assert.equal(recordKey(a), "nfx:80217863");
  assert.notEqual(recordKey(a), recordKey(anime));
  const g = groupForResolve([a, b, anime]);
  assert.equal(g.requests.length, 2);
  assert.deepEqual(g.requests[0], { kind: "netflix-tv", name: "ONE PIECE", show: "80217863", s: 2, e: 1, title: "THE BEGINNING AND THE END" });
  assert.deepEqual(g.requests[1], { kind: "name-tv", name: "One Piece", year: undefined });
});

test("رقمُ الطلب المحفوظ يُقرأ من الحزمة، وغيابُه `null` لا تخمين", () => {
  const bundle = 'x,n.ViewingHistoryPaginatedDocument={__meta__:{q:"d17f5a15-6eff-464c-8099-1a1fe5a4d82c"},kind:"Document"},y';
  assert.equal(persistedIdIn(bundle, "ViewingHistoryPaginated"), "d17f5a15-6eff-464c-8099-1a1fe5a4d82c");
  assert.equal(persistedIdIn(bundle, "PreviewModalEpisodeSelectorSeasonEpisodes"), null);
  assert.equal(persistedIdIn('aViewingHistoryPaginatedDocument={__meta__:{q:"d17f5a15-6eff-464c-8099-1a1fe5a4d82c"}', "ViewingHistoryPaginated"), null, "اسمٌ أطولُ ينتهي به لا يُقبل");
});

test("جسما الطلبين بنسخة ١٠٢ والمؤشّر حين يوجد", () => {
  assert.deepEqual(historyRequest("ID", "G", 100), { operationName: "ViewingHistoryPaginated", variables: { profileGuid: "G", first: 100 }, extensions: { persistedQuery: { id: "ID", version: 102 } } });
  assert.equal(historyRequest("ID", "G", 100, "cur").variables.after, "cur");
  assert.equal(seasonRequest("ID", 70032271, 50).variables.seasonId, 70032271);
  assert.equal(seasonRequest("ID", 1, 50, "c").variables.cursor, "c");
});

test("صفحتا الموسم تُضمّان بلا تكرار", () => {
  const a = parseSeasonEpisodes(season(1, 1, 9, [[2, 1, "A", 100, 100], [3, 2, "B", 100, null]]))!;
  const b = parseSeasonEpisodes(season(1, 1, 9, [[3, 2, "B", 100, null], [4, 3, "C", 100, 95]]))!;
  assert.deepEqual(mergeSeasonPages(a, b).episodes.map((e) => e.number), [1, 2, 3]);
});
