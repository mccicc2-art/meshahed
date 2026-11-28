import { test } from "node:test";
import assert from "node:assert/strict";
import { airedEpisodeCount, airedPerSeason, farthestEpisode, impliedEpisodes, isAbsoluteNumbering, lastAiredOf, missingAiredEpisodes } from "./progress.ts";

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

/** D-1254 — حلقةٌ حُسبت معروضةً ولا صفَّ لها في قائمة الموسم تُرقَّع بصفٍّ عامّ */
const row = (episode_number: number, air_date: string | null) => ({ episode_number, air_date });

test("قائمةٌ فارغةٌ والمعروضُ واحد: يُرقَّع بالحلقة ١ بتاريخها", () => {
  assert.deepEqual(missingAiredEpisodes(show({}), 2, [], "2026-10-03"), [{ episode_number: 1, air_date: "2026-10-03" }]);
});

test("القائمةُ تحمل الحلقة: لا ترقيع", () => {
  assert.deepEqual(missingAiredEpisodes(show({}), 2, [row(1, "2026-10-03")], "2026-10-03"), []);
});

test("قبل يوم العرض، والخاصّات، وموسمٌ مكتملُ القائمة: لا ترقيع", () => {
  assert.deepEqual(missingAiredEpisodes(show({}), 2, [], "2026-10-02"), []);
  assert.deepEqual(missingAiredEpisodes(show({}), 0, [], "2026-10-03"), []);
});

test("حلقاتُ المستقبل في القائمة لا تُحسب: الناقصُ آخرُ المعروض وحدَه", () => {
  const tv = show({ last_episode_to_air: ep(2, 4, "2026-10-24"), next_episode_to_air: ep(2, 5, "2026-10-31") });
  const listed = [row(1, "2026-10-03"), row(2, "2026-10-10"), row(3, "2026-10-17"), row(5, "2026-10-31")];
  assert.deepEqual(missingAiredEpisodes(tv, 2, listed, "2026-10-25"), [{ episode_number: 4, air_date: "2026-10-24" }]);
});

test("عجزٌ كبيرٌ (قائمةٌ منهارة) لا يُرقَّع بعشرات الصفوف العامّة", () => {
  assert.deepEqual(missingAiredEpisodes(show({}), 1, [], "2026-10-03"), []);
});

test("ترقيمٌ مختلفٌ بين القائمة والحاسب لا يولّد صفوفاً وهميّة", () => {
  const tv = show({
    number_of_episodes: 1181,
    seasons: [{ season_number: 1, episode_count: 1155 }, { season_number: 2, episode_count: 26 }],
    last_episode_to_air: ep(2, 1157, "2026-09-26"),
    next_episode_to_air: null,
  });
  /* الحاسبُ يتوقّع ١١٥٦–١١٥٧ والقائمةُ مرقّمةٌ ١–٢: فيها من المعروض ما يساوي العدّ ⇒ لا شيء يُضاف */
  assert.deepEqual(missingAiredEpisodes(tv, 2, [row(1, "2026-09-19"), row(2, "2026-09-26")], "2026-10-03"), []);
});

/**
 * 🆕 T612 — المنصّةُ: أبعدُ حلقةٍ شوهدت تعلّم ما قبلها بيومها (أحمد ٢٨ نوفمبر: «دام اني شفت الثانية والثالثة خل كل شيء قبلها اني شفته»).
 * الحالةُ حالةُ «خواتم القوة» على برايم: الثانيةُ والثالثةُ من الموسم الثالث ⇐ الموسمان الأوّلان والأولى من الثالث بيوم الثالثة.
 */
test("T612 — farthestEpisode picks the farthest season then episode, skips specials, keeps its day", () => {
  assert.equal(farthestEpisode([]), null);
  assert.equal(farthestEpisode([{ s: 0, e: 4, at: "2026-11-01T00:00:00.000Z" }]), null);
  assert.deepEqual(
    farthestEpisode([
      { s: 3, e: 2, at: "2026-11-27T20:00:00.000Z" },
      { s: 3, e: 3, at: "2026-11-28T07:00:00.000Z" },
      { s: 2, e: 8, at: "2026-11-29T07:00:00.000Z" },
      { s: 0, e: 9 },
    ]),
    { s: 3, e: 3, at: "2026-11-28T07:00:00.000Z" },
  );
  assert.deepEqual(farthestEpisode([{ s: 1, e: 5 }]), { s: 1, e: 5 });
});

test("T612 — the farthest platform episode implies every aired episode before it, dated at it", () => {
  const tv = show({
    number_of_episodes: 24,
    seasons: [
      { season_number: 1, episode_count: 8 },
      { season_number: 2, episode_count: 8 },
      { season_number: 3, episode_count: 8 },
    ],
    last_episode_to_air: ep(3, 8, "2026-11-11"),
    next_episode_to_air: null,
  });
  const at = "2026-11-28T07:00:00.000Z";
  const far = farthestEpisode([{ s: 3, e: 2, at: "2026-11-27T20:00:00.000Z" }, { s: 3, e: 3, at }]);
  const got = impliedEpisodes(tv, { upTo: far ? [far] : [] });
  assert.equal(got.length, 19);
  assert.ok(got.every((x) => x.at === at));
  assert.ok(got.some((x) => x.s === 1 && x.e === 1) && got.some((x) => x.s === 3 && x.e === 3) && !got.some((x) => x.s === 3 && x.e === 4));
});
