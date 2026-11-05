import { test } from "node:test";
import assert from "node:assert/strict";
import { acceptOnUnbound, canIssue, isAlive, partition, slotLimit, slotsOf, usedSlots, type LinkRow } from "./deviceLinks.ts";

const NOW = Date.parse("2026-11-05T20:00:00Z");
const ago = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const row = (p: Partial<LinkRow> & Pick<LinkRow, "table" | "token_hash">): LinkRow => ({
  server: null,
  kinds: [],
  created_at: ago(48),
  last_used_at: null,
  stopped_at: null,
  ...p,
});

const stremio = row({ table: "stremio_links", token_hash: "s", last_used_at: ago(1) });
const plex = row({ table: "home_server_links", token_hash: "p", server: "plex", last_used_at: ago(5) });
const kodi = row({ table: "kodi_links", token_hash: "k", last_used_at: ago(10) });

test("الخانات: مجانيٌّ ١ · بلس ٥ · ذهبيٌّ بلا حدّ", () => {
  assert.equal(slotLimit("free"), 1);
  assert.equal(slotLimit("plus"), 5);
  assert.equal(slotLimit("gold"), Infinity);
});

test("الرابطُ القديمُ بلا نوع: خانةٌ قبل أوّل إرسال، وخانةٌ لكلِّ نوعٍ رآه", () => {
  assert.equal(slotsOf(row({ table: "home_server_links", token_hash: "l" })), 1);
  assert.equal(slotsOf(row({ table: "home_server_links", token_hash: "l", kinds: ["plex", "emby"] })), 2);
  assert.equal(slotsOf(plex), 1);
});

test("رابطٌ نام ٩٠ يوماً ميّت ولا يُعدّ", () => {
  const dead = row({ table: "stremio_links", token_hash: "d", created_at: ago(24 * 91) });
  assert.equal(isAlive(dead, NOW), false);
  assert.equal(usedSlots([dead, plex], NOW), 1);
});

test("النزولُ إلى المجانيّ: يبقى الأحدثُ استعمالاً ويُوقف الباقي", () => {
  const { keep, stop } = partition([kodi, plex, stremio], 1, NOW);
  assert.deepEqual(keep.map((r) => r.token_hash), ["s"]);
  assert.deepEqual(stop.map((r) => r.token_hash).sort(), ["k", "p"]);
});

test("«اختر ما يبقى» ثابت: الشغّالُ قبل الموقوف وإن كان أقدم", () => {
  const rows = [{ ...stremio, stopped_at: ago(0) }, plex, { ...kodi, stopped_at: ago(0) }];
  const { keep } = partition(rows, 1, NOW);
  assert.deepEqual(keep.map((r) => r.token_hash), ["p"]);
});

test("الاشتراكُ من جديد يعيد الموقوف", () => {
  const rows = [{ ...stremio, stopped_at: ago(0) }, plex, { ...kodi, stopped_at: ago(0) }];
  const { keep, stop } = partition(rows, 5, NOW);
  assert.equal(keep.length, 3);
  assert.equal(stop.length, 0);
});

test("صفٌّ قديمٌ بنوعين لا يُقسم: يُوقف كلُّه إن بقيت خانةٌ واحدة", () => {
  const legacy = row({ table: "home_server_links", token_hash: "l", kinds: ["plex", "emby"], last_used_at: ago(2) });
  const { keep, stop } = partition([stremio, legacy], 2, NOW);
  assert.deepEqual(keep.map((r) => r.token_hash), ["s"]);
  assert.deepEqual(stop.map((r) => r.token_hash), ["l"]);
});

test("الإصدار: المجانيُّ يربط جهازاً، والثاني ممنوع، واستبدالُ المربوط مسموح", () => {
  assert.equal(canIssue([], "stremio", 1, NOW), true);
  assert.equal(canIssue([stremio], "plex", 1, NOW), false);
  assert.equal(canIssue([stremio], "stremio", 1, NOW), true);
  assert.equal(canIssue([stremio, plex], "kodi", 5, NOW), true);
});

test("الإصدار: رابطُ نوعٍ يحلّ محلَّ القديم بلا نوع (قبل أوّل إرسال، أو لم يرَ إلّا هذا النوع)", () => {
  const unbound = row({ table: "home_server_links", token_hash: "l" });
  assert.equal(canIssue([unbound], "jellyfin", 1, NOW), true);
  const sawPlex = row({ table: "home_server_links", token_hash: "l", kinds: ["plex"] });
  assert.equal(canIssue([sawPlex], "plex", 1, NOW), true);
  assert.equal(canIssue([sawPlex], "emby", 1, NOW), false);
});

test("الموقوفُ لا يُعدّ في الخانات المستعملة", () => {
  assert.equal(usedSlots([{ ...plex, stopped_at: ago(0) }, stremio], NOW), 1);
  assert.equal(canIssue([{ ...plex, stopped_at: ago(0) }], "kodi", 1, NOW), true);
});

test("حدثٌ على الرابط القديم: يُربط بأوّل نوع، والثاني يحتاج خانة، ونوعٌ له رابطُه يُردّ", () => {
  const unbound = row({ table: "home_server_links", token_hash: "l" });
  assert.deepEqual(acceptOnUnbound([unbound], unbound, "plex", 1, NOW), { ok: true, bind: true });
  const sawPlex = { ...unbound, kinds: ["plex" as const] };
  assert.deepEqual(acceptOnUnbound([sawPlex], sawPlex, "plex", 1, NOW), { ok: true, bind: false });
  assert.deepEqual(acceptOnUnbound([sawPlex], sawPlex, "emby", 1, NOW), { ok: false, bind: false });
  assert.deepEqual(acceptOnUnbound([sawPlex], sawPlex, "emby", 5, NOW), { ok: true, bind: true });
  const dedicated = row({ table: "home_server_links", token_hash: "e", server: "emby" });
  assert.deepEqual(acceptOnUnbound([sawPlex, dedicated], sawPlex, "emby", 5, NOW), { ok: false, bind: false });
  assert.deepEqual(acceptOnUnbound([{ ...sawPlex, stopped_at: ago(0) }], { ...sawPlex, stopped_at: ago(0) }, "plex", 5, NOW), { ok: false, bind: false });
});
