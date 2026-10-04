import { test } from "node:test";
import assert from "node:assert/strict";
import { normTitle, pickGrounded, type GroundRow } from "./aiGround.ts";

const row = (id: number, names: string[], year: number, yearRank = -1, poster = true): GroundRow => ({ id, names, year, poster, yearRank });

test("normTitle strips punctuation, accents and a leading article", () => {
  assert.equal(normTitle("The Fullmetal Alchemist: Brotherhood!"), "fullmetal alchemist brotherhood");
  assert.equal(normTitle("Amélie"), "amelie");
  assert.equal(normTitle("進撃の巨人"), "進撃の巨人");
});

test("a short common name does not grab a longer unrelated title (A Day → not Die Hard)", () => {
  const rows = [row(1, ["A Good Day to Die Hard"], 2013), row(2, ["A Day", "하루"], 2017, 0)];
  assert.equal(pickGrounded({ title: "A Day", year: 2017 }, rows), 2);
  assert.equal(pickGrounded({ title: "A Day", year: 2017 }, [rows[0]]), null);
});

test("an equal name wins over the first result (Reset → not Bushido - RESET)", () => {
  const rows = [row(1, ["Bushido - RESET"], 2022, 0), row(2, ["Reset", "开端"], 2022, 1)];
  assert.equal(pickGrounded({ title: "Reset", year: 2022 }, rows), 2);
});

test("the original-language name is enough", () => {
  const rows = [row(7, ["Attack on Titan", "進撃の巨人"], 2013, 0)];
  assert.equal(pickGrounded({ title: "Shingeki", original: "進撃の巨人", year: 2013 }, rows), 7);
});

test("equal names: nearest year wins; far year only when unique", () => {
  const rows = [row(1, ["One Piece"], 2023), row(2, ["One Piece"], 1999)];
  assert.equal(pickGrounded({ title: "One Piece", year: 1999 }, rows), 2);
  assert.equal(pickGrounded({ title: "One Piece", year: 1980 }, rows), null);
  assert.equal(pickGrounded({ title: "One Piece", year: 1980 }, [rows[1]]), 2);
  assert.equal(pickGrounded({ title: "One Piece" }, rows), 1);
});

test("subtitle match needs the year within one", () => {
  const rows = [row(1, ["Dune: Part One"], 2021, 0), row(2, ["Dune: Part Two"], 2024)];
  assert.equal(pickGrounded({ title: "Dune", year: 2021 }, rows), 1);
  assert.equal(pickGrounded({ title: "Dune", year: 2010 }, rows), null);
  assert.equal(pickGrounded({ title: "Dune" }, rows), null);
});

test("no name match: only the first year-filtered row, and only for a multi-word name", () => {
  const rows = [row(5, ["Attack on Titan", "進撃の巨人"], 2013, 0), row(6, ["Other"], 2013, 1)];
  assert.equal(pickGrounded({ title: "Shingeki no Kyojin", year: 2013 }, rows), 5);
  assert.equal(pickGrounded({ title: "Shingeki", year: 2013 }, rows), null);
  assert.equal(pickGrounded({ title: "Shingeki no Kyojin" }, rows), null);
});
