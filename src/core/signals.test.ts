import { test } from "node:test";
import assert from "node:assert/strict";
import { signalHref, signalParts, type SignalRow } from "./signals.ts";
import { getDict } from "./i18n.ts";

/**
 * ====== Phase 11-M · M4 — الإشعارات: الجملةُ والوجهةُ في الطرفين ======
 * الويبُ (`NotificationList`) والتطبيقُ يبنيان منهما — فالوجهةُ هنا عقدٌ: D-218 (الشيءُ لا صاحبُه) و D-899 (المعرّفُ لا الاسم).
 */

const ME = "5b7c2a9e-1111-4a2b-9c3d-000000000001";
const P = { id: "5b7c2a9e-2222-4a2b-9c3d-000000000002", nickname: "مشعل", username: "mishal", avatar_url: null, hide_name: false };
const row = (x: Partial<SignalRow>): SignalRow => ({ kind: "follow", person: P, tmdbId: null, mediaType: null, title: null, at: "2026-09-28T10:00:00Z", isNew: false, ...x });

test("الوجهة: القائمةُ أوّلاً ثمّ الغرفةُ ثمّ رأيي بمعرّفي ثمّ الملفّ", () => {
  assert.equal(signalHref(row({ kind: "list_review", listId: "L1", tmdbId: 5 }), ME), "/lists/L1");
  assert.equal(signalHref(row({ kind: "talk_reply", tmdbId: 7, mediaType: "tv" }), ME), "/talk/tv/7");
  assert.equal(signalHref(row({ kind: "reply", tmdbId: 7, mediaType: "movie" }), ME), `/review/movie/7/${ME}`);
  assert.equal(signalHref(row({ kind: "reply", tmdbId: 7, mediaType: "tv" }), null), "/show/7");
  assert.equal(signalHref(row({ kind: "follow" }), ME), "/u/mishal");
  assert.equal(signalHref(row({ kind: "like_review", tmdbId: 9, mediaType: "tv" }), ME), "/u/mishal");
  assert.equal(signalHref(row({ kind: "like_review", person: { ...P, username: null, id: "" }, tmdbId: 9, mediaType: "tv" }), ME), "/show/9");
});

test("الجملةُ تُشقُّ عند الاسم، والمخفيُّ «مستخدم»", () => {
  const t = getDict("ar");
  const p = signalParts(row({ kind: "follow" }), t, "");
  assert.equal(p.who, "مشعل");
  assert.equal(`${p.pre}${p.who}${p.post}`, t.notifFollow("مشعل"));
  const hidden = signalParts(row({ kind: "follow", person: { ...P, hide_name: true } }), t, "");
  assert.equal(hidden.who, t.anonymousUser);
  const list = signalParts(row({ kind: "list_reply", title: "مخزَّن" }), getDict("en"), "Top 10");
  assert.equal(`${list.pre}${list.who}${list.post}`, getDict("en").notifListReply("مشعل", "Top 10"));
});
