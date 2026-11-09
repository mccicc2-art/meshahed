import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getDict } from "./i18n.ts";
import {
  TOUR_IDS,
  TOUR_STEPS,
  TOUR_VERSION,
  WEB_TOUR_STEPS,
  appBodyOf,
  appTitleOf,
  furtherTour,
  liveTour,
  sanitizeTourState,
  stepsOf,
  tourWrite,
  type TourState,
} from "./tour.ts";

const st = (v: number, s: TourState["s"], i = 0): TourState => ({ v, id: "basics", i, s });

test("الجولةُ ثمانٍ في التطبيق بترتيب أحمد (T357): القائمةُ خامسة، والتخصيصُ سادسة، والمجتمعُ سابعة، والربطُ ثامنة", () => {
  assert.deepEqual([...TOUR_IDS], ["basics"]);
  assert.deepEqual(
    TOUR_STEPS.map((s) => s.id),
    ["discover", "search", "track", "home", "menu", "shape", "community", "links"],
  );
  assert.equal(stepsOf("basics", "app"), TOUR_STEPS);
  assert.equal(stepsOf("basics"), WEB_TOUR_STEPS);
});

test("الويبُ سبعٌ — وما يخصّ التطبيقَ آخرٌ دائماً، فأرقامُ ما بقي أرقامُ التطبيق (الحالةُ رقمٌ واحدٌ للطرفين)", () => {
  assert.equal(WEB_TOUR_STEPS.length, 7);
  WEB_TOUR_STEPS.forEach((s, i) => assert.equal(TOUR_STEPS[i], s, `${s.id} في موضعه`));
  const firstAppOnly = TOUR_STEPS.findIndex((s) => s.appOnly);
  assert.ok(firstAppOnly === -1 || TOUR_STEPS.slice(firstAppOnly).every((s) => s.appOnly));
});

test("كلُّ مسارِ خطوةٍ صفحةٌ قائمةٌ في الويب — مسارٌ ميّتٌ ٤٠٤ وسطَ الجولة", () => {
  for (const s of WEB_TOUR_STEPS) {
    const dir = fileURLToPath(new URL(`../app${s.path === "/" ? "" : s.path}/page.tsx`, import.meta.url));
    assert.ok(existsSync(dir), `${s.id} → ${s.path}`);
  }
});

test("لكلِّ خطوةٍ عنوانٌ ونصٌّ باللغتين، وعرضُ الجولة يذكر عددَها الحقيقيّ", () => {
  for (const locale of ["ar", "en"] as const) {
    const t = getDict(locale);
    for (const s of TOUR_STEPS) {
      assert.ok(s.title(t).length > 0, `${locale}:${s.id}:title`);
      assert.ok(s.body(t).length > 0, `${locale}:${s.id}:body`);
      assert.ok(appTitleOf(s, t).length > 0, `${locale}:${s.id}:appTitle`);
      for (const plus of [false, true]) assert.ok(appBodyOf(s, t, plus).length > 0, `${locale}:${s.id}:appBody:${plus}`);
      if (s.lead) assert.ok(s.lead(t).length > 0, `${locale}:${s.id}:lead`);
      if (s.tap) assert.ok(s.tap(t).length > 0, `${locale}:${s.id}:tap`);
    }
  }
  /* «٧ بطاقات» و«٨ بطاقات» وعدان مكتوبان بيد — وخطوةٌ تُضاف أو تُحذف بلا تعديلهما تجعلهما كذبة */
  assert.ok(getDict("ar").tourSuggestTitle.includes(WEB_TOUR_STEPS.length.toLocaleString("ar-EG")));
  assert.ok(getDict("en").tourSuggestTitle.includes(String(WEB_TOUR_STEPS.length)));
  assert.ok(getDict("ar").tourSuggestTitleApp.includes(TOUR_STEPS.length.toLocaleString("ar-EG")));
  assert.ok(getDict("en").tourSuggestTitleApp.includes(String(TOUR_STEPS.length)));
});

