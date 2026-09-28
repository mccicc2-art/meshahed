import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  backFrom,
  doorBack,
  doorLeft,
  homeSeen,
  resetRootsForTest,
  rootsBorn,
  rootsMounted,
} from "../../apps/mobile/src/rootsState.ts";

/**
 * ====== K3a-fix — الرجوعُ عبر الأبواب الويبيّة، على تسلسلِ خالد نفسِه ======
 * العلاماتُ (`nav.back`/`nav.enter`، ٢٨ سبتمبر 02:51–02:52 UTC): البحث ← المجتمع ← «الرئيسيّة» من الشريط ← البحث ←
 * رجوع ← اكتشف ← المجتمع ← رجوع (عاد إلى اكتشف) ← **رجوع (`why=pass`) كشف المجتمعَ** ← رجوع (`why=exit`) خرج.
 * كلُّ خطوةٍ هنا نداءٌ تفعله الشاشاتُ نفسُها بالترتيب نفسِه.
 */
beforeEach(() => resetRootsForTest());

/** إقلاعٌ عاديّ: `web.tsx` يولد المجموعةَ من الإقلاع، والرئيسيّةُ تظهر */
function boot() {
  rootsBorn(true);
  rootsMounted();
  homeSeen();
}

test("تسلسلُ خالد: الرجوعُ من «اكتشف» بعد العودة من «المجتمع» يذهب إلى الرئيسيّة لا إلى الويب", () => {
  boot();
  doorLeft(); /* البحث ← المجتمع (`shell.open` بـ returnTo=search) */
  doorBack(); /* «الرئيسيّة» من الشريط على صفحة المجتمع */
  rootsMounted();
  homeSeen();
  assert.equal(backFrom("/search"), "home");
  doorLeft(); /* اكتشف ← المجتمع */
  doorBack(); /* رجوع ⇐ `goNative("discover")` */
  rootsMounted();
  /* كانت `pass` — نزعت المجموعةَ وكشفت المجتمع، والرجوعُ التالي أخرج من التطبيق */
  assert.equal(backFrom("/discover"), "home");
  homeSeen();
  assert.equal(backFrom("/home"), "exit");
});

test("العودةُ من بابٍ فُتح من الرئيسيّة: رجوعُها خروجٌ كما قبل الباب", () => {
  boot();
  doorLeft();
  doorBack();
  rootsMounted();
  homeSeen();
  assert.equal(backFrom("/home"), "exit");
});

test("صفحةٌ ويبيّةٌ لم تُفتح من جذر: المجموعةُ منها مولودةٌ من الويب كما في K3", () => {
  rootsBorn(false);
  rootsMounted();
  assert.equal(backFrom("/library"), "pass");
  homeSeen();
  assert.equal(backFrom("/library"), "home");
  assert.equal(backFrom("/home"), "pass");
});

test("البابُ يُستهلك مرّةً: عودةٌ ثانيةٌ بلا بابٍ جديد تُعامَل من الويب", () => {
  boot();
  doorLeft();
  doorBack();
  rootsMounted();
  doorBack();
  rootsMounted();
  assert.equal(backFrom("/discover"), "pass");
});

test("مجموعةٌ مولودةٌ من الإقلاع لم تُزر رئيسيّتُها: أخواتُها يرجعن إليها", () => {
  rootsBorn(true);
  rootsMounted();
  assert.equal(backFrom("/library"), "home");
});
