import { test } from "node:test";
import assert from "node:assert/strict";
import { groupWeeks, totalsLine, verbOf, weekRange, weekTotals, type ActivityItem } from "./activityDays.ts";
import { getDict } from "./i18n.ts";

const t = getDict("en");
const at = (k: string) => `${k}T12:00:00.000Z`;
const ep = (k: string, id: number, e: number): ActivityItem => ({ id: `${k}-${id}-${e}`, kind: "watch", at: at(k), mediaType: "tv", tmdbId: id, title: `#${id}`, poster: null, season: 1, episode: e });
const movie = (k: string, id: number): ActivityItem => ({ id: `${k}-m${id}`, kind: "watch", at: at(k), mediaType: "movie", tmdbId: id, title: `#${id}`, poster: null });
const review = (k: string, id: number): ActivityItem => ({ id: `${k}-r${id}`, kind: "review", at: at(k), mediaType: "movie", tmdbId: id, title: `#${id}`, poster: null, rating: 8, review: "nice" });

test("weeks are calendar weeks from Sunday, labelled this week / last week / a date range", () => {
  const items = [review("2026-11-22", 9), ep("2026-11-21", 1, 1), ep("2026-11-21", 1, 2), ep("2026-11-18", 2, 1), movie("2026-11-14", 3), movie("2026-11-10", 4), ep("2026-10-29", 5, 1176)];
  const weeks = groupWeeks(items, false, t, "en", "2026-11-23");
  /* اليوم الاثنين ٢٣: الأحد ٢٢ من هذا الأسبوع، و١٥–٢١ الماضي، و٨–١٤ قبله، و٢٩ أكتوبر في أسبوع ٢٥–٣١ */
  assert.deepEqual(weeks.map((w) => w.index), [0, 1, 2, 4]);
  assert.equal(weeks[0].label, "This week");
  assert.equal(weeks[1].label, "Last week");
  assert.match(weeks[2].label, /–/);
  assert.equal(totalsLine(weeks[0].totals, t), "1 review");
  assert.equal(totalsLine(weeks[1].totals, t), "3 episodes");
  assert.equal(weeks[1].totals.shows, 2);
  assert.equal(totalsLine(weeks[2].totals, t), "2 movies");
  /* the two House episodes of one day stay one row */
  assert.equal(weeks[1].days.find((d) => d.key === "2026-11-21")?.rows.length, 1);
});

test("an episode reads «Watched», not «Finished»", () => {
  assert.equal(verbOf(ep("2026-11-21", 1, 1), t), "Watched");
});

test("Arabic counts follow the number rule", () => {
  const ar = getDict("ar");
  assert.equal(ar.actNEpisodes(1), "حلقة واحدة");
  assert.equal(ar.actNEpisodes(2), "حلقتان");
  assert.equal(ar.actNEpisodes(3), "3 حلقات");
  assert.equal(ar.actNMovies(11), "11 فيلمًا");
  assert.equal(ar.actNShows(150), "150 مسلسل");
  assert.equal(totalsLine(weekTotals([]), t), "");
});

test("weekRange runs Sunday to Saturday", () => {
  assert.equal(weekRange("2026-11-26", 0, "en"), "Nov 22 – Nov 28");
  assert.equal(weekRange("2026-11-22", 1, "en"), "Nov 15 – Nov 21");
});
