import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultV3, sanitizeV3, type WidgetV3 } from "./widgetSlots.ts";
import { defaultV4Look, layoutV4, sanitizeV4Look, slotsFit, smallV4, type V4Tile } from "./widgetTiles.ts";
import { defaultWidgetConfigV3, resolveWidget } from "./widgetLayout.ts";

/* المقاساتُ بنقاط التصميم — أرقامُ لوحات «المعمل — ٣٠ أكتوبر» */
const A = (h: number, v3: WidgetV3 = defaultV3(), empty: string[] = []) => layoutV4(v3, "android", 335, h, new Set(empty as never[]));
const I = (h: number, v3: WidgetV3 = defaultV3(), empty: string[] = []) => layoutV4(v3, "ios", 364, h, new Set(empty as never[]));
const cards = (t: V4Tile[]) => t.filter((x) => x.k === "card").map((x) => (x.k === "card" ? `${x.s}${x.img}` : ""));
const bottom = (t: V4Tile[]) => Math.max(...t.map((x) => x.y + x.h));
const pct = (v: number) => Math.round(v * 100);

test("أندرويد ٤×٢: البطاقتان ١٠٥٫٥ وصفُّ القادم ٤٤ — يملأ ١٧٨ بلا فراغ", () => {
  const l = A(178);
  assert.deepEqual(cards(l.tiles), ["contb", "contb"]);
  const c = l.tiles[0];
  assert.equal(c.w, 153);
  assert.ok(Math.abs(c.h - 105.5) < 0.6);
  assert.ok(l.tiles.some((t) => t.k === "up" && t.s === "up" && t.h === 44));
  assert.ok(bottom(l.tiles) <= 168.1);
});

test("٤×٢ بلا قادم: الصفُّ آخرُ نشاطٍ لأصدقائك", () => {
  const l = A(178, defaultV3(), ["up"]);
  assert.ok(l.tiles.some((t) => t.k === "up" && t.s === "friends"));
});

test("٤×٣ بإعداده الأصليّ: أصدقاؤك ٣ بوسترات (تصغيرٌ ٤٪)", () => {
  const l = A(275);
  assert.deepEqual(cards(l.tiles), ["contb", "contb", "friendsp", "friendsp", "friendsp"]);
  assert.equal(pct(1 - l.f), 4);
});

test("٤×٣ بعد التعديل: يتبع خاناتِ الشخص", () => {
  const v = { ...defaultV3(), edited: true };
  const l = A(275, v);
  assert.deepEqual(cards(l.tiles).slice(2), ["friendsp", "tonightb"]);
});

test("٤×٤: النصّان بوسترين، والسينما لا تتّسع", () => {
  const l = A(372);
  assert.deepEqual(cards(l.tiles), ["contb", "contb", "friendsp", "tonightp"]);
  assert.deepEqual(l.dropped, [["cine"]]);
});

test("٤×٥: السينما بطاقتان عريضتان، و٤×٦: ٣ بوسترات وتكبيرٌ ١٠٪", () => {
  assert.deepEqual(cards(A(470).tiles).slice(4), ["cineb", "cineb"]);
  const l6 = A(568);
  assert.deepEqual(cards(l6.tiles).slice(4), ["cinep", "cinep", "cinep"]);
  assert.equal(pct(l6.f - 1), 10);
  assert.ok(l6.spare < 4);
});

test("↻ في أقصى اليمين: على آخر بوستر السينما بخطوة ٣، وعلى النصّ بخطوة ١", () => {
  const t = A(568).tiles.filter((x) => x.k === "card");
  const cine = t.filter((x) => x.k === "card" && x.s === "cine");
  assert.equal(cine.length, 3);
  assert.equal(cine[2].k === "card" && cine[2].cyc, 3);
  assert.ok(cine.slice(0, 2).every((x) => x.k === "card" && !x.cyc));
  const tn = t.find((x) => x.k === "card" && x.s === "tonight");
  assert.equal(tn?.k === "card" && tn.cyc, 1);
});

