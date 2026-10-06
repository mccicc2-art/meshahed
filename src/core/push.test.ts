import { test } from "node:test";
import assert from "node:assert/strict";
import { episodesPush, localDayHour, messagePush, parseMuted, PUSH_GROUP_OF, PUSH_TOKEN_RE, signalPush } from "./push.ts";
import { getDict } from "./i18n.ts";
import type { SignalRow } from "./signals.ts";

/** ====== D-1305 — إشعاراتُ الدفع: الجملةُ جملةُ الجرس، والوجهةُ وجهتُه ====== */

const ME = "5b7c2a9e-1111-4a2b-9c3d-000000000001";
const P = { id: "5b7c2a9e-2222-4a2b-9c3d-000000000002", nickname: "مشعل", username: "mishal", avatar_url: null, hide_name: false };
const row = (x: Partial<SignalRow>): SignalRow => ({ kind: "follow", person: P, tmdbId: null, mediaType: null, title: null, at: "2026-10-06T10:00:00Z", isNew: true, ...x });

test("دفعُ الجرس: الجملةُ كاملةً والوجهةُ من signalHref", () => {
  const t = getDict("ar");
  const f = signalPush(row({ kind: "follow" }), t, "", ME);
  assert.equal(f.body, t.notifFollow("مشعل"));
  assert.equal(f.url, "/u/mishal");
  const r = signalPush(row({ kind: "reply", tmdbId: 7, mediaType: "tv", title: "Dark" }), getDict("en"), "", ME);
  assert.equal(r.body, getDict("en").notifReply("مشعل", "Dark"));
  assert.equal(r.url, `/review/tv/7/${ME}`);
});

test("كلُّ نوعٍ في الجرس له مفتاحٌ في الإعدادات", () => {
  for (const k of ["follow", "request", "like_review", "like_activity", "reply", "talk_reply", "list_review", "like_list_review", "list_reply"] as const) assert.ok(PUSH_GROUP_OF[k]);
});

test("الرسالة: المرسلُ عنوان، والملاحظةُ تحت ما أُرسل، والوجهةُ خيطُه", () => {
  const t = getDict("ar");
  const m = messagePush({ senderId: P.id, senderName: "مشعل", text: "  لازم تشوفه  ", sharedTitle: "Dark" }, t);
  assert.equal(m.title, "مشعل");
  assert.equal(m.body, `${t.pushSharedTitle("Dark")}\nلازم تشوفه`);
  assert.equal(m.url, `/messages?with=${P.id}`);
  assert.equal(messagePush({ senderId: P.id, senderName: "مشعل", text: "هلا" }, t).body, "هلا");
  assert.equal(messagePush({ senderId: P.id, senderName: "", text: null }, t).body, t.pushNewMessage);
});

test("الحلقات: واحدةٌ تفتح صفحتَها، وأكثرُ يفتح الرئيسيّة", () => {
  const t = getDict("en");
  assert.equal(episodesPush([], t), null);
  assert.equal(episodesPush([{ tmdbId: 5, title: "Dark" }], t)?.url, "/show/5");
  const many = episodesPush([{ tmdbId: 5, title: "A" }, { tmdbId: 6, title: "B" }, { tmdbId: 7, title: "C" }], t);
  assert.equal(many?.url, "/");
  assert.equal(many?.body, t.pushNewEpisodes("A", "B", 1));
});

test("اليومُ والساعةُ بمنطقة القارئ، والمجهولةُ UTC", () => {
  const at = Date.UTC(2026, 9, 6, 22, 30);
  assert.deepEqual(localDayHour(at, "Asia/Riyadh"), { day: "2026-10-07", hour: 1 });
  assert.deepEqual(localDayHour(at, null), { day: "2026-10-06", hour: 22 });
  assert.deepEqual(localDayHour(at, "Not/AZone"), { day: "2026-10-06", hour: 22 });
});

test("الرمزُ والمكتوم: شكلٌ يُحرس، ومجهولٌ يسقط", () => {
  assert.ok(PUSH_TOKEN_RE.test("ExponentPushToken[abcDEF123456-_xyz]"));
  assert.ok(!PUSH_TOKEN_RE.test("ExponentPushToken[]"));
  assert.ok(!PUSH_TOKEN_RE.test("https://evil.example/x"));
  assert.deepEqual(parseMuted(["likes", "nope", 3, "episodes"]), ["likes", "episodes"]);
  assert.deepEqual(parseMuted("likes"), []);
});
