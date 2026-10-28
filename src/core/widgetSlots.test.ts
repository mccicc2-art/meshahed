import { test } from "node:test";
import assert from "node:assert/strict";
import { lookFor } from "./widgetLook.ts";
import { defaultWidgetConfigV3, effectiveWidgetConfig, resolveWidget, resolveWidgetLayout, sanitizeWidgetConfig, smallWidgetSection, type WidgetRow } from "./widgetLayout.ts";
import { defaultV3, resolveV3, sanitizeV3, usedKeys, type WidgetV3 } from "./widgetSlots.ts";

const names = (rows: WidgetRow[]) =>
  rows.map((r) =>
    r.type === "list" ? `${r.key}:${r.view}×${r.view === "posters" ? r.posters : r.count}`
    : r.type === "line" ? `line:${r.key}`
    : r.type === "pair" ? `pair:${r.keys.join("+")}×${r.count}`
    : r.type === "cont" ? (r.upLine ? `cont${r.card}+up` : `cont${r.card}`)
    : r.type === "tonight" ? `tonight:${r.view}`
    : r.type);

const rs = (platform: "android" | "ios" = "android") => ({ ...lookFor(null, platform, "xl"), resize: true });

test("الكبير جداً الافتراضي (خالد ٢١:٢٠): أكمل المشاهدة+القادم · نص للمشاهدة+نص فيلم الليلة · أصدقاؤك كامل · نشاطك سطر", () => {
  const l = resolveV3(defaultV3(), "xl", 590, rs());
  assert.deepEqual(names(l.rows), ["cont86+up", "pair:tw+tonight×3", "friends:list×3", "line:act"]);
  assert.ok(l.used <= 590);
});

test("الكبير: أكمل المشاهدة والقادم وخانة أصدقاؤك — وإن طال الودجت فنشاطك سطرٌ يكمّل (لا فراغ كبير)", () => {
  assert.deepEqual(names(resolveV3(defaultV3(), "large", 384, rs()).rows), ["cont86+up", "friends:list×3"]);
  assert.deepEqual(names(resolveV3(defaultV3(), "large", 440, rs()).rows), ["cont86+up", "friends:list×3", "line:act"]);
});

test("المتوسط: أكمل المشاهدة والقادم افتراضاً، والخانة نصّان بسطرين حين يختارها", () => {
  const v3 = defaultV3();
  assert.deepEqual(names(resolveV3(v3, "medium", 178, rs()).rows), ["cont86+up"]);
  v3.medium.top = false;
  assert.deepEqual(names(resolveV3(v3, "medium", 178, rs()).rows), ["pair:friends+tonight×2"]);
});

test("القادم في خانة: يختفي سطره تحت أكمل المشاهدة، ونشاطك يأخذ مكانه (خالد ٢١:٤٥)", () => {
  const v3 = defaultV3();
  v3.large.slot = { mode: "full", a: { s: "up", v: "list" }, b: { s: "tonight", v: "poster" } };
  assert.deepEqual(names(resolveV3(v3, "large", 384, rs()).rows), ["cont86", "up:list×3", "line:act"]);
  v3.xl.slots[0] = { mode: "pair", a: { s: "up", v: "list" }, b: { s: "tonight", v: "poster" } };
  /* الكبيرُ جداً: سطرا نشاطك والتالي غيرِ المستخدم */
  const xl = names(resolveV3(v3, "xl", 590, rs()).rows);
  assert.deepEqual(xl.slice(0, 3), ["cont86", "pair:up+tonight×3", "friends:list×3"]);
  assert.equal(xl[3], "line:act");
});

test("البوستر: قسمٌ كامل أربعة بوسترات، وفيلم الليلة بوستر دائماً، ونشاطك لا بوستر له في الكامل", () => {
  const v3 = defaultV3();
  v3.large.slot = { mode: "full", a: { s: "friends", v: "poster" }, b: { s: "tonight", v: "poster" } };
  assert.deepEqual(names(resolveV3(v3, "large", 384, rs()).rows), ["cont86+up", "friends:posters×4"]);
  v3.large.slot.a = { s: "tonight", v: "list" };
  /* بقي مكانُ سطر: نشاطك يكمّل تحت */
  assert.deepEqual(names(resolveV3(v3, "large", 384, rs()).rows), ["cont86+up", "tonight:poster", "line:act"]);
});

