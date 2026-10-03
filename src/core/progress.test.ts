import { test } from "node:test";
import assert from "node:assert/strict";
import { airedEpisodeCount, airedPerSeason, isAbsoluteNumbering, lastAiredOf } from "./progress.ts";

/**
 * D-1253 — الحلقةُ تُحسب معروضةً متى حلّ تاريخُها، لا حين ينقلها TMDB من `next` إلى `last`.
 * الحالةُ حالةُ Black Clover يومَ ٣ أكتوبر ٢٠٢٦ (بلاغُ أحمد): موسمٌ أوّلُ مكتمل ١٧٠، وأولى حلقات الثاني اليوم.
 */
type Tv = Parameters<typeof airedEpisodeCount>[0];
const ep = (season_number: number, episode_number: number, air_date: string | null) =>
  ({ id: 1, name: "", overview: "", season_number, episode_number, air_date, still_path: null, runtime: null });
const show = (over: Record<string, unknown>) =>
  ({
    number_of_episodes: 196,
    seasons: [
      { season_number: 0, episode_count: 3 },
      { season_number: 1, episode_count: 170 },
      { season_number: 2, episode_count: 26 },
    ],
    last_episode_to_air: ep(1, 170, "2021-03-30"),
    next_episode_to_air: ep(2, 1, "2026-10-03"),
    ...over,
  }) as unknown as Tv;

test("قبل يومها: القادمةُ لا تُحسب — كما كان", () => {
  const tv = show({});
  assert.equal(airedEpisodeCount(tv, "2026-10-02"), 170);
  assert.deepEqual([...airedPerSeason(tv, "2026-10-02")], [[1, 170], [2, 0]]);
  assert.equal(lastAiredOf(tv, "2026-10-02")?.season_number, 1);
});

test("يومَ عرضها: تُحسب وإن أبقاها TMDB في next", () => {
  const tv = show({});
  assert.equal(airedEpisodeCount(tv, "2026-10-03"), 171);
  assert.deepEqual([...airedPerSeason(tv, "2026-10-03")], [[1, 170], [2, 1]]);
});

test("بعد أن ينقلها TMDB: النتيجةُ نفسُها (لا عدَّ مرّتين)", () => {
  const tv = show({ last_episode_to_air: ep(2, 1, "2026-10-03"), next_episode_to_air: ep(2, 2, "2026-10-10") });
  assert.equal(airedEpisodeCount(tv, "2026-10-04"), 171);
  assert.deepEqual([...airedPerSeason(tv, "2026-10-04")], [[1, 170], [2, 1]]);
});

test("قادمةٌ بلا تاريخ، أو خاصّةٌ (الموسم ٠): لا تُحسب", () => {
  assert.equal(airedEpisodeCount(show({ next_episode_to_air: ep(2, 1, null) }), "2026-10-03"), 170);
  assert.equal(airedEpisodeCount(show({ next_episode_to_air: ep(0, 4, "2026-10-03") }), "2026-10-03"), 170);
});

test("عملٌ لم يُعرض منه شيء وأولى حلقاته اليوم: تُحسب واحدة", () => {
  const tv = show({ number_of_episodes: 10, seasons: [{ season_number: 1, episode_count: 10 }], last_episode_to_air: null, next_episode_to_air: ep(1, 1, "2026-10-03") });
  assert.equal(airedEpisodeCount(tv, "2026-10-02"), 0);
  assert.equal(airedEpisodeCount(tv, "2026-10-03"), 1);
});

test("الترقيمُ المطلق (D-603) يقرأ القادمةَ التي حلّ يومُها أيضاً", () => {
  const tv = show({
    number_of_episodes: 1181,
    seasons: [{ season_number: 1, episode_count: 1155 }, { season_number: 2, episode_count: 26 }],
    last_episode_to_air: ep(2, 1160, "2026-09-26"),
    next_episode_to_air: ep(2, 1161, "2026-10-03"),
  });
  assert.equal(isAbsoluteNumbering(tv, "2026-10-03"), true);
  assert.equal(airedEpisodeCount(tv, "2026-10-02"), 1160);
  assert.equal(airedEpisodeCount(tv, "2026-10-03"), 1161);
  assert.deepEqual([...airedPerSeason(tv, "2026-10-03")], [[1, 1155], [2, 6]]);
});
