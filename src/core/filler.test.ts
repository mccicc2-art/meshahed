import { test } from "node:test";
import assert from "node:assert/strict";
import { activeMode, countKeys, fillerCount, fillerKeys, goldenKeys, mixedCount, mixedKeys, parseRanges, parseSkipMode, storyEpisodes } from "./filler.ts";

test("each list matches the filler count stated by its source", () => {
  /* animefillerlist.com، ١ نوفمبر ٢٠٢٦ — العددُ المعلَن لكلِّ عمل */
  const stated: Record<number, number> = {
    37854: 94, 46260: 90, 31910: 203, 30984: 163, 30983: 578, 46261: 61, 73223: 18, 70881: 28, 35610: 35, 12971: 38,
    /* D-1620 — الستّةُ الجديدة */
    12609: 21, 62715: 14, 46298: 2, 65930: 4, 57041: 23, 28136: 40,
    902: 91, 3570: 98, 34141: 25, 38464: 10, 37863: 3, 37305: 1, 50712: 27, 88046: 0, 61223: 0,
    /* D-1622 — الثلاثة عشر */
    45952: 5, 12536: 39, 45854: 5, 38603: 13, 38251: 18, 45857: 30, 27845: 79, 35790: 33, 57706: 71, 46345: 21, 60654: 0, 61374: 0, 30669: 0,
  };
  for (const [id, n] of Object.entries(stated)) assert.equal(fillerCount(Number(id)), n, `tmdb ${id}`);
});

test("D-1622 — thirty-eight shows in the list", () => {
  const ids = [37854, 46260, 31910, 30984, 30983, 46261, 73223, 70881, 35610, 12971, 12609, 62715, 46298, 65930, 57041, 28136, 902, 3570, 34141, 38464, 37863, 37305, 50712, 88046, 61223,
    45952, 12536, 45854, 38603, 38251, 45857, 27845, 35790, 57706, 46345, 60654, 61374, 30669];
  assert.equal(new Set(ids).size, 38);
  for (const id of ids) assert.ok(fillerCount(id) + mixedCount(id) > 0, `tmdb ${id}`);
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

test("D-1620 — mixed canon/filler lists: stated counts where the source gives one; Conan has none", () => {
  assert.equal(mixedCount(37854), 43);
  assert.equal(mixedCount(31910), 64);
  assert.equal(mixedCount(46260), 56);
  assert.equal(mixedCount(30983), 0);
  assert.equal(mixedKeys(30983, [{ season_number: 1, episode_count: 1219 }])?.size, 0);
  const k = mixedKeys(46260, [{ season_number: 1, episode_count: 220 }]);
  assert.ok(k?.has("1:7"));
  assert.ok(!k?.has("1:26")); // فلرٌ لا مختلط
});

test("D-1620 — skip mode: the old stored '1' still means filler", () => {
  assert.equal(parseSkipMode("1"), "filler");
  assert.equal(parseSkipMode("filler"), "filler");
  assert.equal(parseSkipMode("golden"), "golden");
  assert.equal(parseSkipMode("0"), "all");
  assert.equal(parseSkipMode(null), "all");
});

test("D-1621 — Conan's golden path keeps the main story only (346 episodes) and hides the rest, manga cases included", () => {
  assert.equal(storyEpisodes(30983)?.length, 346);
  const g = goldenKeys(30983, [{ season_number: 0, episode_count: 20 }, { season_number: 1, episode_count: 1219 }]);
  /* D-1622 — ومعها الفلرُ الذي يظهر فيه أحدُ القصّة (١٤ حلقة: كيد · أمورو …) — الذهبيُّ يخفي الفلرَ أصلاً */
  assert.equal(g?.size, 1219 - 346 + 14);
  assert.ok(g?.has("1:418")); // فلرٌ للمنظمة — مخفيّ
  for (const k of fillerKeys(30983, [{ season_number: 1, episode_count: 1219 }]) ?? []) assert.ok(g?.has(k), k);
  assert.ok(!g?.has("1:1")); // الحلقةُ الأولى: المنظمةُ وشينتشي
  assert.ok(!g?.has("1:345")); // أكاي والمنظمة
  assert.ok(g?.has("1:2")); // قضيّةٌ مستقلّة
  assert.ok(!g?.has("0:1")); // الخاصّاتُ لا تُمسّ
  /* عملٌ متسلسل: الذهبيُّ = الفلرُ والمختلطة */
  const n = goldenKeys(46260, [{ season_number: 1, episode_count: 220 }]);
  assert.equal(n?.size, 90 + 56);
});

test("D-1622 — no golden chip where golden equals filler; the saved mode falls back to what this show has", () => {
  /* الخيميائيّ ٢٠٠٣: فلرٌ بلا مختلطة — الذهبيُّ هو الفلرُ نفسُه */
  const fma = [{ season_number: 1, episode_count: 51 }];
  assert.ok(fillerKeys(37863, fma)?.size);
  assert.equal(goldenKeys(37863, fma), null);
  /* فاير فورس: مختلطةٌ بلا فلر — الذهبيُّ وحدَه */
  assert.equal(goldenKeys(88046, [{ season_number: 1, episode_count: 48 }])?.size, 1);
  const f = new Set(["1:4"]);
  const g = new Set(["1:4", "1:5"]);
  assert.equal(activeMode("golden", f, null), "filler");
  assert.equal(activeMode("golden", f, g), "golden");
  assert.equal(activeMode("golden", null, null), "all");
  assert.equal(activeMode("filler", null, g), "all");
  assert.equal(activeMode("filler", f, g), "filler");
  assert.equal(activeMode("all", f, g), "all");
});

test("D-1622 — episodes after the reviewed horizon stay visible in Conan's golden path until the lists are reviewed", () => {
  const g = goldenKeys(30983, [{ season_number: 1, episode_count: 1230 }]);
  assert.ok(g?.has("1:1219")); // مُراجَعةٌ وخارج القصّة
  assert.ok(!g?.has("1:1220"));
  assert.ok(!g?.has("1:1230"));
});

test("D-1622 — the new mixed counts, and the guard follows TMDB's layout", () => {
  const mixed: Record<number, number> = { 45952: 11, 12536: 32, 45854: 21, 38603: 2, 38251: 1, 45857: 8, 27845: 14, 35790: 0, 57706: 13, 46345: 4, 60654: 5, 61374: 12, 30669: 4 };
  for (const [id, n] of Object.entries(mixed)) assert.equal(mixedCount(Number(id)), n, `tmdb ${id}`);
  /* القنّاص ١٩٩٩ عند TMDB ٦٢ حلقة — يكفي الحارس */
  assert.equal(fillerKeys(45952, [{ season_number: 1, episode_count: 62 }])?.size, 5);
  /* ريبورن بترقيمٍ مطلق عبر ثمانية مواسم: ١٤٢ أوّلُ الموسم الخامس */
  const reborn = fillerKeys(45857, [33, 32, 8, 68, 13, 23, 12, 14].map((c, i, a) => ({ season_number: i + 1, episode_count: c, first_episode: 1 + a.slice(0, i).reduce((x, y) => x + y, 0) })));
  assert.ok(reborn?.has("5:142"));
  assert.equal(reborn?.size, 30);
  /* أمير التنس بترقيمٍ من ١ في كلِّ موسم: المطلقةُ ٢٧ (مختلطة) هي الأولى في الموسم الثاني */
  const tennis = mixedKeys(27845, [26, 27, 22, 26, 27, 37, 13].map((c, i) => ({ season_number: i + 1, episode_count: c })));
  assert.ok(tennis?.has("2:1"));
});
