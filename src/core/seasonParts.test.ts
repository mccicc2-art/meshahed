import { test } from "node:test";
import assert from "node:assert/strict";
import { fixedParts, partAired, partSeason, partsFromGroups, partWatched, readableName, type GroupSet } from "./seasonParts.ts";

test("only a show whose whole run is one regular season over 100 episodes is split", () => {
  /* كونان: موسمٌ واحد + الخاصّات */
  assert.equal(partSeason([{ season_number: 0, episode_count: 40 }, { season_number: 1, episode_count: 1218 }]), 1);
  /* ون بيس مقسّمٌ آركاتٍ مواسمَ — يبقى كما هو ولو طال آركٌ منه */
  assert.equal(partSeason([{ season_number: 1, episode_count: 61 }, { season_number: 2, episode_count: 196 }]), null);
  assert.equal(partSeason([{ season_number: 1, episode_count: 100 }]), null);
});

test("fixed parts of 100, the last one holds what remains", () => {
  const p = fixedParts(1, 1250);
  assert.equal(p.length, 13);
  assert.deepEqual(p[0], { first: 1, last: 100, name: null });
  assert.deepEqual(p[12], { first: 1201, last: 1250, name: null });
});

test("D-1623 — a short tail joins the part before it", () => {
  assert.deepEqual(fixedParts(1, 101), [{ first: 1, last: 101, name: null }]);
  const p = fixedParts(1, 1218);
  assert.equal(p.length, 12);
  assert.deepEqual(p[11], { first: 1101, last: 1218, name: null });
  assert.equal(fixedParts(1, 1225).length, 13);
});

const ep = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => ({ season_number: 1, episode_number: a + i }));

test("story arcs become parts; a gap joins the next arc; the tail after the last arc is fixed parts", () => {
  const arcs: GroupSet = {
    type: 5,
    groups: [
      { name: "Arc B", order: 2, episodes: ep(102, 300) },
      { name: "Arc A", order: 1, episodes: ep(1, 100) },
      { name: "Arc C", order: 3, episodes: ep(301, 900) },
    ],
  };
  const p = partsFromGroups([arcs], 1, 1, 1000);
  assert.deepEqual(p, [
    { first: 1, last: 100, name: "Arc A" },
    { first: 101, last: 300, name: "Arc B" },
    { first: 301, last: 900, name: "Arc C" },
    { first: 901, last: 1000, name: null },
  ]);
});

test("arcs win over TV seasons; an unusable set falls through", () => {
  const tv: GroupSet = { type: 7, groups: [{ name: "S1", order: 1, episodes: ep(1, 500) }, { name: "S2", order: 2, episodes: ep(501, 1000) }] };
  const overlap: GroupSet = { type: 5, groups: [{ name: "A", order: 1, episodes: ep(1, 600) }, { name: "B", order: 2, episodes: ep(500, 1000) }] };
  assert.equal(partsFromGroups([tv, overlap], 1, 1, 1000)?.[0].name, "S1");
  /* قضيّةٌ قضيّة: ٥٠٠ مجموعة — أطولُ من أن تكون تقسيماً */
  const cases: GroupSet = { type: 5, groups: Array.from({ length: 500 }, (_, i) => ({ name: `C${i}`, order: i, episodes: ep(i * 2 + 1, i * 2 + 2) })) };
  assert.equal(partsFromGroups([cases], 1, 1, 1000), null);
  /* مجموعةٌ توقّفت عند الثلث */
  const stale: GroupSet = { type: 5, groups: [{ name: "A", order: 1, episodes: ep(1, 150) }, { name: "B", order: 2, episodes: ep(151, 300) }] };
  assert.equal(partsFromGroups([stale], 1, 1, 1000), null);
  /* DVD ليس تقسيماً يُعرض */
  assert.equal(partsFromGroups([{ ...tv, type: 3 }], 1, 1, 1000), null);
});

test("aired and watched are counted inside the part only", () => {
  const part = { first: 101, last: 200, name: null };
  assert.equal(partAired(part, 1, 150), 50);
  assert.equal(partAired(part, 1, 90), 0);
  assert.equal(partAired(part, 1, 1218), 100);
  assert.equal(partWatched(part, 1, ["1:100", "1:101", "1:200", "1:201", "0:150", "2:150"]), 2);
});

test("D-1620 — names in Thai or Japanese drop to «Part n»; Arabic and Latin stay", () => {
  assert.equal(readableName("ปี 1"), null);
  assert.equal(readableName("黒の組織"), null);
  assert.equal(readableName("Black Organization Arc"), "Black Organization Arc");
  assert.equal(readableName("آرك المنظمة"), "آرك المنظمة");
  assert.equal(readableName("  "), null);
  const thai: GroupSet = { type: 7, groups: [{ name: "ปี 1", order: 1, episodes: ep(1, 500) }, { name: "ปี 2", order: 2, episodes: ep(501, 1000) }] };
  assert.deepEqual(partsFromGroups([thai], 1, 1, 1000)?.map((p) => p.name), [null, null]);
});
