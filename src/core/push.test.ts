import { test } from "node:test";
import assert from "node:assert/strict";
import { episodesPush, localDayHour, messagePush, parseMuted, PUSH_GROUP_OF, PUSH_TOKEN_RE, signalPush, dmDataOf, dmNativeOf, dmTargetOf, PUSH_CAPS, groupMessagePush } from "./push.ts";
import { parseWidgetDmBody } from "./contracts/widget.ts";
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
  /* D-1406 — أزرارُ «رد» و«تمييز كمقروءة» على إشعار الرسالة وحدَه */
  assert.equal(m.category, "dm");
  /* D-1408 — للجهاز الذي يرسمه بنفسه: النصُّ كلُّه في البيانات */
  assert.deepEqual(dmDataOf(m), { kind: "dm", title: "مشعل", body: m.body, url: `/messages?with=${P.id}` });
  assert.equal(dmDataOf({ title: "Loopz", body: "x", url: "/" }), null);
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

/** ====== 1.12.7 — إشعارُ الرسالة يرسمه الكودُ الأصليّ (dm-native) ====== */

const G = "5b7c2a9e-3333-4a2b-9c3d-000000000003";

test("dm-native: الوجهةُ من رابط الإشعار نفسِه — شخصٌ أو قروب، وما سواهما لا شيء", () => {
  assert.deepEqual(dmTargetOf(`/messages?with=${P.id}`), { to: P.id });
  assert.deepEqual(dmTargetOf(`/messages?group=${G.toUpperCase()}`), { group: G });
  assert.equal(dmTargetOf("/messages?with=mishal"), null);
  assert.equal(dmTargetOf(`/messages?with=${P.id}&x=1`), null);
  assert.equal(dmTargetOf(null), null);
  assert.ok(PUSH_CAPS.includes("dm-native"));
});

test("dm-native: البياناتُ تحمل الوجهةَ ونصوصَ الزرّين بلغة الجهاز، والوسمُ خيطٌ واحد", () => {
  const t = getDict("ar");
  const m = messagePush({ senderId: P.id, senderName: "مشعل", text: "هلا" }, t);
  const d = dmNativeOf(m, t);
  assert.ok(d);
  assert.equal(d.kind, "dm");
  assert.equal(d.to, P.id);
  assert.equal(d.group, undefined);
  assert.equal(d.tag, P.id);
  assert.equal(d.l.read, t.pushMarkRead);
  assert.equal(d.l.you, t.convYou);
  const g = dmNativeOf(groupMessagePush({ groupId: G, groupName: "الشلة", senderName: "مشعل", text: "هلا" }, t), getDict("en"));
  assert.equal(g?.group, G);
  assert.equal(g?.tag, `g:${G}`);
  assert.equal(g?.l.reply, getDict("en").msgReply);
  /* ما ليس رسالةً لا يُرسل بيانات */
  assert.equal(dmNativeOf({ title: "Loopz", body: "x", url: "/" }, t), null);
});

test("dm-reply/dm-read: وجهةٌ واحدةٌ صالحة، والردُّ نصٌّ غيرُ فارغٍ في الحدّ", () => {
  assert.deepEqual(parseWidgetDmBody({ to: P.id, body: "  تم  " }, true), { target: { to: P.id }, body: "تم" });
  assert.deepEqual(parseWidgetDmBody({ group: G }, false), { target: { group: G }, body: "" });
  assert.equal(parseWidgetDmBody({ to: P.id, group: G, body: "x" }, true), null);
  assert.equal(parseWidgetDmBody({ to: P.id, body: "   " }, true), null);
  assert.equal(parseWidgetDmBody({ to: P.id, body: "x".repeat(1001) }, true), null);
  assert.equal(parseWidgetDmBody({ to: "nope" }, false), null);
  assert.equal(parseWidgetDmBody({ to: P.id, group: "nope" }, false), null);
  assert.equal(parseWidgetDmBody(null, false), null);
});

test("D-1435/D-1436 — دفعُ القروب: العملُ المرسَل يُسمّى، والمذكورُ يقرأ «ذكرك»", () => {
  const t = getDict("ar");
  const G = "5b7c2a9e-1111-4a2b-9c3d-000000000009";
  assert.equal(groupMessagePush({ groupId: G, groupName: "الشلة", senderName: "مشعل", text: "", sharedTitle: "Dark" }, t).body, "مشعل: 🎬 Dark");
  assert.equal(groupMessagePush({ groupId: G, groupName: "الشلة", senderName: "مشعل", text: "شوفوه", sharedTitle: "Dark" }, t).body, "مشعل: 🎬 Dark شوفوه");
  assert.equal(groupMessagePush({ groupId: G, groupName: "الشلة", senderName: "مشعل", text: "@khld تعال", mention: true }, t).body, `${t.pushGroupMention("مشعل")}: @khld تعال`);
});
