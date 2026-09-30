import { test } from "node:test";
import assert from "node:assert/strict";
import { orderCommunityFeed, boardRows } from "./communityFeed.ts";
import { commentViewKey } from "./postKeys.ts";
import {
  asCommunityTab,
  asBoardSection,
  parseCommunityPrefsBody,
  BOARD_SECTIONS,
} from "./communityParams.ts";

/**
 * ====== Phase 11-M · M0 — ترتيبُ خطّ «مجتمعي» الذي يقرؤه الويبُ والبابُ معاً ======
 * القواعدُ المختبَرة منقولةٌ من `ActivityFeed` حرفاً: D-283 (الصيغة) · D-306 (الأحدث) ·
 * D-629 (الأفضل للزائر) · D-900 (مفتاحُ الغرباء هو الحكم).
 */

const T0 = Date.parse("2026-09-01T00:00:00Z");
const iso = (ms: number) => new Date(T0 + ms).toISOString();
const c = (id: string, at: number, extra: Partial<{ likes: number; review: string | null; tmdb: number }> = {}) => ({
  person: { id },
  media_type: "tv" as const,
  tmdb_id: extra.tmdb ?? 1,
  review: extra.review === undefined ? "رأي" : extra.review,
  updated_at: iso(at),
  likes: extra.likes ?? 0,
});
const n = (key: string, at: number) => ({ key, media_type: "movie" as const, tmdb_id: 9, published_at: iso(at) });
const ids = (rows: { kind: string; item: { key?: string; person?: { id: string } } }[]) =>
  rows.map((r) => (r.kind === "news" ? `n:${r.item.key}` : `c:${r.item.person!.id}`));

test("الأحدث: زمنٌ خالص، والرأيُ بلا نصٍّ لا يدخل", () => {
  const out = orderCommunityFeed({
    comments: [c("a", 1000), c("b", 3000), c("silent", 5000, { review: "  " })],
    news: [n("x", 2000)],
    meId: "me",
    showStrangers: true,
    sort: "latest",
  });
  assert.deepEqual(ids(out), ["c:b", "n:x", "c:a"]);
});

/* 🆕 D-1207 — «الأكثر تفاعلاً» (`smart`): عدٌّ خالصٌ داخل نافذة ٣٠ يوماً، والأقدمُ تحته بالأحدث؛ ولا تفاعلَ ⇒ الأحدثُ و`quiet` */
const DAY = 24 * 60 * 60 * 1000;
const NOW = T0 + 40 * DAY;

test("الأكثر تفاعلاً: داخل الشهر بالعدّ، والتعادلُ بالأحدث", () => {
  const replies = new Map([[commentViewKey("b", "tv", 2), 2]]);
  const out = orderCommunityFeed({
    comments: [c("a", 39 * DAY, { likes: 1, tmdb: 1 }), c("b", 20 * DAY, { tmdb: 2 }), c("z", 38 * DAY, { tmdb: 3 })],
    news: [],
    meId: "me",
    showStrangers: true,
    sort: "smart",
    reviewReplies: replies,
    now: NOW,
  });
  assert.deepEqual(ids(out), ["c:b", "c:a", "c:z"]);
});

test("الأكثر تفاعلاً: ما هو أقدمُ من الشهر تحتَ النافذة بالأحدث مهما تفاعلوا معه", () => {
  const report = { quiet: true };
  const out = orderCommunityFeed({
    comments: [c("old", 1 * DAY, { likes: 50, tmdb: 1 }), c("fresh", 35 * DAY, { likes: 1, tmdb: 2 }), c("mid", 30 * DAY, { tmdb: 3 })],
    news: [n("x", 36 * DAY)],
    meId: "me",
    showStrangers: true,
    sort: "smart",
    newsLikes: { "movie-9": 0 },
    now: NOW,
    report,
  });
  assert.deepEqual(ids(out), ["c:fresh", "n:x", "c:mid", "c:old"]);
  assert.equal(report.quiet, false);
});

