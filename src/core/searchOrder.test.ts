import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeName, sectionOrder } from "./searchOrder.ts";

const member = (nickname: string | null, username: string | null, hide_name = false) => ({ id: "u", nickname, username, avatar_url: null, hide_name });
const base = {
  titles: [{ id: 1, mediaType: "movie" as const, title: "Räkan från Maxim", year: "1980", poster: null }],
  artists: [{ id: 2, name: "Rakan Mayasi", role: "Director", photo: null }],
  members: [member("Rakan", "rakan_x")],
  lists: [],
};

test("بحثُ rakan: العضو Rakan تطابقٌ تامّ فيصعد قسمُ الأعضاء أوّلاً، والباقي بترتيبه", () => {
  assert.deepEqual(sectionOrder(base, "rakan"), ["members", "titles", "artists", "lists"]);
});

test("بلا تطابقٍ تامّ: الترتيبُ المعتادُ لا يتغيّر", () => {
  assert.deepEqual(sectionOrder(base, "rak"), ["titles", "artists", "members", "lists"]);
});

test("أكثرُ من قسمٍ متطابق: يبقيان بترتيبهما المعتاد بينهما", () => {
  const d = { ...base, artists: [{ id: 3, name: "RAKAN", role: "Actor", photo: null }] };
  assert.deepEqual(sectionOrder(d, " Rakan "), ["artists", "members", "titles", "lists"]);
});

test("العلاماتُ والتشكيلُ لا تمنع التطابق، والعضوُ المخفيُّ اسمُه لا يُقارَن", () => {
  assert.equal(normalizeName("Räkan"), "rakan");
  assert.equal(normalizeName("مُحَمَّد"), "محمد");
  assert.deepEqual(sectionOrder(base, "räkan från maxim")[0], "titles");
  const hidden = { ...base, members: [member("Rakan", "rakan", true)] };
  assert.deepEqual(sectionOrder(hidden, "rakan"), ["titles", "artists", "members", "lists"]);
});
