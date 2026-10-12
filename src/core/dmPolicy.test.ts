import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeDmPolicy, DM_MAX } from "./dmPolicy.ts";
import { MSG_TEXT_MAX } from "./contracts/messages.ts";

/* 🆕 D-1380 — «من يقدر يراسلني»: القيمُ الثلاث تمرّ، والغريبُ يسقط إلى الافتراضيّ؛ والطولُ رقمُ العقد نفسُه */
test("إعداد الخاص: القيمُ الثلاث تمرّ والغريبُ يسقط إلى «الكل»", () => {
  for (const v of ["everyone", "mutual", "none"]) assert.equal(sanitizeDmPolicy(v), v);
  assert.equal(sanitizeDmPolicy("open"), "everyone");
  assert.equal(sanitizeDmPolicy(null), "everyone");
  assert.equal(DM_MAX, MSG_TEXT_MAX);
});
