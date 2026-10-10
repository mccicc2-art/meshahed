import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanUsername, isReservedUsername, usernameIssue, RESERVED_NAMES, RESERVED_PREFIX } from "./username.ts";

test("كلُّ ما يبدأ باسم المنتج محجوز — بأيِّ حالةِ أحرفٍ كُتب", () => {
  for (const raw of ["LoopzTV", "loopz", "Loopz_Official", "loopzsupport", "LOOPZ1"]) {
    assert.equal(isReservedUsername(cleanUsername(raw)), true, raw);
    assert.equal(usernameIssue(cleanUsername(raw)), "reserved", raw);
  }
});

test("اسمٌ يحوي اسمَ المنتج ولا يبدأ به ليس محجوزاً", () => {
  for (const raw of ["myloopz", "ahmed_92", "the_loopz_fan"]) assert.equal(isReservedUsername(cleanUsername(raw)), false, raw);
});

test("القائمةُ والمولَّدُ القديم كما كانا", () => {
  assert.equal(isReservedUsername("admin"), true);
  assert.equal(isReservedUsername("user_0a1b2c3d"), true);
  assert.equal(usernameIssue("ab"), "short");
});

/* القائمةُ مكتوبةٌ مرّتين (هنا وفي القاعدة — الهجرة ١٩٨): اسمٌ يُضاف في أحدهما وحدَه يفتح باباً خلفيّاً أو يقفل
   اسماً بلا رسالة. الاختبارُ يقرأ نصَّ الهجرة ويقارن. */
test("قائمةُ القاعدة (الهجرة ١٩٨) هي قائمةُ الشيفرة حرفاً", () => {
  const sql = readFileSync(new URL("../../supabase/198_reserved_usernames_in_db.sql", import.meta.url), "utf8");
  const block = sql.slice(sql.indexOf("-- reserved:begin"), sql.indexOf("-- reserved:end"));
  const inDb = [...block.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(inDb, [...RESERVED_NAMES].sort());
  assert.ok(sql.includes(`like '${RESERVED_PREFIX}%'`));
});
