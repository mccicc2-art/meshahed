import { test } from "node:test";
import assert from "node:assert/strict";
import { countKeys, fillerCount, fillerKeys, parseRanges } from "./filler.ts";

test("each list matches the filler count stated by its source", () => {
  /* animefillerlist.com، ١ نوفمبر ٢٠٢٦ — العددُ المعلَن لكلِّ عمل */
  const stated: Record<number, number> = {
    37854: 94, 46260: 90, 31910: 203, 30984: 163, 30983: 578, 46261: 61, 73223: 18, 70881: 28, 35610: 35, 12971: 38,
  };
  for (const [id, n] of Object.entries(stated)) assert.equal(fillerCount(Number(id)), n, `tmdb ${id}`);
});

test("ranges parse inclusive, sorted, without duplicates", () => {
  assert.deepEqual(parseRanges("5 1-3 2-4"), [1, 2, 3, 4, 5]);
});

test("absolute numbering: the episode keeps its number in its season's window", () => {
  /* ناروتو بترقيمٍ مطلق عبر المواسم: الموسم ٤ يبدأ من ١٥٤ */
  const k = fillerKeys(46260, [
    { season_number: 1, episode_count: 57, first_episode: 1 },
    { season_number: 2, episode_count: 43, first_episode: 58 },
    { season_number: 3, episode_count: 53, first_episode: 101 },
    { season_number: 4, episode_count: 67, first_episode: 154 },
  ]);
  assert.ok(k);
  assert.ok(k.has("1:26"));
  assert.ok(k.has("2:97"));
  assert.ok(k.has("3:101"));
  assert.ok(k.has("4:219"));
  assert.equal(k.size, 90);
});

test("relative numbering: the episode restarts in each season", () => {
  /* فيري تيل: موسمٌ أوّل ٤٨ ثمّ ثانٍ — الحلقةُ المطلقة ٥٠ هي الثانية في الموسم ٢ */
  const k = fillerKeys(46261, [
    { season_number: 1, episode_count: 48 },
    { season_number: 2, episode_count: 280 },
  ]);
  assert.ok(k?.has("1:9"));
  assert.ok(k?.has("2:2"));
});

test("a finished show with fewer TMDB episodes ⇒ no filler (numbers would drift); specials never count; ongoing shows map what exists", () => {
  assert.equal(fillerKeys(46260, [{ season_number: 1, episode_count: 210 }]), null);
  assert.equal(fillerKeys(46260, [{ season_number: 0, episode_count: 30 }, { season_number: 1, episode_count: 200 }]), null);
  assert.equal(fillerKeys(999999, [{ season_number: 1, episode_count: 10 }]), null);
  /* عملٌ مستمرّ بلا حارس: ما وراء آخرِ حلقات TMDB يُترك حتى تصل (كونان ١٢١٨ والفلرُ يبلغ ١٢١٩) */
  assert.equal(fillerKeys(30983, [{ season_number: 1, episode_count: 1218 }])?.size, 577);
  assert.equal(fillerKeys(30983, [{ season_number: 1, episode_count: 1230 }])?.size, 578);
});

test("countKeys counts one season inside a range", () => {
  assert.equal(countKeys(["1:5", "1:6", "1:50", "2:5"], 1, 1, 10), 2);
});