test("الأكثر تفاعلاً: شهرٌ بلا تفاعل ⇒ الأحدثُ نفسُه و`quiet`", () => {
  const report = { quiet: false };
  const rows = [c("a", 30 * DAY, { tmdb: 1 }), c("b", 39 * DAY, { tmdb: 2 }), c("old", 1 * DAY, { likes: 9, tmdb: 3 })];
  const smart = orderCommunityFeed({ comments: rows, news: [], meId: "me", showStrangers: true, sort: "smart", now: NOW, report });
  const latest = orderCommunityFeed({ comments: rows, news: [], meId: "me", showStrangers: true, sort: "latest" });
  assert.deepEqual(ids(smart), ids(latest));
  assert.equal(report.quiet, true);
});

test("الغرباءُ مطفأون ⇒ كلامي ومن أتابع والأخبار وحدَها (D-900)", () => {
  const out = orderCommunityFeed({
    comments: [c("me", 1), c("friend", 2), c("stranger", 3)],
    news: [n("x", 4)],
    meId: "me",
    followingIds: new Set(["friend"]),
    showStrangers: false,
    sort: "latest",
  });
  assert.deepEqual(ids(out), ["n:x", "c:friend", "c:me"]);
});

test("الزائرُ خارج الترشيح ولو أُطفئ المفتاح (D-629)", () => {
  const out = orderCommunityFeed({ comments: [c("stranger", 1)], news: [], meId: "", showStrangers: false, sort: "latest" });
  assert.deepEqual(ids(out), ["c:stranger"]);
});

test("الأفضل: عدٌّ خالص والأحدثُ يفصل التعادل (D-629)", () => {
  const out = orderCommunityFeed({
    comments: [c("a", 1, { likes: 1 }), c("b", 5, { likes: 1, tmdb: 2 }), c("z", 9)],
    news: [],
    meId: "",
    showStrangers: true,
    sort: "top",
  });
  assert.deepEqual(ids(out), ["c:b", "c:a", "c:z"]);
});

test("لوحةُ الناس: الصاعدون بالفرق ومن لم يصعد لا يظهر؛ الأكثرُ بالمجموع", () => {
  const rows = [
    { id: "a", total: 10, prevTotal: 9 },
    { id: "b", total: 5, prevTotal: 0 },
    { id: "c", total: 8, prevTotal: 8 },
    { id: "d", total: 1, prevTotal: 3 },
  ];
  assert.deepEqual(boardRows(rows, "rising", 10).map((r) => r.id), ["b", "a"]);
  assert.deepEqual(boardRows(rows, "top", 3).map((r) => r.id), ["a", "c", "b"]);
  assert.deepEqual(boardRows(rows, "featured", 1).map((r) => r.id), ["a"]);
});

test("المعاملات: القارئُ المتسامحُ للصفحة والباب", () => {
  assert.equal(asCommunityTab("comments"), "activity");
  assert.equal(asCommunityTab("works"), "talk");
  assert.equal(asCommunityTab(undefined), "talk");
  assert.equal(asCommunityTab("people"), "people");
  assert.equal(asBoardSection("watching"), null);
  for (const s of BOARD_SECTIONS) assert.equal(asBoardSection(s), s);
});

test("جسمُ تفضيلات الأدوات: الجزئيُّ يمرّ والمجهولُ يسقط", () => {
  assert.deepEqual(parseCommunityPrefsBody({ sort: "latest", strangers: false, x: 1 }), { sort: "latest", strangers: false });
  assert.equal(parseCommunityPrefsBody({ sort: "top" }), null);
  assert.equal(parseCommunityPrefsBody([]), null);
  assert.equal(parseCommunityPrefsBody(null), null);
  assert.deepEqual(parseCommunityPrefsBody({ talk_followed: true, translate: false }), { talk_followed: true, translate: false });
});
