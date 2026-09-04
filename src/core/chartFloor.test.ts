import { test } from "node:test";
import assert from "node:assert/strict";
import { MIN_CHART_VOTES, minChartVotes } from "./chartFloor.ts";

/**
 * ====== عتبةُ الأصوات — الرقمُ المزدوج (`LOOPZ-AUD-0001`) ======
 *
 * 🔑 **ولمَ يستحقّ هذا الملفُّ الصغير اختباراً؟** لأنّ رأسَه يحمل
 * تحذيراً صريحاً: **نظيرُ هذه الأرقام يعيش في جسم دالّةٍ في القاعدة**
 * (الهجرة ١١٥)، **ورقمان في موضعين يفترقان يومَ يغيّر أحدُهما ولا
 * يُغيَّر الآخر** — **وحينها يعرض التطبيقُ جدولاً لا يطابق ما بنته
 * القاعدة، بلا خطأٍ ولا سطرِ سجلّ.**
 *
 * ⚠️ **وهذا الاختبارُ لا يستطيع قراءةَ القاعدة** (لا شبكةَ في مشغّل
 * الاختبارات، وهو قرارٌ لا نقص). **فهو يثبّت الجانبَ الذي يملكه**:
 * أيُّ تغييرٍ في الأرقام هنا يُسقط الاختبار، **فيقف من غيّرها ويسأل
 * نفسَه: هل غيّرتُ الهجرةَ معها؟**
 *
 * 📏 **وقد قُوبلت بالقاعدة الحيّة يوم ٤ سبتمبر ٢٠٢٦**: جسمُ الدالّة
 * يحمل `25000` و`20000` و`10000` — **مطابقةٌ تامّة اليوم.**
 */

test("العتباتُ الثلاث كما هي مقيسةٌ في القاعدة (٤ سبتمبر ٢٠٢٦)", () => {
  assert.equal(MIN_CHART_VOTES.movie, 25_000);
  assert.equal(MIN_CHART_VOTES.tv, 20_000);
  assert.equal(MIN_CHART_VOTES.anime, 10_000);
});

test("الأنمي أدنى عتبةً عمداً — نقضٌ مسجَّلٌ بموافقة المالك (D-382)", () => {
  // العتبةُ تُقاس بالبِركة التي تقف عليها (D-378) — لا رقمٌ واحدٌ للجميع.
  assert.ok(MIN_CHART_VOTES.anime < MIN_CHART_VOTES.tv);
  assert.ok(MIN_CHART_VOTES.tv < MIN_CHART_VOTES.movie);
});

test("minChartVotes يقرأ من الجدول نفسِه — لا نسخةَ ثانية", () => {
  assert.equal(minChartVotes("movie"), MIN_CHART_VOTES.movie);
  assert.equal(minChartVotes("tv"), MIN_CHART_VOTES.tv);
  assert.equal(minChartVotes("anime"), MIN_CHART_VOTES.anime);
});
