import { test } from "node:test";
import assert from "node:assert/strict";
import { pickVivid, posterTone } from "./posterTone.ts";

/** صورةٌ من لونٍ واحد مع نسبةٍ من لونٍ ثانٍ */
function img(main: [number, number, number], other: [number, number, number] = main, share = 0, px = 400): number[] {
  const out: number[] = [];
  for (let i = 0; i < px; i++) out.push(...(i < px * share ? other : main));
  return out;
}

test("ملصقٌ أسودُ بعنوانٍ أحمرَ صغير داكن", () => {
  const tone = posterTone(img([12, 12, 14], [190, 20, 20], 0.15));
  assert.equal(tone.dark, true);
});

test("ملصقٌ ملوّنٌ عاديّ ليس داكناً", () => {
  assert.equal(posterTone(img([230, 120, 40], [40, 90, 200], 0.4)).dark, false);
});

test("الرماديُّ المتوسّط أضعفُ من البرتقاليّ بالإضاءة نفسِها تقريباً", () => {
  assert.ok(posterTone(img([110, 110, 110])).score < posterTone(img([200, 90, 20])).score);
});

test("الصورةُ الفارغة داكنة ولا تنهار", () => {
  assert.equal(posterTone([]).dark, true);
});

test("الحاليُّ غيرُ الداكن يبقى ولو وُجد أوضحُ منه", () => {
  const cur = { path: "/a.jpg", tone: posterTone(img([200, 120, 60])) };
  const alt = { path: "/b.jpg", tone: posterTone(img([255, 200, 40])) };
  assert.deepEqual(pickVivid(cur, [alt]), { path: "/a.jpg", dark: false });
});

test("الداكنُ يُستبدل بأوّل مرشّحٍ ملوّن، والتعادلُ للأسبق في الأولويّة", () => {
  const cur = { path: "/dark.jpg", tone: posterTone(img([10, 10, 10])) };
  const first = { path: "/ar.jpg", tone: posterTone(img([210, 100, 40])) };
  const second = { path: "/en.jpg", tone: posterTone(img([212, 101, 41])) };
  assert.deepEqual(pickVivid(cur, [first, second]), { path: "/ar.jpg", dark: false });
});

test("لا بديلَ صالح ⇒ الحاليُّ مع علامة الداكن", () => {
  const cur = { path: "/dark.jpg", tone: posterTone(img([10, 10, 10])) };
  const alsoDark = { path: "/d2.jpg", tone: posterTone(img([20, 20, 22])) };
  assert.deepEqual(pickVivid(cur, [alsoDark, cur]), { path: "/dark.jpg", dark: true });
});
