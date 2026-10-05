import { test } from "node:test";
import assert from "node:assert/strict";
import { showStatusOf, movieStatusOf } from "./libraryStatus.ts";

/* D-1280 — «ابدأ» و«إيقاف مؤقّت» قراران فوق الوقائع: الوصفةُ الواحدة تحكم المكتبةَ والقوائمَ الذكيّةَ والعدّادات */
test("show status: facts alone", () => {
  assert.equal(showStatusOf({ aired_episodes: 10 }, 0), "unstarted");
  assert.equal(showStatusOf({ aired_episodes: 10 }, 3), "watching");
  assert.equal(showStatusOf({ aired_episodes: 10 }, 10), "completed");
  assert.equal(showStatusOf({ aired_episodes: 10, dropped: true }, 3), "dropped");
});

test("show status: Start moves an unwatched show to watching", () => {
  assert.equal(showStatusOf({ aired_episodes: 10, watch_state: "started" }, 0), "watching");
  assert.equal(showStatusOf({ aired_episodes: 0, watch_state: "started" }, 0), "watching");
});

test("show status: Pause keeps the shelf, never returns a show to unstarted", () => {
  assert.equal(showStatusOf({ aired_episodes: 10, watch_state: "paused" }, 4), "watching");
  assert.equal(showStatusOf({ aired_episodes: 10, watch_state: "paused" }, 0), "watching");
});

test("show status: dropped and completed outrank the state", () => {
  assert.equal(showStatusOf({ aired_episodes: 10, dropped: true, watch_state: "started" }, 0), "dropped");
  assert.equal(showStatusOf({ aired_episodes: 10, watch_state: "paused" }, 10), "completed");
});

test("movie status ignores the state", () => {
  assert.equal(movieStatusOf({ watch_state: "started" }, false), "unstarted");
  assert.equal(movieStatusOf({}, true), "completed");
});
