import { test } from "node:test";
import assert from "node:assert/strict";
import { normTitle, pickByTitle, titleMatches } from "./nameMatch.ts";

test("normTitle folds case, punctuation, accents and &", () => {
  assert.equal(normTitle("  Amélie: The Movie!! "), "amelie the movie");
  assert.equal(normTitle("Fast & Furious"), "fast and furious");
  assert.equal(normTitle(null), "");
});

test("T536: an exact title beats a more popular partial match (Harmony 2010)", () => {
  const rows = [
    { title: "Harmony and Me", original_title: "Harmony and Me", poster_path: "/a.jpg" },
    { title: "Harmony", original_title: "하모니", poster_path: "/b.jpg" },
  ];
  assert.equal(pickByTitle(rows, "Harmony")?.poster_path, "/b.jpg");
});

test("the original title counts as a match too", () => {
  const rows = [
    { title: "Other", poster_path: "/a.jpg" },
    { title: "Spirited Away", original_title: "千と千尋の神隠し", poster_path: "/b.jpg" },
  ];
  assert.equal(pickByTitle(rows, "千と千尋の神隠し")?.poster_path, "/b.jpg");
  assert.equal(titleMatches(rows[1], "spirited away"), true);
});

test("no exact match keeps the old rule: first with a poster, then the first", () => {
  assert.equal(pickByTitle([{ title: "A" }, { title: "B", poster_path: "/b.jpg" }], "Zzz")?.title, "B");
  assert.equal(pickByTitle([{ title: "A" }, { title: "B" }], "Zzz")?.title, "A");
  assert.equal(pickByTitle([], "Zzz"), null);
});

test("among exact matches the one with a poster wins", () => {
  const rows = [{ title: "Harmony" }, { title: "Harmony", poster_path: "/p.jpg" }];
  assert.equal(pickByTitle(rows, "Harmony")?.poster_path, "/p.jpg");
});