test("آيفون: المتوسط البطاقتان والسطرُ النحيل، والكبير النصّان، والكبير جداً + السينما ٣ بوسترات", () => {
  const m = I(170);
  assert.deepEqual(cards(m.tiles), ["contb", "contb"]);
  assert.ok(m.tiles.some((t) => t.k === "slim"));
  assert.deepEqual(cards(I(382).tiles), ["contb", "contb", "friendsp", "tonightp"]);
  assert.deepEqual(cards(I(594).tiles).slice(4), ["cinep", "cinep", "cinep"]);
});

test("أكمل المشاهدة ٣ بوسترات: في ٤×٢ تملأ الارتفاع بلا القادم، وفي الكبير آخرُ خانةٍ تأخذ الفراغ", () => {
  const v: WidgetV3 = { ...defaultV3(), cont: "posters" };
  const m = A(178, v);
  assert.deepEqual(cards(m.tiles), ["contp", "contp", "contp"]);
  assert.ok(!m.tiles.some((t) => t.k === "up"));
  assert.equal(m.tiles[0].h, 158);
  const l = I(382, v);
  assert.ok(l.spare < 1);
});

test("المتوسط بخانة: ٣ بوسترات تملأ الارتفاع", () => {
  const v: WidgetV3 = { ...defaultV3(), medium: { ...defaultV3().medium, top: false }, xl: { ...defaultV3().xl, slots: [{ mode: "full", a: { s: "tw", v: "poster" }, b: { s: "act", v: "poster" } }, { mode: "off", a: { s: "cine", v: "poster" }, b: { s: "act", v: "poster" } }] } };
  const l = A(178, v);
  assert.deepEqual(cards(l.tiles), ["twp", "twp", "twp"]);
  assert.equal(l.tiles[0].h, 158);
});

test("الخانةُ الثانية «بدون»، والنصُّ الفارغ يجعل أخاه كاملاً", () => {
  const v = sanitizeV3({ ...defaultV3(), xl: { slots: [defaultV3().xl.slots[0], { mode: "off", a: { s: "cine", v: "poster" }, b: { s: "act", v: "poster" } }], line: "act" } });
  assert.equal(v.xl.slots[1].mode, "off");
  assert.deepEqual(cards(A(568, v).tiles).slice(2), ["friendsp", "tonightp"]);
  assert.deepEqual(cards(A(372, defaultV3(), ["tonight"]).tiles).slice(2), ["friendsp", "friendsp", "friendsp"]);
});

test("الخانةُ الأولى لا تكون «بدون»، وأكملُ المشاهدة يُحفظ", () => {
  const v = sanitizeV3({ cont: "posters", edited: true, xl: { slots: [{ mode: "off", a: { s: "friends" }, b: { s: "tonight" } }], line: "act" } });
  assert.equal(v.xl.slots[0].mode, "full");
  assert.equal(v.cont, "posters");
  assert.equal(v.edited, true);
});

test("الصغير: القسمُ و↻ لفيلم الليلة والسينما", () => {
  assert.deepEqual(smallV4(defaultV3()), { s: "cont" });
  assert.deepEqual(smallV4({ ...defaultV3(), small: "cine" }), { s: "cine", cyc: 1 });
});

test("الأرقامُ من الخادم تُصلَح: المجهولُ يسقط والناقصُ افتراضيّ، والآيفونُ الصغيرُ بوسترٌ كامل", () => {
  const l = sanitizeV4Look({ android: { draw: { lim: 0.1, bogus: 5, name: -1 } } });
  assert.equal(l.android.draw.lim, 0.1);
  assert.equal(l.android.draw.name, defaultV4Look().android.draw.name);
  assert.equal(l.ios.draw.smallZoom, 1);
  assert.equal("bogus" in l.android.draw, false);
});

test("resolveWidget يكتب المواضعَ لكلِّ ارتفاع، بلا الصفوف القديمة", () => {
  const r = resolveWidget(defaultWidgetConfigV3(), true, "android");
  const h = r.heights["570"];
  assert.ok(h.tiles && h.tiles.length > 0);
  assert.deepEqual(h.rows, []);
  assert.deepEqual(r.v4, { small: { s: "cont" } });
});