test("الآيفون: البطاقتان ٩٣", () => {
  const l = resolveV3(defaultV3(), "large", 382, { ...lookFor(null, "ios", "large"), resize: true });
  assert.equal(names(l.rows)[0], "cont93+up");
});

test("ما لا يتّسع يصير سطراً ثمّ يسقط — ولا شيء يتجاوز الارتفاع", () => {
  for (const h of [300, 340, 384, 440, 520, 590, 720]) {
    const l = resolveV3(defaultV3(), h < 450 ? "large" : "xl", h, rs());
    assert.ok(l.used <= h, `${h}: ${l.used}`);
  }
  const short = names(resolveV3(defaultV3(), "xl", 470, rs()).rows);
  /* القائمةُ بسطرين قبل أن تصير سطراً مختصراً */
  assert.deepEqual(short, ["cont86+up", "pair:tw+tonight×3", "friends:list×2"]);
});

test("الفارغ الآن يختفي: نصٌّ فارغ يجعل أخاه كاملاً، وخانةٌ فارغةٌ تسقط", () => {
  const l = resolveV3(defaultV3(), "xl", 590, rs(), new Set(["tw", "friends"]));
  assert.deepEqual(names(l.rows), ["cont86+up", "tonight:poster", "line:act", "line:up"]);
});

test("الإعداد المحفوظ: التالفُ يُصلح، والمكرّرُ في النصّين يُستبدل، وفيلم الليلة بوستر", () => {
  const v = sanitizeV3({ small: "bogus", medium: { top: "x", slot: { mode: "pair", a: { s: "act", v: "poster" }, b: { s: "act" } } }, xl: { line: "nope", slots: [{ a: { s: "tonight", v: "list" } }] } });
  assert.equal(v.small, "cont");
  assert.equal(v.medium.top, true);
  assert.equal(v.medium.slot.a.s, "act");
  assert.notEqual(v.medium.slot.b.s, "act");
  assert.equal(v.xl.line, "act");
  assert.deepEqual(v.xl.slots[0].a, { s: "tonight", v: "poster" });
});

test("كل إعداد يُقرأ بالخانات، وغير المشترك يأخذ الافتراضي، والصغير قسمه المختار", () => {
  const s = sanitizeWidgetConfig({ order: ["tw"], v3: { small: "tonight" } });
  assert.ok(s.v3);
  assert.equal(smallWidgetSection(s), "tonight");
  assert.deepEqual(effectiveWidgetConfig(s, false).v3, defaultV3());
  assert.equal(effectiveWidgetConfig(s, true), s);
});

test("المحسوم للرسّام: شكل النصف في الخيارات (بوستر للمشاهدة)، والمستخدم لا يُختار مرّتين", () => {
  const r = resolveWidget(defaultWidgetConfigV3(), true, "android");
  assert.equal(r.opts.tw.view, "posters");
  assert.equal(r.opts.friends.view, "list");
  assert.deepEqual(usedKeys(defaultV3() as WidgetV3, "xl").sort(), ["act", "friends", "tonight", "tw"]);
  const l = resolveWidgetLayout(defaultWidgetConfigV3(), "xl", 590, "android");
  assert.equal(l.hidden.length, 0);
});

test("D-1561: الإظهارُ القديم (on.up=false) لا يُسقط القادمَ من نصّه، والقادمُ في خانةٍ وهو فاضٍ لا يُرجع سطرَه بشَرطة", () => {
  const v3 = defaultV3();
  v3.xl.slots[1] = { mode: "pair", a: { s: "friends", v: "poster" }, b: { s: "up", v: "poster" } };
  const cfg = { ...defaultWidgetConfigV3(), v3 };
  cfg.on = { ...cfg.on, up: false };
  const r = resolveWidget(cfg, true, "android");
  assert.ok(names(r.rows.xl ?? []).includes("pair:friends+up×3"));
  /* القادمُ فاضٍ الآن: أصدقاؤك كامل، ولا سطرَ قادمٍ تحت أكمل المشاهدة */
  const e = names(resolveV3(v3, "xl", 590, rs(), new Set(["up"])).rows);
  assert.equal(e[0], "cont86");
  assert.ok(e.includes("friends:posters×4"));
});
