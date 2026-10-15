import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultWidgetConfig, resolveWidgetLayout, smallWidgetSection, smallWidgetForm, fitImage, widgetAccess,
  effectiveWidgetConfig, sanitizeWidgetConfig, widgetSizesFor, resolveWidget, WIDGET_HEIGHTS, type WidgetLayoutConfig, type WidgetRow,
} from "./widgetLayout.ts";

const names = (rows: WidgetRow[]) => rows.map((r) =>
  r.type === "list" ? `${r.key}×${r.count}` : r.type === "line" ? `line:${r.key}` : r.type === "pair" ? `pair:${r.keys.join("+")}` : r.type === "cont" ? (r.upLine ? "cont+line" : "cont") : r.type);

/* W29 · W39 — الترتيبُ الافتراضيّ في الكبير: ما لا يتّسع سطرٌ مختصر، ولا فراغَ كبير */
test("الكبير الافتراضي: البحث، أكمل المشاهدة، القادم، وفيلم الليلة سطراً مختصراً", () => {
  const l = resolveWidgetLayout(defaultWidgetConfig(), "large");
  assert.deepEqual(names(l.rows), ["search", "cont", "up×2", "line:tonight"]);
  assert.equal(l.used, 396);
  assert.deepEqual(l.hidden, ["friends", "tw", "act"]);
});

/* W33 — سطرُ «القادم» تحت البطاقات يظهر في المتوسط (القسمُ وحده) */
test("المتوسط: أكمل المشاهدة وحده ومعه سطر القادم", () => {
  const l = resolveWidgetLayout(defaultWidgetConfig(), "medium");
  assert.deepEqual(names(l.rows), ["cont+line"]);
  assert.equal(l.used, WIDGET_HEIGHTS.pad + WIDGET_HEIGHTS.cont + WIDGET_HEIGHTS.upLine);
});

test("سطر القادم يعود إذا أُخفي قسم القادم", () => {
  const cfg = defaultWidgetConfig();
  cfg.on.up = false;
  const l = resolveWidgetLayout(cfg, "large");
  assert.equal(l.rows.find((r) => r.type === "cont")?.type === "cont" && (l.rows.find((r) => r.type === "cont") as { upLine: boolean }).upLine, true);
});

/* حالةُ أحمد (١٤ أكتوبر ٠٤:٠٥): كان يترك ثلثَ الودجت فارغاً */
test("لا فراغ كبير: صف الصغيرين يدخل بسطرين حين لا يتسع بثلاثة", () => {
  const cfg = defaultWidgetConfig();
  cfg.on.search = false; cfg.on.tw = false; cfg.on.act = false;
  cfg.opts.tonight.size = "small"; cfg.opts.friends.size = "small";
  const l = resolveWidgetLayout(cfg, "large");
  assert.deepEqual(names(l.rows), ["cont", "up×2", "pair:tonight+friends"]);
  assert.equal((l.rows[2] as { count: number }).count, 2);
  assert.deepEqual(l.hidden, []);
  assert.ok(440 - l.used < WIDGET_HEIGHTS.line + WIDGET_HEIGHTS.gap);
});

test("قسم لا يتسع لا يوقف الترتيب: ما بعده يُجرَّب", () => {
  const cfg = defaultWidgetConfig();
  cfg.on.tw = false; cfg.on.act = false;
  cfg.opts.cont.size = "small"; cfg.opts.up.size = "small"; cfg.opts.tonight.size = "small";
  const l = resolveWidgetLayout(cfg, "large");
  assert.deepEqual(names(l.rows), ["search", "pair:cont+up", "pair:tonight", "line:friends"]);
});

test("فراغ سطر: آخر قائمة بسطرين تصير ثلاثة", () => {
  const cfg = defaultWidgetConfig();
  cfg.order = ["cont", "up", "search", "tonight", "friends", "tw", "act"];
  cfg.on.search = false; cfg.on.tonight = false; cfg.on.friends = false; cfg.on.tw = false; cfg.on.act = false;
  const l = resolveWidgetLayout(cfg, "large");
  assert.deepEqual(names(l.rows), ["cont", "up×3"]);
});

test("الصغيران المتتاليان صف واحد، والصغير الوحيد نصف صف", () => {
  const cfg = defaultWidgetConfig();
  cfg.opts.tonight.size = "small"; cfg.opts.friends.size = "small"; cfg.opts.tw.size = "small";
  const l = resolveWidgetLayout(cfg, "xl");
  const pairs = l.rows.filter((r) => r.type === "pair").map((r) => (r as { keys: string[] }).keys);
  assert.deepEqual(pairs[0], ["tonight", "friends"]);
  assert.ok(l.used <= 720);
});

test("الحجم الصغير: القسم المختار أو أول قسم غير البحث", () => {
  const cfg = defaultWidgetConfig();
  assert.equal(smallWidgetSection(cfg), "cont");
  cfg.smallPick = "tonight";
  assert.equal(smallWidgetSection(cfg), "tonight");
  cfg.smallPick = "search";
  assert.equal(smallWidgetSection(cfg), "cont");
});