test("لا تصغيرَ تحت ٧٪: الودجتُ القصيرُ يُسقط صفَّ القادم بدل أن يعصره، وأندرويد قبل 12 يبقى بالرسم القديم", () => {
  for (const h of [140, 150, 160]) assert.ok(A(h).f >= 0.93 - 1e-9);
  const r = resolveWidget(defaultWidgetConfigV3(), true, "android", [], { resize: false });
  assert.equal(r.v4, undefined);
  assert.ok(Object.values(r.heights).every((e) => !e.tiles));
});

test("الخادمُ لا يقدر يجعل عرضَ التصميم صفراً", () => {
  assert.equal(sanitizeV4Look({ android: { nums: { designW: 0 } } }).android.nums.designW, 335);
});

/* 🆕 D-1609 — قسمٌ وحدَه: شبكةُ بوستراتٍ من القسم المختار، بلا «أكمل المشاهدة» فوقه */
test("قسمٌ وحدَه: المتوسطُ صفٌّ والكبيرُ صفّان، والعناصرُ بالترتيب والعنوانُ على الأولى", () => {
  const solo: WidgetV3 = { ...defaultV3(), small: "tw", solo: "tw" };
  const m = I(170, solo);
  assert.deepEqual(cards(m.tiles), ["twp", "twp", "twp"]);
  const l = I(376, solo);
  assert.equal(l.tiles.length, 6);
  assert.deepEqual(l.tiles.map((t) => (t.k === "card" ? t.i : -1)), [0, 1, 2, 3, 4, 5]);
  assert.ok(l.tiles.every((t) => t.k === "card" && t.s === "tw"));
  assert.equal(l.tiles.filter((t) => t.k === "card" && t.lab === 1).length, 1);
  assert.ok(bottom(l.tiles) <= 376 - 10 + 0.5);
  assert.equal(smallV4(solo).s, "tw");
});

/* 🆕 D-1610 — «مخصّص»: المواضعُ بأسماء الخانات، و«أكمل المشاهدة» فوقها أو لا */
test("مخصّص: أكمل المشاهدة فوق ثمّ الخانتان بأسمائهما في الكبير، وبلاه أربعُ خانات في الكبير جداً", () => {
  const big = I(376, { ...defaultV3(), custom: { top: true, count: 2 } });
  const keys = big.tiles.filter((t) => t.k === "card").map((t) => (t.k === "card" ? t.s : ""));
  assert.deepEqual(keys, ["cont", "cont", "slot1", "slot1", "slot1", "slot2", "slot2", "slot2"]);
  assert.ok(bottom(big.tiles) <= 376 - 10 + 0.5);
  const xl = I(580, { ...defaultV3(), custom: { top: false, count: 4 } });
  assert.equal(xl.tiles.filter((t) => t.k === "card").length, 12);
  assert.ok(xl.tiles.every((t) => t.k !== "card" || t.s.startsWith("slot")));
  assert.equal(smallV4({ ...defaultV3(), custom: { top: false, count: 1 } }).s, "slot1");
});

/* ───────── 🆕 ١٩ نوفمبر — أكملُ المشاهدة «بدون»: ثلاثُ خاناتٍ لازمة (أحمد: «يجبر الواحد يحط ثلاث صفوف او يقسم لاثنين») ───────── */
const OFF: WidgetV3 = {
  ...defaultV3(),
  edited: true,
  cont: "off",
  /* الثانيةُ «بدون» محفوظة: مع «بدون» لأكمل المشاهدة تصير قسماً كاملاً */
  xl: { ...defaultV3().xl, slots: [defaultV3().xl.slots[0], { ...defaultV3().xl.slots[1], mode: "off" }] },
  slot3: { mode: "full", a: { s: "tw", v: "poster" }, b: { s: "act", v: "poster" } },
};

test("بدون أكمل المشاهدة: لا بطاقةَ له في أيِّ حجم، والمتوسطُ الخانةُ الأولى تملؤه وما بعدها «لا يتّسع»", () => {
  for (const l of [A(178, OFF), A(290, OFF), A(372, OFF), A(568, OFF), I(170, OFF), I(382, OFF), I(594, OFF)]) {
    assert.ok(!cards(l.tiles).some((c) => c.startsWith("cont")));
  }
  const m = A(178, OFF);
  assert.deepEqual(cards(m.tiles), ["friendsp", "tonightp"]);
  assert.deepEqual(m.dropped, [["cine"], ["tw"]]);
});

