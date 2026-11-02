import { test } from "node:test";
import assert from "node:assert/strict";
import { nextUnwatchedEpisode } from "./progress.ts";
import { headsOf, shownProgress, skipKeysForTv } from "./skipProgress.ts";

type Tv = Parameters<typeof nextUnwatchedEpisode>[0];
const ep = (season_number: number, episode_number: number, air_date: string | null) =>
  ({ id: 1, name: "", overview: "", season_number, episode_number, air_date, still_path: null, runtime: null });

/* ناروتو كما في TMDB: أربعةُ مواسم بترقيمٍ مطلق (١ · ٥٨ · ١٠١ · ١٥٤)، مكتمل ٢٢٠ — فلرُه ٩٠ (D-1619) */
const naruto = {
  id: 46260,
  number_of_episodes: 220,
  seasons: [
    { season_number: 0, episode_count: 5 },
    { season_number: 1, episode_count: 57 },
    { season_number: 2, episode_count: 43 },
    { season_number: 3, episode_count: 53 },
    { season_number: 4, episode_count: 67 },
  ],
  last_episode_to_air: ep(4, 220, "2007-02-08"),
  next_episode_to_air: null,
} as unknown as Tv;

test("D-1623 — heads carry each season's absolute window", () => {
  assert.deepEqual(
    headsOf(naruto).map((h) => h.first_episode),
    [1, 58, 101, 154],
  );
});

test("D-1623 — progress without hidden filler, the same keys the show page hides", () => {
  const skip = skipKeysForTv(naruto, "filler");
  assert.equal(skip?.size, 90);
  /* شاهد ١–٢٥ ثمّ الفلرَ ٢٦ ثمّ ٢٧ */
  const keys = new Set([...Array.from({ length: 27 }, (_, i) => `1:${i + 1}`), "0:1"]);
  assert.deepEqual(shownProgress(naruto, keys, skip), { aired: 130, watched: 26 });
  assert.deepEqual(shownProgress(naruto, keys, null), { aired: 220, watched: 27 });
  /* «التالية» تتخطّى المخفيّ */
  const upTo96 = new Set(Array.from({ length: 96 }, (_, i) => `${i < 57 ? 1 : 2}:${i + 1}`));
  assert.deepEqual(nextUnwatchedEpisode(naruto, upTo96, skip), { season: 2, episode: 98 });
  assert.deepEqual(nextUnwatchedEpisode(naruto, upTo96), { season: 2, episode: 97 });
});

test("D-1623 — 'all' and shows outside the lists hide nothing", () => {
  assert.equal(skipKeysForTv(naruto, "all"), null);
  assert.equal(skipKeysForTv({ ...naruto, id: 1399 } as Tv, "golden"), null);
  /* الذهبيُّ لناروتو: الفلرُ والمختلطة */
  assert.equal(skipKeysForTv(naruto, "golden")?.size, 90 + 56);
});
