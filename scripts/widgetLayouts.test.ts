import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * ودجتُ أندرويد يُرسم بـ RemoteViews داخل الشاشة الرئيسيّة لا داخل تطبيقنا، وهي لا تقبل إلّا قائمةً
 * مغلقةً من العناصر. عنصرٌ واحدٌ خارجها (كـ `<View>` فاصلاً) يُسقط الودجتَ كلَّه برسالة
 * «تعذّرت إضافة تطبيق مصغّر» — ولا يظهر ذلك في `tsc` ولا في البناء، بل على الجوال وحدَه (١٣ أكتوبر).
 * فهذا الفحصُ يمسك العنصرَ قبل أن يصل إلى بناء.
 */
const LAYOUTS = join(import.meta.dirname, "..", "apps", "mobile", "widget", "res", "layout");

/* ما تقبله RemoteViews على كلّ إصدارٍ ندعمه — عناصرُ API 31 (CheckBox…) خارجها عمداً */
const ALLOWED = new Set([
  "FrameLayout",
  "LinearLayout",
  "RelativeLayout",
  "GridLayout",
  "AnalogClock",
  "Button",
  "Chronometer",
  "ImageButton",
  "ImageView",
  "ProgressBar",
  "TextView",
  "ViewFlipper",
  "ListView",
  "GridView",
  "StackView",
  "AdapterViewFlipper",
  "ViewStub",
  "TextClock",
  "merge",
  "include",
]);

test("واجهاتُ الودجت لا تستعمل إلّا عناصرَ تقبلها RemoteViews", () => {
  const files = readdirSync(LAYOUTS).filter((f) => f.endsWith(".xml"));
  assert.ok(files.length > 0, "لا واجهات — تغيّر المسار؟");
  const bad: string[] = [];
  for (const f of files) {
    const xml = readFileSync(join(LAYOUTS, f), "utf8").replace(/<!--[\s\S]*?-->/g, "");
    for (const m of xml.matchAll(/<([A-Za-z][\w.]*)[\s/>]/g)) {
      if (!ALLOWED.has(m[1])) bad.push(`${f}: <${m[1]}>`);
    }
  }
  assert.deepEqual(bad, []);
});