test("خطوةُ القائمة وحدَها بمرحلتين: نصُّ ما قبل الفعل، ثمّ حلقةٌ على «التخصيص» ودعوةٌ إليه — والتخصيصُ بعدها مباشرة", () => {
  assert.deepEqual(TOUR_STEPS.filter((s) => s.lead).map((s) => s.id), ["menu"]);
  assert.deepEqual(TOUR_STEPS.filter((s) => s.tap || s.openAnchor).map((s) => `${s.id}:${s.openAnchor}`), ["menu:drawer-customize"]);
  const menu = TOUR_STEPS.findIndex((s) => s.id === "menu");
  assert.equal(TOUR_STEPS[menu + 1].screen, "customize");
  assert.deepEqual(
    TOUR_STEPS.filter((s) => s.anchor).map((s) => `${s.id}:${s.anchor}`),
    ["discover:discover-filter", "search:search-describe", "menu:home-avatar"],
  );
});

test("ما يُقفل على غير المشترك يُقال له وحدَه (حكمُ أحمد «٥أ»)", () => {
  const t = getDict("ar");
  const shape = TOUR_STEPS.find((s) => s.id === "shape")!;
  assert.equal(shape.plusTag?.(false), true);
  assert.equal(shape.plusTag?.(true), false);
  assert.ok(appBodyOf(shape, t, false).includes(t.tourShapeSaveFree));
  assert.ok(!appBodyOf(shape, t, true).includes(t.tourShapeSaveFree));
  const links = TOUR_STEPS.find((s) => s.id === "links")!;
  assert.equal(links.plusTag, undefined, "الربطُ مجّانيٌّ بتطبيقٍ واحد — لا وسم");
  assert.notEqual(appBodyOf(links, t, false), appBodyOf(links, t, true));
});

test("حالةُ إصدارٍ أقدمَ تُقرأ «لم تُعرَض قطّ» — فمن أنهى القديمةَ يُعرَض عليه الجديد", () => {
  assert.equal(liveTour(null), null);
  assert.equal(liveTour(st(TOUR_VERSION - 1, "done", 5)), null);
  assert.deepEqual(liveTour(st(TOUR_VERSION, "suggested")), st(TOUR_VERSION, "suggested"));
});

test("رمزُ جولةٍ قديمٌ (`details`) يُقرأ `basics` ولا تُسقَط الحالة", () => {
  assert.deepEqual(sanitizeTourState({ v: 2, id: "details", i: 4, s: "active" }), { v: 2, id: "basics", i: 4, s: "active" });
  assert.equal(sanitizeTourState({ v: 3, i: 1, s: "nope" }), null);
});

test("المزامنة: الإصدارُ الأحدثُ يغلب ولو كان القديمُ «منتهياً»، ثمّ الأبعدُ في الإصدار نفسِه", () => {
  const oldDone = st(TOUR_VERSION - 1, "done", 7);
  const fresh = st(TOUR_VERSION, "suggested");
  assert.equal(furtherTour(oldDone, fresh), fresh);
  assert.equal(furtherTour(fresh, oldDone), fresh);
  assert.equal(furtherTour(st(TOUR_VERSION, "active", 2), st(TOUR_VERSION, "done", 0))?.s, "done");
  assert.equal(furtherTour(st(TOUR_VERSION, "active", 2), st(TOUR_VERSION, "active", 4))?.i, 4);
});

test("الكتابة: إصدارٌ أقدمُ لا يمحو أحدث — و«السابق» و«أعد الجولة» يكتبان", () => {
  const cur = st(TOUR_VERSION, "active", 3);
  assert.equal(tourWrite(cur, st(TOUR_VERSION - 1, "done", 6)), cur);
  assert.equal(tourWrite(cur, st(TOUR_VERSION, "active", 2))?.i, 2);
  assert.equal(tourWrite(st(TOUR_VERSION, "done", 6), st(TOUR_VERSION, "active", 0))?.s, "active");
  assert.equal(tourWrite(st(TOUR_VERSION - 1, "done", 6), st(TOUR_VERSION, "suggested"))?.v, TOUR_VERSION);
  assert.equal(tourWrite(cur, null), cur);
});
