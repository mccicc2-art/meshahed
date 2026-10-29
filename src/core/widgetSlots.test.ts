import { test } from "node:test";
import assert from "node:assert/strict";
import { lookFor } from "./widgetLook.ts";
import { defaultWidgetConfigV3, effectiveWidgetConfig, resolveWidget, resolveWidgetLayout, sanitizeWidgetConfig, smallWidgetSection, type WidgetRow } from "./widgetLayout.ts";
import { defaultV3, resolveV3, sanitizeV3, usedKeys, type WidgetV3 } from "./widgetSlots.ts";

const names = (rows: WidgetRow[]) =>
  rows.map((r) =>
    r.type === "list" ? `${r.key}:${r.view}×${r.view === "posters" ? r.posters : r.count}`
    : r.type === "line" ? `line:${r.key}${r.index ? `#${r.index + 1}` : ""}`
    : r.type === "pair" ? `pair:${r.keys.join("+")}×${r.count}`
    : r.type === "cont" ? (r.upLine ? `cont${r.card}+up` : `cont${r.card}`)
    : r.type === "tonight" ? `tonight:${r.view}`
    : r.type);

const rs = (platform: "android" | "ios" = "android") => ({ ...lookFor(null, platform, "xl"), resize: true });

test("الكبير جداً الافتراضي (خالد ١٤:١٦): أكمل المشاهدة+القادم · نص أصدقاؤك+نص فيلم الليلة · السينما كاملة · نشاطك سطر", () => {
  const l = resolveV3(defaultV3(), "xl", 590, rs());
  assert.deepEqual(names(l.rows), ["cont86+up", "pair:friends+tonight×3", "cine:posters×4", "line:act", "line:act#2"]);
  assert.ok(l.used <= 590);
  /* جوالُ خالد: ٤×٦ ≈ ٥٦٨ بنقاط التصميم — الشكلُ نفسُه */
  assert.deepEqual(names(resolveV3(defaultV3(), "xl", 568, rs()).rows), ["cont86+up", "pair:friends+tonight×3", "cine:posters×4", "line:act", "line:act#2"]);
});

test("النصّان: أصدقاؤك ثلاثة أسطر، وغيرُه أربعةٌ مختصرة (خالد ١٤:١٣)", () => {
  const r = resolveV3(defaultV3(), "xl", 590, rs()).rows[1];
  assert.ok(r.type === "pair");
  assert.deepEqual(r.type === "pair" && r.rows, [3, 4]);
});

test("D-1575: ترتيب الكبير جداً لكل المقاسات — بالترتيب وبالشكل الكامل، ونشاطك سطرٌ يعبّي، والباقي يكبّر النصّين", () => {
  const n = (sz: "medium" | "large" | "xl", h: number) => names(resolveV3(defaultV3(), sz, h, rs()).rows);
  assert.deepEqual(n("medium", 178), ["cont86+up"]);
  /* ٤×٣ (٢٧٥): النصّان لا يتّسعان ⇒ لا سطورَ مختصرةً لهما، نشاطك سطران */
  assert.deepEqual(n("large", 275), ["cont86+up", "line:act", "line:act#2"]);
  /* ٤×٤: ثلاثة أشياء (خالد ١٩:٣٦) والنصّان أطول بما بقي */
  assert.deepEqual(n("large", 372), ["cont86+up", "pair:friends+tonight×3"]);
  const p = resolveV3(defaultV3(), "large", 372, rs()).rows[1];
  assert.ok(p.h > 158 && p.h <= 182, String(p.h));
  /* ٤×٥ (٤٧٠): السينما تدخل بتصغيرٍ يسير للنصّين والسينما */
  assert.deepEqual(n("xl", 470), ["cont86+up", "pair:friends+tonight×3", "cine:posters×4"]);
});

test("المتوسط بلا أكمل المشاهدة: أوّلُ خانةٍ من الترتيب", () => {
  const v3 = defaultV3();
  v3.medium.top = false;
  assert.deepEqual(names(resolveV3(v3, "medium", 178, rs()).rows), ["pair:friends+tonight×3"]);
});

test("القادم في خانة: يختفي سطره تحت أكمل المشاهدة (خالد ٢١:٤٥)", () => {
  const v3 = defaultV3();
  v3.xl.slots[0] = { mode: "pair", a: { s: "up", v: "list" }, b: { s: "tonight", v: "poster" } };
  assert.deepEqual(names(resolveV3(v3, "xl", 590, rs()).rows).slice(0, 3), ["cont86", "pair:up+tonight×3", "cine:posters×4"]);
});

test("البوستر: قسمٌ كامل أربعة بوسترات، وفيلم الليلة والسينما بوستر دائماً", () => {
  const v3 = defaultV3();
  v3.xl.slots[0] = { mode: "full", a: { s: "friends", v: "poster" }, b: { s: "tonight", v: "poster" } };
  assert.deepEqual(names(resolveV3(v3, "large", 384, rs()).rows).slice(0, 2), ["cont86+up", "friends:posters×4"]);
  v3.xl.slots[0] = { mode: "full", a: { s: "tonight", v: "list" }, b: { s: "act", v: "list" } };
  assert.deepEqual(names(resolveV3(v3, "large", 384, rs()).rows).slice(0, 2), ["cont86+up", "tonight:poster"]);
  assert.deepEqual(sanitizeV3({ large: { slot: { mode: "full", a: { s: "cine", v: "list" } } } }).large.slot.a, { s: "cine", v: "poster" });
});

