import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeChatBg, effectiveChatBg, chatBgNeedsPlus, sameChatBg, DEFAULT_CHAT_BG } from "./chatBg.ts";

/* 🆕 D-1382 — خلفيّةُ المحادثات: الافتراضيُّ Loopz، والغريبُ يسقط إليه، وخلفيّةُ العمل للمشترك وحدَه عند العرض */
test("خلفية المحادثات: الافتراضي Loopz والفاسد يسقط إليه", () => {
  assert.deepEqual(sanitizeChatBg(null), DEFAULT_CHAT_BG);
  assert.deepEqual(sanitizeChatBg({ k: "x" }), DEFAULT_CHAT_BG);
  assert.deepEqual(sanitizeChatBg({ k: "plain" }), { k: "plain" });
  const ok = { k: "title", type: "tv", id: 1398, path: "/aBc_12-x.jpg" };
  assert.deepEqual(sanitizeChatBg(ok), ok);
  /* المسارُ يدخل رابطاً — لا نطاقَ ولا صعودَ ولا امتدادَ غريب */
  assert.deepEqual(sanitizeChatBg({ ...ok, path: "https://evil.example/a.jpg" }), DEFAULT_CHAT_BG);
  assert.deepEqual(sanitizeChatBg({ ...ok, path: "/../a.jpg" }), DEFAULT_CHAT_BG);
  assert.deepEqual(sanitizeChatBg({ ...ok, id: -1 }), DEFAULT_CHAT_BG);
  assert.deepEqual(sanitizeChatBg({ ...ok, type: "anime" }), DEFAULT_CHAT_BG);
});

test("خلفية المحادثات: العمل للمشترك، وغيره يرى Loopz واختياره محفوظ", () => {
  const title = sanitizeChatBg({ k: "title", type: "movie", id: 242, path: "/g.jpg" });
  assert.equal(chatBgNeedsPlus(title), true);
  assert.equal(chatBgNeedsPlus({ k: "plain" }), false);
  assert.deepEqual(effectiveChatBg(title, true), title);
  assert.deepEqual(effectiveChatBg(title, false), DEFAULT_CHAT_BG);
  assert.deepEqual(effectiveChatBg({ k: "plain" }, false), { k: "plain" });
  assert.equal(sameChatBg(title, { ...title }), true);
  assert.equal(sameChatBg(title, { ...title, id: 243 } as typeof title), false);
});