/* W38 — بلا زوم ولا فراغ: المطّ ٥٪ أساساً وحتّى ٨٪ */
test("الصورة: البوستر للطولي، الهيدر للعريض، ولا شيء للمربع", () => {
  const tall = fitImage(358, 508);
  assert.equal(tall?.image, "poster");
  assert.ok((tall?.stretch ?? 1) < 0.06);
  assert.equal(fitImage(334, 188)?.image, "backdrop");
  assert.equal(fitImage(170, 170), null);
  assert.equal(fitImage(0, 10), null);
});

/* W33 · W34 · W43 — شكلُ الحجم الصغير حسب المقاس الحقيقيّ */
test("شكل الصغير: أندرويد الطولي بوستر كامل، والمربع هيدر ذائب أو بوستر وعمود", () => {
  const cfg = defaultWidgetConfig();
  assert.equal(smallWidgetForm(cfg, "cont", 173, 246), "posterFull");
  assert.equal(smallWidgetForm(cfg, "cont", 170, 170), "headerFade");
  assert.equal(smallWidgetForm(cfg, "tonight", 170, 170), "posterColumn");
  assert.equal(smallWidgetForm(cfg, "tw", 170, 170), "posterColumn");
  assert.equal(smallWidgetForm(cfg, "up", 170, 170), "list");
  cfg.opts.tonight.small = "list";
  assert.equal(smallWidgetForm(cfg, "tonight", 173, 246), "list");
});

/* W49 — الودجتُ مجانيّ، والتخصيصُ لوبز+ */
test("غير المشترك: الودجت بكل أحجامه بالترتيب الأساسي، وتخصيصه محفوظ", () => {
  assert.equal(widgetAccess(true, "xl"), "full");
  assert.equal(widgetAccess(false, "small"), "basic");
  assert.equal(widgetAccess(false, "large"), "basic");
  const mine: WidgetLayoutConfig = defaultWidgetConfig();
  mine.order = ["tonight", "cont", "search", "up", "friends", "tw", "act"];
  const eff = effectiveWidgetConfig(mine, false);
  assert.deepEqual(eff, defaultWidgetConfig());
  assert.equal(mine.order[0], "tonight");
  assert.equal(effectiveWidgetConfig(mine, true), mine);
});

test("الآيفون بلا الكبير جداً", () => {
  assert.deepEqual(widgetSizesFor("ios"), ["small", "medium", "large"]);
  assert.deepEqual(widgetSizesFor("android"), ["small", "medium", "large", "xl"]);
});

test("إعداد فاسد من التخزين يُصلح ولا يُرمى", () => {
  assert.deepEqual(sanitizeWidgetConfig(null), defaultWidgetConfig());
  const s = sanitizeWidgetConfig({ order: ["tw", "tw", "x", "cont"], on: { tw: false, zzz: true }, opts: { search: { size: "small" }, up: { size: "small", count: 3 } }, smallPick: "nope" });
  assert.equal(s.order.length, 7);
  assert.deepEqual(s.order.slice(0, 2), ["tw", "cont"]);
  assert.equal(s.on.tw, false);
  assert.equal(s.opts.search.size, "full");
  assert.equal(s.opts.up.size, "small");
  assert.equal(s.opts.up.count, 3);
  assert.equal(s.smallPick, "first");
});

/* W31 — الرائجُ اليوم تحت البحث الكامل: قائمةٌ افتراضاً، والبوستراتُ أطول */
test("البحث الكامل: الرائج قائمة افتراضاً، والبوسترات المرقمة بارتفاع شبكتها", () => {
  const cfg = defaultWidgetConfig();
  assert.equal(cfg.opts.search.trend, "list");
  cfg.opts.search.view = "full";
  const list = resolveWidgetLayout(cfg, "large").rows[0];
  assert.deepEqual(list.type === "search" && [list.trend, list.h], ["list", WIDGET_HEIGHTS.searchFull]);
  cfg.opts.search.trend = "posters";
  const posters = resolveWidgetLayout(cfg, "large").rows[0];
  assert.deepEqual(posters.type === "search" && [posters.trend, posters.h], ["posters", WIDGET_HEIGHTS.searchFullPosters]);
  cfg.opts.search.view = "compact";
  assert.equal(resolveWidgetLayout(cfg, "large").rows[0].h, WIDGET_HEIGHTS.searchCompact);
  assert.equal(sanitizeWidgetConfig({ opts: { search: { view: "full", trend: "x" } } }).opts.search.trend, "list");
  assert.equal(sanitizeWidgetConfig({ opts: { up: { trend: "posters" } } }).opts.up.trend, undefined);
});

