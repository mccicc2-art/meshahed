import { test } from "node:test";
import assert from "node:assert/strict";
import { HOME_SERVER_TOKEN_RE, JELLYFIN_TEMPLATE, parseHomeEvent } from "./homeServer.ts";

/* Plex — شكلُ `payload` في Webhooks (Plex Pass): حلقةٌ بلغت ٩٠٪ */
const PLEX_EPISODE = {
  event: "media.scrobble",
  user: true,
  Account: { id: 1, title: "me" },
  Metadata: {
    type: "episode",
    title: "Ozymandias",
    grandparentTitle: "Breaking Bad",
    parentIndex: 5,
    index: 14,
    guid: "plex://episode/5d9c0",
    Guid: [{ id: "imdb://tt2301451" }, { id: "tmdb://62161" }, { id: "tvdb://4639411" }],
  },
};

test("Plex: حلقةٌ انتهت — معرّفاتُ الحلقة واسمُ المسلسل وموسمُها", () => {
  assert.deepEqual(parseHomeEvent(PLEX_EPISODE), {
    server: "plex",
    kind: "episode",
    finished: true,
    title: "Breaking Bad",
    year: undefined,
    ids: { imdb: "tt2301451", tmdb: 62161, tvdb: 4639411 },
    season: 5,
    episode: 14,
  });
});

test("Plex: التشغيلُ والإيقافُ المؤقّت ليسا انتهاءً، والموسيقى ليست لنا", () => {
  assert.equal(parseHomeEvent({ ...PLEX_EPISODE, event: "media.play" })?.finished, false);
  assert.equal(parseHomeEvent({ ...PLEX_EPISODE, event: "media.pause" })?.finished, false);
  assert.equal(parseHomeEvent({ event: "media.scrobble", Metadata: { type: "track", title: "Song" } }), null);
});

test("Plex: فيلمٌ بسنته ورقمه في TMDB", () => {
  const ev = parseHomeEvent({ event: "media.scrobble", Metadata: { type: "movie", title: "Heat", year: 1995, Guid: [{ id: "tmdb://949" }, { id: "imdb://tt0113277" }] } });
  assert.deepEqual(ev, { server: "plex", kind: "movie", finished: true, title: "Heat", year: 1995, ids: { tmdb: 949, imdb: "tt0113277" }, season: undefined, episode: undefined });
});

test("Jellyfin: قالبُنا بعد أن تملأه الإضافة — والانتهاءُ يحتاج «اكتمل»", () => {
  const filled = JELLYFIN_TEMPLATE.replace("{{NotificationType}}", "PlaybackStop")
    .replace("{{PlayedToCompletion}}", "True")
    .replace("{{ItemType}}", "Episode")
    .replace("{{Name}}", "Pilot")
    .replace("{{SeriesName}}", "Dark")
    .replace("{{Year}}", "2017")
    .replace("{{SeasonNumber}}", "1")
    .replace("{{EpisodeNumber}}", "1")
    .replace("{{Provider_tmdb}}", "")
    .replace("{{Provider_imdb}}", "tt5737862")
    .replace("{{Provider_tvdb}}", "6219893");
  const ev = parseHomeEvent(JSON.parse(filled));
  assert.deepEqual(ev, { server: "jellyfin", kind: "episode", finished: true, title: "Dark", year: undefined, ids: { tmdb: undefined, imdb: "tt5737862", tvdb: 6219893 }, season: 1, episode: 1 });
  assert.equal(parseHomeEvent(JSON.parse(filled.replace('"True"', '"False"')))?.finished, false);
});

test("Jellyfin: قالبٌ كتبه صاحبه بأسماء المتغيّرات نفسِها", () => {
  const ev = parseHomeEvent({ NotificationType: "PlaybackStop", PlayedToCompletion: true, ItemType: "Movie", Name: "Arrival", Year: 2016, Provider_tmdb: "329865" });
  assert.equal(ev?.kind, "movie");
  assert.equal(ev?.finished, true);
  assert.deepEqual(ev?.ids, { tmdb: 329865, imdb: undefined, tvdb: undefined });
});

test("Emby: playback.stop مكتملاً، وitem.markplayed، وما لم يكتمل", () => {
  const base = {
    Event: "playback.stop",
    Item: { Type: "Episode", Name: "Pilot", SeriesName: "Severance", ParentIndexNumber: 1, IndexNumber: 1, ProviderIds: { Imdb: "tt11280740", Tvdb: "7801806" } },
    PlaybackInfo: { PlayedToCompletion: true },
  };
  assert.deepEqual(parseHomeEvent(base), { server: "emby", kind: "episode", finished: true, title: "Severance", year: undefined, ids: { tmdb: undefined, imdb: "tt11280740", tvdb: 7801806 }, season: 1, episode: 1 });
  assert.equal(parseHomeEvent({ ...base, PlaybackInfo: { PlayedToCompletion: false } })?.finished, false);
  assert.equal(parseHomeEvent({ ...base, Event: "item.markplayed", PlaybackInfo: undefined })?.finished, true);
});

test("ما ليس لنا: لا شيء", () => {
  assert.equal(parseHomeEvent(null), null);
  assert.equal(parseHomeEvent({ hello: "world" }), null);
  assert.equal(parseHomeEvent({ Event: "system.notificationtest", Item: {} }), null);
});

test("شكلُ الرمز", () => {
  assert.ok(HOME_SERVER_TOKEN_RE.test(`lh_${"a".repeat(43)}`));
  assert.ok(!HOME_SERVER_TOKEN_RE.test(`ls_${"a".repeat(43)}`));
});