test("بدون أكمل المشاهدة: الكبيرُ جداً يرسم الخاناتِ الثلاث، والثانيةُ لا تكون «بدون» — بلا فراغٍ فوق وتحت", () => {
  for (const l of [A(568, OFF), I(594, OFF)]) {
    assert.deepEqual([...new Set(cards(l.tiles))], ["friendsp", "tonightp", "cinep", "twp"]);
    assert.deepEqual(l.dropped, []);
    assert.ok(l.spare < 1);
  }
});

test("بدون أكمل المشاهدة: الكبيرُ خانتان والثالثةُ «لا يتّسع»", () => {
  const l = A(372, OFF);
  assert.deepEqual([...new Set(cards(l.tiles))].slice(0, 2), ["friendsp", "tonightp"]);
  assert.ok(cards(l.tiles).some((c) => c.startsWith("cine")));
  assert.deepEqual(l.dropped, [["tw"]]);
});

test("بدون أكمل المشاهدة والخاناتُ كلُّها فارغةٌ الآن: يرجع أكملُ المشاهدة بدل ودجتٍ فارغ", () => {
  const l = A(372, OFF, ["friends", "tonight", "cine", "tw"]);
  assert.deepEqual(cards(l.tiles), ["contb", "contb"]);
});

test("المتوسطُ وأكملُ المشاهدة فيه: الخاناتُ المختارةُ تُذكر «لا يتّسع» لا «كلُّها تتّسع»", () => {
  const v = { ...defaultV3(), edited: true, cont: "posters" as const };
  assert.deepEqual(A(178, v).dropped, [["friends", "tonight"], ["cine"]]);
});

test("sanitizeV3 يحفظ «بدون» والخانةَ الثالثة، والقسمُ المكرّرُ فيها يُصلَح عند القراءة", () => {
  const s = sanitizeV3(JSON.parse(JSON.stringify({ ...OFF, slot3: { mode: "full", a: { s: "friends", v: "poster" }, b: { s: "act", v: "poster" } } })));
  assert.equal(s.cont, "off");
  /* أصدقاؤك في الأولى ⇒ الثالثةُ تأخذ أوّلَ قسمٍ حرٍّ بالأولويّة */
  const l = A(568, s);
  const keys = cards(l.tiles).map((c) => c.slice(0, -1));
  assert.equal(new Set(keys).size, 4);
});

/* ───────── 🆕 ١٩ نوفمبر — الخاناتُ التي لا تتّسع للحجم تبهت في المحرّر (أحمد «ب») ───────── */
test("slotsFit: بدون أكمل المشاهدة — ٤×٢ خانة، والكبير خانتان، والكبير جداً ثلاث", () => {
  assert.deepEqual(slotsFit(OFF, "android", 335, 178), [true, false, false]);
  assert.deepEqual(slotsFit(OFF, "android", 335, 372), [true, true, false]);
  assert.deepEqual(slotsFit(OFF, "android", 335, 568), [true, true, true]);
  assert.deepEqual(slotsFit(OFF, "ios", 364, 170), [true, false, false]);
  assert.deepEqual(slotsFit(OFF, "ios", 364, 594), [true, true, true]);
});

test("slotsFit: مع أكمل المشاهدة — ٤×٢ لا خانة فيه، والكبير جداً خانتاه", () => {
  const v = { ...defaultV3(), edited: true };
  assert.deepEqual(slotsFit(v, "android", 335, 178), [false, false]);
  assert.deepEqual(slotsFit(v, "android", 335, 568), [true, true]);
});

test("قسمٌ في خانةٍ لا تتّسع ثمّ يُختار في الأولى: حين تتّسع تدخل بأوّل قسمٍ حرّ — لا تكرار", () => {
  const v: WidgetV3 = { ...OFF, xl: { ...OFF.xl, slots: [{ mode: "full", a: { s: "cine", v: "poster" }, b: { s: "act", v: "poster" } }, OFF.xl.slots[1]] } };
  const keys = cards(A(568, v).tiles).map((c) => c.slice(0, -1));
  assert.equal(keys.filter((k) => k === "cine").length, 3);
  assert.equal(new Set(keys).size, 3);
});
