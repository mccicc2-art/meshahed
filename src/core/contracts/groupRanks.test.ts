import { test } from "node:test";
import assert from "node:assert/strict";
import { canRemove, rolesFor, rankOf } from "./groups.ts";

/* مرآةُ `dm_group_remove` و`dm_group_set_role` (الهجرة ٢١٢، D-1453) — التطبيقُ يُخفي ما ستردّه القاعدة */
test("المؤسسُ يُخرج الجميع ولا يُخرَج", () => {
  for (const r of ["co_owner", "admin", "member"] as const) assert.equal(canRemove("owner", r), true);
  for (const r of ["owner", "co_owner", "admin", "member"] as const) assert.equal(canRemove(r, "owner"), false);
});

test("الشريكُ يُخرج المشرفَ والعضو لا شريكاً آخر", () => {
  assert.equal(canRemove("co_owner", "admin"), true);
  assert.equal(canRemove("co_owner", "member"), true);
  assert.equal(canRemove("co_owner", "co_owner"), false);
});

test("المشرفُ يُخرج الأعضاءَ وحدهم والعضوُ لا يُخرج أحداً", () => {
  assert.equal(canRemove("admin", "member"), true);
  assert.equal(canRemove("admin", "admin"), false);
  assert.equal(canRemove("member", "member"), false);
});

test("الأدوار: المؤسسُ يعيّن الشريك، والشريكُ المشرفَ وحده", () => {
  assert.deepEqual(rolesFor("owner", "member"), ["co_owner", "admin"]);
  assert.deepEqual(rolesFor("owner", "co_owner"), ["admin", "member"]);
  assert.deepEqual(rolesFor("co_owner", "member"), ["admin"]);
  assert.deepEqual(rolesFor("co_owner", "admin"), ["member"]);
  assert.deepEqual(rolesFor("co_owner", "co_owner"), []);
  assert.deepEqual(rolesFor("admin", "member"), []);
  assert.deepEqual(rolesFor("owner", "owner"), []);
});

test("الدورُ الخام المجهول عضو", () => {
  assert.equal(rankOf("owner"), "owner");
  assert.equal(rankOf(undefined), "member");
  assert.equal(rankOf("x"), "member");
});
