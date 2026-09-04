import { test } from "node:test";
import assert from "node:assert/strict";
import {
  asPlan,
  isPlus,
  isPartner,
  isVerified,
  isFounder,
  themeNeedsPlus,
  FREE_THEMES,
} from "./plan.ts";

/**
 * ====== أوّلُ اختباراتٍ في المستودع (`LOOPZ-AUD-0001`) ======
 *
 * **ولمَ `plan.ts` أوّلاً وليس أيَّ ملفٍّ آخر؟** لأنّه **قاعدةُ صلاحيّةٍ
 * تُقرأ في كلِّ صفحة**، **ولأنّ عطلاً حيّاً وُلد منه فعلاً**: قبل D-773
 * كان العرضُ العامّ لا يمرّر `plus_until`، **فيُقرأ الغيابُ «بلا انتهاء»
 * فيرى الناسُ شارةَ بلس على مشتركٍ انتهى اشتراكُه أمس** بينما يراها
 * صاحبُها مطفأة. **العطلُ كان في قراءةِ الغياب، وهذه الحالةُ مثبَّتةٌ
 * أدناه بالاسم** — فلا تعود بصمت.
 *
 * 🔑 **وبلا حزمةٍ واحدةٍ جديدة**: مشغّلُ Node نفسُه (`node --test`) يقرأ
 * TypeScript بنزع الأنواع — **فلا `package-lock` يتضخّم ولا سطحُ تبعيّاتٍ
 * يتّسع لأجل اختبار.** (وهذا موقفٌ مقصود: `0069` أثبت أنّ كلَّ حزمةٍ
 * تُضاف دَينٌ يُدفع في كلِّ تدقيقٍ لاحق.)
 *
 * ⚠️ **والأنواعُ لا تُفحص هنا** — `tsc --noEmit` بوّابةٌ قائمةٌ أصلاً،
 * وهذه تفحص **السلوك** وحدَه.
 */

test("asPlan: قيمةٌ مجهولة تسقط إلى free — لا تُصدَّق كما جاءت", () => {
  assert.equal(asPlan("plus"), "plus");
  assert.equal(asPlan("partner"), "partner");
  assert.equal(asPlan("free"), "free");
  assert.equal(asPlan("PLUS"), "free");
  assert.equal(asPlan("admin"), "free");
  assert.equal(asPlan(null), "free");
  assert.equal(asPlan(undefined), "free");
  assert.equal(asPlan(7), "free");
});

test("isPlus: الخطّةُ المجّانيّة لا تصير بلس مهما كان التاريخ", () => {
  assert.equal(isPlus({ plan: "free" }), false);
  assert.equal(isPlus({ plan: "free", plus_until: "2099-01-01T00:00:00Z" }), false);
});

test("isPlus: تاريخٌ غائب = بلا انتهاء (المؤسِّس والمشترِك القائم)", () => {
  assert.equal(isPlus({ plan: "plus" }), true);
  assert.equal(isPlus({ plan: "plus", plus_until: null }), true);
});

test("isPlus: التاريخُ الماضي يُسقط المزايا عند القراءة لا بهجرةٍ ليليّة", () => {
  assert.equal(isPlus({ plan: "plus", plus_until: "2020-01-01T00:00:00Z" }), false);
  assert.equal(isPlus({ plan: "plus", plus_until: "2099-01-01T00:00:00Z" }), true);
});

test("isPlus: تاريخٌ غيرُ صالحٍ لا يقطع الميزة — يُقرأ «بلا انتهاء»", () => {
  // **قرارٌ مقصود**: نصٌّ تالفٌ في عمودٍ لا يجوز أن يطفئ اشتراكاً مدفوعاً.
  assert.equal(isPlus({ plan: "plus", plus_until: "not-a-date" }), true);
});

test("isPlus: لا حامل = لا مزايا", () => {
  assert.equal(isPlus(null), false);
  assert.equal(isPlus(undefined), false);
});

test("isPartner: البارتنر يشترط بلس ساريةً — والترتيبُ هو ما يمنع اجتماعَهما", () => {
  assert.equal(isPartner({ plan: "partner" }), true);
  assert.equal(isPartner({ plan: "partner", plus_until: "2020-01-01T00:00:00Z" }), false);
  assert.equal(isPartner({ plan: "plus" }), false);
  assert.equal(isPartner({ plan: "free" }), false);
});

test("isVerified: صفةٌ مستقلّةٌ عن الخطّة — مجّانيٌّ موثَّقٌ حالةٌ صحيحة", () => {
  // حكمُ أحمد: «التوثيقُ لا يُباع ولا يأتي تلقائيّاً مع Plus».
  assert.equal(isVerified({ plan: "free", verified_at: "2026-08-29T00:00:00Z" }), true);
  assert.equal(isVerified({ plan: "partner" }), false);
  assert.equal(isVerified({ plan: "plus", verified_at: null }), false);
  assert.equal(isVerified({ plan: "plus", verified_at: "" }), false);
});

test("isFounder: صفةٌ لا خطّة — وتبقى بعد أيِّ تبدّلٍ في الاشتراك", () => {
  assert.equal(isFounder({ plan: "free", founder: true }), true);
  assert.equal(isFounder({ plan: "plus", founder: false }), false);
  assert.equal(isFounder({ plan: "plus" }), false);
});

test("الثيماتُ المجّانيّة اثنتان فقط: الافتراضيُّ ووضعُ النهار", () => {
  // **`daylight` إتاحةٌ لا زينة** — من يقرأ في الشمس قارئٌ محبوس لا مشترٍ محتمل.
  assert.deepEqual([...FREE_THEMES].sort(), ["amber", "daylight"]);
  assert.equal(themeNeedsPlus("amber"), false);
  assert.equal(themeNeedsPlus("daylight"), false);
  assert.equal(themeNeedsPlus("midnight"), true);
});
