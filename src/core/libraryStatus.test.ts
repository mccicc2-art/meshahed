import { test } from "node:test";
import assert from "node:assert/strict";
import { showStatusOf, movieStatusOf, watchStateOf } from "./libraryStatus.ts";

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

test("show status: Pause keeps the shelf of a show being watched", () => {
  assert.equal(showStatusOf({ aired_episodes: 10, watch_state: "paused" }, 4), "watching");
});

/* D-1281 — بدأ ثمّ أوقف ولم يشاهد شيئاً = لم يبدأ: قائمتُه «ابدأ» لا «كمّل» */
test("show status: Pause with no episode watched is an undo of Start", () => {
  assert.equal(showStatusOf({ aired_episodes: 10, watch_state: "paused" }, 0), "unstarted");
});

test("watchStateOf: the state as it is acted on", () => {
  assert.equal(watchStateOf({ watch_state: "started" }, 0), "started");
  assert.equal(watchStateOf({ watch_state: "started" }, 3), null);
  assert.equal(watchStateOf({ watch_state: "paused" }, 3), "paused");
  assert.equal(watchStateOf({ watch_state: "paused" }, 0), null);
  assert.equal(watchStateOf({ watch_state: "paused", dropped: true }, 3), null);
  assert.equal(watchStateOf({}, 3), null);
  assert.equal(watchStateOf({ watch_state: "other" }, 3), null);
});

test("show status: dropped and completed outrank the state", () => {
  assert.equal(showStatusOf({ aired_episodes: 10, dropped: true, watch_state: "started" }, 0), "dropped");
  assert.equal(showStatusOf({ aired_episodes: 10, watch_state: "paused" }, 10), "completed");
});

test("movie status ignores the state", () => {
  assert.equal(movieStatusOf({ watch_state: "started" }, false), "unstarted");
  assert.equal(movieStatusOf({}, true), "completed");
});
