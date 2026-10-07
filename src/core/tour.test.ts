import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getDict } from "./i18n.ts";
import {
  TOUR_IDS,
  TOUR_STEPS,
  TOUR_VERSION,
  furtherTour,
  liveTour,
  sanitizeTourState,
  stepsOf,
  tourWrite,
  type TourState,
} from "./tour.ts";

const st = (v: number, s: TourState["s"], i = 0): TourState => ({ v, id: "basics", i, s });

test("الجولةُ واحدةٌ من سبع، بترتيب أحمد: تبدأ باكتشف، والتخصيصُ سادسةٌ والمجتمعُ سابعة", () => {
  assert.deepEqual([...TOUR_IDS], ["basics"]);
  assert.deepEqual(
    TOUR_STEPS.map((s) => s.id),
    ["discover", "search", "track", "home", "profile", "shape", "community"],
  );
  assert.equal(stepsOf("basics"), TOUR_STEPS);
});

test("كلُّ مسارِ خطوةٍ صفحةٌ قائمةٌ في الويب — مسارٌ ميّتٌ ٤٠٤ وسطَ الجولة", () => {
  for (const s of TOUR_STEPS) {
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
      if (s.lead) assert.ok(s.lead(t).length > 0, `${locale}:${s.id}:lead`);
    }
  }
  /* «٧ بطاقات» وعدٌ مكتوبٌ بيد — وخطوةٌ تُضاف أو تُحذف بلا تعديله تجعله كذبة */
  assert.ok(getDict("ar").tourSuggestTitle.includes(TOUR_STEPS.length.toLocaleString("ar-EG")));
  assert.ok(getDict("en").tourSuggestTitle.includes(String(TOUR_STEPS.length)));
});

test("خطوةُ الملفّ وحدَها تحمل نصَّ ما قبل الفعل، والحلقاتُ ثلاثٌ لا رابعة", () => {
  assert.deepEqual(TOUR_STEPS.filter((s) => s.lead).map((s) => s.id), ["profile"]);
  assert.deepEqual(
    TOUR_STEPS.filter((s) => s.anchor).map((s) => `${s.id}:${s.anchor}`),
    ["discover:discover-filter", "search:search-describe", "profile:home-avatar"],
  );
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