/* §11.2 — الخلاصةُ تحمل الصفوفَ محسومةً لكلِّ حجم */
test("المحسوم للرسّام: صفوف كل حجم، والقفل لغير المشترك، وشكلا الصغير", () => {
  const plus = resolveWidget(defaultWidgetConfig(), true, "android");
  assert.deepEqual(Object.keys(plus.rows).sort(), ["large", "medium", "xl"]);
  assert.deepEqual(plus.locked, {});
  assert.deepEqual([plus.small.key, plus.small.tall, plus.small.square], ["cont", "posterFull", "headerFade"]);
  const free = resolveWidget(defaultWidgetConfig(), false, "ios");
  assert.deepEqual(free.locked, {});
  assert.deepEqual(Object.keys(free.rows).sort(), ["large", "medium"]);
});

test("الآيفون يُحسم بمقاسه: الكبير أقصر فيدخل أقل", () => {
  const a = resolveWidget(defaultWidgetConfig(), true, "android").rows.large ?? [];
  const i = resolveWidget(defaultWidgetConfig(), true, "ios").rows.large ?? [];
  const sum = (rows: WidgetRow[]) => rows.reduce((n, r) => n + r.h, 0) + Math.max(0, rows.length - 1) * WIDGET_HEIGHTS.gap + WIDGET_HEIGHTS.pad;
  assert.ok(sum(i) <= 376);
  assert.ok(sum(a) <= 440);
});

/* تسجيلُ أحمد ١٤ أكتوبر — الصفوفُ لكلِّ ارتفاعٍ حقيقيّ، والقسمُ الفارغُ يختفي («ب») */
test("الصفوف لكل ارتفاع حقيقي: أطول يدخل أكثر، ولا يتجاوز المقاس", () => {
  const cfg = defaultWidgetConfig();
  for (const k of ["up", "tonight", "friends", "tw", "act"] as const) cfg.opts[k].size = "small";
  const r = resolveWidget(cfg, true, "android", ["up"]);
  const sum = (rows: WidgetRow[]) => rows.reduce((n, x) => n + x.h, 0) + Math.max(0, rows.length - 1) * WIDGET_HEIGHTS.gap + WIDGET_HEIGHTS.pad;
  for (const [h, v] of Object.entries(r.heights)) assert.ok(sum(v.rows) <= Number(h), `h=${h}`);
  assert.ok(r.heights["600"].rows.length > r.heights["400"].rows.length);
  assert.equal(r.heights["200"].size, "medium");
  assert.equal(r.heights["620"].size, "xl");
  assert.ok(!JSON.stringify(r.heights).includes('"up"'));
  /* القادمُ مخفيٌّ فارغاً ⇒ سطرُه يعود تحت البطاقات */
  const c = r.heights["600"].rows.find((x) => x.type === "cont");
  assert.equal(c?.type === "cont" && c.upLine, true);
});

/* 🆕 تسجيلُ أحمد (١٤ أكتوبر، بناء 75): الفراغُ يعود صفوفاً لا مسافات — مقاسا جوّاله الحقيقيّان */
test("الفراغ يعود صفوفاً: ٦٠٠ يكبّر الأصدقاء والنصفين، و٥٠٠ يبقيهما بسطرين", () => {
  const cfg = defaultWidgetConfig();
  cfg.order = ["search", "cont", "friends", "tonight", "act", "up", "tw"];
  cfg.on.up = false; cfg.on.tw = false;
  cfg.opts.tonight.size = "small"; cfg.opts.act.size = "small";
  const big = resolveWidgetLayout(cfg, "xl", 600);
  assert.deepEqual(names(big.rows), ["search", "cont+line", "friends×3", "pair:tonight+act"]);
  assert.equal((big.rows[3] as { count: number }).count, 3);
  assert.ok(big.used <= 600 && 600 - big.used < WIDGET_HEIGHTS.listRow);
  const mid = resolveWidgetLayout(cfg, "large", 500);
  assert.deepEqual(names(mid.rows), ["search", "cont+line", "friends×2", "pair:tonight+act"]);
  assert.equal((mid.rows[3] as { count: number }).count, 2);
});

test("المتوسط وأكمل المشاهدة وحده: البطاقتان تكبران حين يتسع", () => {
  const l = resolveWidgetLayout(defaultWidgetConfig(), "medium", 200);
  assert.equal(l.rows[0].type === "cont" && l.rows[0].tall, true);
  const s = resolveWidgetLayout(defaultWidgetConfig(), "medium", 180);
  assert.equal(s.rows[0].type === "cont" && !!s.rows[0].tall, false);
});

/* 🆕 W45 — أكملُ المشاهدة الصغير: «صورة» افتراضاً، و«قائمة» تختاره القائمةَ في المربّع */
test("أكمل المشاهدة الصغير: صورة افتراضاً، والقائمة اختيار", () => {
  const def = defaultWidgetConfig();
  assert.equal(def.opts.cont.small, "image");
  assert.notEqual(smallWidgetForm(def, "cont", 170, 170), "list");
  const list = sanitizeWidgetConfig({ opts: { cont: { size: "small", view: "cards", count: 2, small: "list" } } });
  assert.equal(list.opts.cont.small, "list");
  assert.equal(smallWidgetForm(list, "cont", 170, 170), "list");
  assert.equal(sanitizeWidgetConfig({ opts: { cont: { small: "bogus" } } }).opts.cont.small, "image");
});
