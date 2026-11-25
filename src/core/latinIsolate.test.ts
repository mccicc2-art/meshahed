import { test } from "node:test";
import assert from "node:assert/strict";
import { isolateLatinText } from "./latinIsolate.ts";

const FSI = "⁨";
const PDI = "⁩";

/* لقطةُ أحمد ٢٥ نوفمبر: الاسمُ اللاتينيُّ ينفصل عن سعره في السطر العربيّ — يُعزل الاسمُ وحده والرقمُ يبقى خارجه */
test("الاسم اللاتيني يُعزل والسعر يبقى خارجه", () => {
  assert.equal(isolateLatinText("Plus 99.99 ريالاً"), `${FSI}Plus${PDI} 99.99 ريالاً`);
  assert.equal(isolateLatinText("وLoopz Gold (سنويّ فقط)"), `و${FSI}Loopz Gold${PDI} (سنويّ فقط)`);
  assert.equal(isolateLatinText("من App Store أو Google Play"), `من ${FSI}App Store${PDI} أو ${FSI}Google Play${PDI}`);
});

test("البريد والرابط يُعزلان كاملين", () => {
  assert.equal(isolateLatinText("راسلنا info@loopztv.com"), `راسلنا ${FSI}info@loopztv.com${PDI}`);
  assert.equal(isolateLatinText("الرابط loopztv.com/terms."), `الرابط ${FSI}loopztv.com/terms${PDI}.`);
});

test("النصّ العربيّ الخالص لا يتغيّر", () => {
  assert.equal(isolateLatinText("المتابعة مجانية ١٠ مرات"), "المتابعة مجانية ١٠ مرات");
});