test("الآيفون: البطاقتان ٩٣", () => {
  const l = resolveV3(defaultV3(), "large", 382, { ...lookFor(null, "ios", "large"), resize: true });
  assert.equal(names(l.rows)[0], "cont93+up");
});

test("لا شيء يتجاوز الارتفاع", () => {
  for (const h of [178, 275, 300, 372, 384, 440, 470, 520, 568, 590, 720]) {
    const l = resolveV3(defaultV3(), h < 450 ? "large" : "xl", h, rs());
    assert.ok(l.used <= h, `${h}: ${l.used}`);
  }
});

test("الفارغ الآن يختفي: نصٌّ فارغ يجعل أخاه كاملاً، وخانةٌ فارغةٌ تسقط", () => {
  const l = resolveV3(defaultV3(), "xl", 590, rs(), new Set(["friends"]));
  assert.deepEqual(names(l.rows).slice(0, 3), ["cont86+up", "tonight:poster", "cine:posters×4"]);
  const noAct = resolveV3(defaultV3(), "large", 372, rs(), new Set(["act"]));
  assert.deepEqual(names(noAct.rows), ["cont86+up", "pair:friends+tonight×3"]);
});

test("الإعداد المحفوظ: التالفُ يُصلح، والمكرّرُ في النصّين يُستبدل، وفيلم الليلة بوستر", () => {
  const v = sanitizeV3({ small: "bogus", medium: { top: "x", slot: { mode: "pair", a: { s: "act", v: "poster" }, b: { s: "act" } } }, xl: { line: "nope", slots: [{ a: { s: "tonight", v: "list" } }] } });
  assert.equal(v.small, "cont");
  assert.equal(v.medium.top, true);
  assert.equal(v.medium.slot.a.s, "act");
  assert.notEqual(v.medium.slot.b.s, "act");
  assert.equal(v.xl.line, "act");
  assert.deepEqual(v.xl.slots[0].a, { s: "tonight", v: "poster" });
  assert.equal(sanitizeV3({ small: "cine" }).small, "cine");
});

test("كل إعداد يُقرأ بالخانات، وغير المشترك يأخذ الافتراضي، والصغير قسمه المختار", () => {
  const s = sanitizeWidgetConfig({ order: ["tw"], v3: { small: "tonight" } });
  assert.ok(s.v3);
  assert.equal(smallWidgetSection(s), "tonight");
  assert.deepEqual(effectiveWidgetConfig(s, false).v3, defaultV3());
  assert.equal(effectiveWidgetConfig(s, true), s);
});

test("المحسوم للرسّام: السينما بوسترات في الخيارات، والمستخدم لا يُختار مرّتين", () => {
  const r = resolveWidget(defaultWidgetConfigV3(), true, "android");
  assert.equal(r.opts.cine.view, "posters");
  assert.equal(r.opts.friends.view, "list");
  assert.deepEqual(usedKeys(defaultV3() as WidgetV3, "xl").sort(), ["act", "cine", "friends", "tonight"]);
  const l = resolveWidgetLayout(defaultWidgetConfigV3(), "xl", 590, "android");
  assert.equal(l.hidden.length, 0);
  /* D-1575 — أكملُ المشاهدة الصغيرُ شكلُه القديم: البوسترُ يملأ الطوليّ، والهيدرُ يذوب في المربّع */
  assert.equal(r.small.tall, "posterFull");
  assert.equal(r.small.square, "headerFade");
});

test("D-1561: الإظهارُ القديم (on.up=false) لا يُسقط القادمَ من نصّه، والقادمُ في خانةٍ وهو فاضٍ لا يُرجع سطرَه", () => {
  const v3 = defaultV3();
  v3.xl.slots[1] = { mode: "pair", a: { s: "tw", v: "poster" }, b: { s: "up", v: "poster" } };
  const cfg = { ...defaultWidgetConfigV3(), v3 };
  cfg.on = { ...cfg.on, up: false };
  const r = resolveWidget(cfg, true, "android");
  assert.ok(Object.values(r.heights).some((e) => names(e.rows).includes("pair:tw+up×3")));
  const e = names(resolveV3(v3, "xl", 590, rs(), new Set(["up"])).rows);
  assert.equal(e[0], "cont86");
  assert.ok(e.includes("tw:posters×4"));
});

test("الإعدادُ المحفوظُ بالافتراضي القديم يصير الجديد، والمخصّصُ لا يُمسّ (D-1574)", () => {
  const old = { xl: { slots: [{ mode: "pair", a: { s: "tw", v: "poster" }, b: { s: "tonight", v: "poster" } }, { mode: "full", a: { s: "friends", v: "list" }, b: { s: "act", v: "list" } }], line: "act" } };
  assert.deepEqual(sanitizeV3(old).xl, defaultV3().xl);
  const mine = { xl: { slots: [{ mode: "pair", a: { s: "tw", v: "poster" }, b: { s: "tonight", v: "poster" } }, { mode: "full", a: { s: "up", v: "list" }, b: { s: "act", v: "list" } }], line: "act" } };
  assert.equal(sanitizeV3(mine).xl.slots[1].a.s, "up");
});
