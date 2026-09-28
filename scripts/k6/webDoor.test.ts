import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { topOf, webLayer, type State } from "../../apps/mobile/src/webDoor.ts";

/**
 * ====== K3b — متى تُرى طبقةُ الويب، ومتى يُغلق البابُ من تلقاء نفسه ======
 * الحالاتُ على شكل حالة expo-router نفسِها (المكدّسُ الجذر ملفوفٌ بمسارٍ أعلى).
 */
const r = (name: string, key = name) => ({ name, key });
const wrap = (routes: { name: string; key: string }[]): State => ({ index: 0, routes: [{ name: "__root", key: "root", state: { index: routes.length - 1, routes } }] });

beforeEach(() => {
  webLayer.attach(false);
  webLayer.attach(true);
});

test("قبل أوّل حالة: الطبقةُ مرئيّة (شاشةُ التحميل)", () => {
  assert.equal(webLayer.visibleFor(topOf(undefined)), true);
});

test("أعلى المكدّس `web`: الطبقةُ هي الشاشة", () => {
  const s = wrap([r("web")]);
  webLayer.sync(s);
  assert.equal(webLayer.visibleFor(topOf(s)), true);
});

test("الجذورُ فوق الويب بلا باب: مخفيّة", () => {
  const s = wrap([r("web"), r("(tabs)")]);
  webLayer.sync(s);
  assert.equal(webLayer.visibleFor(topOf(s)), false);
});

test("بابٌ من الغرفة: يُرسى عليها ويُرى، وعملٌ من الصفحة فوقها يُخفيه، ورجوعُه يكشفه", () => {
  const room = wrap([r("web"), r("(tabs)"), r("talk/[kind]/[id]", "room1")]);
  webLayer.sync(room);
  assert.equal(webLayer.canLayer(), true);
  assert.equal(webLayer.openDoor("community", "/u/khld"), true);
  assert.equal(webLayer.visibleFor(topOf(room)), true);
  const title = wrap([r("web"), r("(tabs)"), r("talk/[kind]/[id]", "room1"), r("title/[kind]/[id]", "t1")]);
  webLayer.sync(title);
  assert.equal(webLayer.visibleFor(topOf(title)), false);
  webLayer.sync(room);
  assert.equal(webLayer.visibleFor(topOf(room)), true);
  webLayer.closeDoor();
  assert.equal(webLayer.visibleFor(topOf(room)), false);
});

test("المرساةُ نُزعت (خروج · dismissAll قديم): البابُ يُغلق", () => {
  const room = wrap([r("web"), r("(tabs)"), r("talk/[kind]/[id]", "room1")]);
  webLayer.sync(room);
  webLayer.openDoor("community", "/u/khld");
  webLayer.sync(wrap([r("web")]));
  assert.equal(webLayer.door(), null);
});

test("طبقةٌ غيرُ مركَّبة: لا باب (الطريقُ القديم)", () => {
  webLayer.attach(false);
  assert.equal(webLayer.canLayer(), false);
});
