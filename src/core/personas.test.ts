import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PERSONAS, isPersonaId, personaLang, personaOf, personaText } from "./personas.ts";
import { isAiPersona } from "./plan.ts";

/* 🆕 D-1563 — شخصيات لوبز AI */
test("الشخصيات: خمسٌ بمعرّفاتٍ ورموزٍ لا تتكرّر", () => {
  assert.equal(PERSONAS.length, 5);
  assert.equal(new Set(PERSONAS.map((p) => p.id)).size, 5);
  assert.equal(new Set(PERSONAS.map((p) => p.slug)).size, 5);
});

test("الشخصيات: المعرّفاتُ هي نفسُها في الهجرة ٢٢٥", () => {
  const sql = fs.readFileSync(new URL("../../supabase/225_ai_personas.sql", import.meta.url), "utf8");
  for (const p of PERSONAS) {
    assert.ok(sql.includes(`('${p.id}', '${p.slug}')`), `${p.slug} في سجلّ personas`);
  }
});

test("الشخصيات: تُعرف من المعرّف وحدَه، والإنسانُ ليس شخصيّة", () => {
  assert.equal(personaOf(PERSONAS[0].id)?.slug, "adam");
  assert.equal(isPersonaId("00000000-0000-0000-0000-000000000000"), false);
  assert.equal(isPersonaId(null), false);
  assert.equal(isAiPersona({ id: PERSONAS[2].id }), true);
  assert.equal(isAiPersona({ id: "x", plan: "plus" }), false);
});

test("الشخصيات: العربيُّ لجهازٍ عربيّ، والإنجليزيُّ لكلِّ ما سواه، والنصُّ الآخرُ احتياط", () => {
  assert.equal(personaLang("ar"), "ar");
  assert.equal(personaLang("en"), "en");
  assert.equal(personaLang("fr"), "en");
  assert.equal(personaText("ar", "نص", "text"), "نص");
  assert.equal(personaText("en", "نص", "text"), "text");
  assert.equal(personaText("en", "نص", "  "), "نص");
});
