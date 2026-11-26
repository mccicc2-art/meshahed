import { test } from "node:test";
import assert from "node:assert/strict";
import { linkSignalHref, linkSignalText, linkWhat, mergeByTime, parseLinkRow, type LinkSignalRow } from "./linkSignals.ts";
import { getDict } from "./i18n.ts";

/**
 * ====== المهمّة ٥٦١ — أسطرُ الجرس من الربوط ======
 * الجملةُ عقدٌ بين الجرس (ويب وتطبيق) وإشعار الجوال: ما يقوله الجوالُ هو ما يجده في الجرس.
 */

const ar = getDict("ar");
const en = getDict("en");
const base: LinkSignalRow = {
  kind: "link_added",
  source: "osn",
  mediaType: null,
  tmdbId: null,
  title: "Chernobyl",
  works: 1,
  season: 1,
  episode: 3,
  episodes: 1,
  movies: 0,
  signalId: null,
  at: "2026-11-26T04:00:00Z",
  isNew: true,
};

test("حلقةٌ واحدة: اسمُها ورقمُها", () => {
  assert.equal(linkSignalText(base, ar), "أُضيفت من OSN+\u200E: Chernobyl · S1 E3");
  assert.equal(linkSignalText(base, en), "Added from OSN+\u200E: Chernobyl · S1 E3");
});

test("حلقاتٌ من عملٍ واحد: العددُ من العمل", () => {
  assert.equal(linkWhat({ ...base, episodes: 2, season: null, episode: null }, ar), "حلقتان من Chernobyl");
});

test("أكثرُ من عمل: العددُ ومنها الأوّل", () => {
  const r = { ...base, source: "netflix" as const, title: "Dark", works: 2, episodes: 4, movies: 1, season: null, episode: null };
  assert.equal(linkSignalText(r, ar), "أُضيفت من Netflix: 4 حلقات وفيلم واحد، منها Dark");
  assert.equal(linkSignalText(r, en), "Added from Netflix: 4 episodes and 1 movie, including Dark");
});

test("فيلمٌ واحد بلا رقم حلقة", () => {
  assert.equal(linkWhat({ ...base, episodes: 0, movies: 1, season: null, episode: null, title: "Gone Girl" }, ar), "Gone Girl");
});

test("بلا اسم: العددُ وحده", () => {
  assert.equal(linkWhat({ ...base, title: null, episodes: 3, season: null, episode: null }, en), "3 episodes");
});

test("السؤال: حلقة · فيلم · بلا اسم", () => {
  const ask = { ...base, kind: "link_ask" as const, source: "stremio" as const, mediaType: "tv" as const, tmdbId: 70523, title: "Dark", season: 1, episode: 5, signalId: 9 };
  assert.equal(linkSignalText(ask, ar), "شغّلت Dark · S1 E5 في Stremio. شاهدتها؟");
  assert.equal(linkSignalText({ ...ask, mediaType: "movie", season: null, episode: null }, ar), "شغّلت Dark في Stremio. شاهدته؟");
  assert.equal(linkSignalText({ ...ask, title: null }, ar), "شغّلت عملاً في Stremio. شاهدته؟");
});

test("الوجهة: صفحةُ العمل حين يُعرف، ودفعةُ المنصّة بلا وجهة ويب", () => {
  assert.equal(linkSignalHref({ ...base, tmdbId: 136315, mediaType: "tv" }), "/show/136315");
  assert.equal(linkSignalHref({ ...base, tmdbId: 210577, mediaType: "movie" }), "/movie/210577");
  assert.equal(linkSignalHref(base), null);
});

test("القراءة: ما لا يُعرف مصدرُه أو سؤالٌ بلا معرّف يسقط", () => {
  const ok = parseLinkRow({ kind: "link_added", source: "kodi", media_type: "tv", tmdb_id: 1, title: " X ", works: 1, season: null, episode: null, episodes: 2, movies: 0, signal_id: null, at: "2026-11-26T00:00:00Z", is_new: true });
  assert.equal(ok?.title, "X");
  assert.equal(ok?.episodes, 2);
  assert.equal(parseLinkRow({ kind: "link_added", source: "hulu", at: "x" }), null);
  assert.equal(parseLinkRow({ kind: "link_ask", source: "stremio", at: "2026-11-26T00:00:00Z", signal_id: null }), null);
  assert.equal(parseLinkRow({ kind: "other", source: "kodi", at: "2026-11-26T00:00:00Z" }), null);
});

test("الدمج بالأحدث أوّلاً", () => {
  const out = mergeByTime([{ at: "2026-11-25T00:00:00Z", n: 1 }], [{ at: "2026-11-26T00:00:00Z", n: 2 }]);
  assert.deepEqual(out.map((x) => x.n), [2, 1]);
});
