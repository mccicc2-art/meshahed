import { test } from "node:test";
import assert from "node:assert/strict";
import { titleCardText, titleMetadata, type TitleCard } from "./titleMeta.ts";

const lost: TitleCard = {
  kind: "tv",
  name: "Lost",
  date: "2004-09-22",
  genres: ["دراما", "غموض", "خيال"],
  extent: 6,
  overview: "ناجون من تحطّم طائرة على جزيرة غامضة. ".repeat(10),
  posterPath: "/og.jpg",
  path: "/show/4607",
  locale: "ar",
};

test("الاسمُ والسنة، والسطرُ: النوعُ والتصنيفان والمواسمُ ثمّ الوصفُ مختصراً", () => {
  const { title, description } = titleCardText(lost);
  assert.equal(title, "Lost (2004) — على Loopz");
  assert.ok(description.startsWith("مسلسل · دراما وغموض · 6 مواسم — "));
  assert.ok(description.endsWith("…"));
  assert.ok(description.length < 220);
});

test("البوسترُ من ممرّنا بمقاس w500، وبطاقةُ X صغيرة", () => {
  const m = titleMetadata(lost);
  const og = m.openGraph as { images?: { url: string }[]; url?: string };
  assert.equal(og.images?.[0].url, "/i/w500/og.jpg");
  assert.equal(og.url, "/show/4607");
  assert.equal((m.twitter as { card?: string }).card, "summary");
});

test("مسارُ صورةٍ غريبٌ لا يُبنى منه رابط، وفيلمٌ بالإنجليزيّة بمدّته", () => {
  const m = titleMetadata({ ...lost, kind: "movie", name: "Heat", date: "1995-12-15", extent: 170, genres: ["Crime"], posterPath: "/../x.jpg", locale: "en", overview: "" });
  assert.equal((m.openGraph as { images?: unknown }).images, undefined);
  assert.equal(titleCardText({ ...lost, kind: "movie", name: "Heat", date: "1995-12-15", extent: 170, genres: ["Crime"], locale: "en", overview: "" }).description, "Movie · Crime · 170 min");
});
