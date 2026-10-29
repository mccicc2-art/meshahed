import { test } from "node:test";
import assert from "node:assert/strict";
import { compareReviews, type RankedReview } from "./reviewOrder.ts";

/* 🆕 D-1567 — ترتيبُ مراجعات العمل */
const r = (id: string, o: Partial<RankedReview>) => ({ id, mine: false, ai: false, likes: 0, at: "2026-10-01T00:00:00Z", ...o });

test("ترتيب المراجعات: مراجعتي أوّلاً ثمّ الأعضاء بالإعجاب ثمّ الشخصيّات تحتهم", () => {
  const list = [
    r("ai-hot", { ai: true, likes: 50 }),
    r("member-1", { likes: 1 }),
    r("mine", { mine: true, likes: 0 }),
    r("member-9", { likes: 9 }),
    r("ai-cold", { ai: true, likes: 0 }),
  ];
  assert.deepEqual([...list].sort(compareReviews).map((x) => x.id), ["mine", "member-9", "member-1", "ai-hot", "ai-cold"]);
});

test("ترتيب المراجعات: التساوي في الإعجاب للأحدث", () => {
  const list = [r("old", { likes: 3, at: "2026-08-01T00:00:00Z" }), r("new", { likes: 3, at: "2026-10-20T00:00:00Z" })];
  assert.deepEqual([...list].sort(compareReviews).map((x) => x.id), ["new", "old"]);
});
