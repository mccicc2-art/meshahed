import { test } from "node:test";
import assert from "node:assert/strict";
import { read, stripComments } from "./source.ts";

/**
 * ====== K6b — العلامةُ التي يرسلها التطبيقُ يقبلها الخادم ======
 *
 * **لماذا**: الخادمُ **يُسقط الاسمَ المجهول والمفتاحَ المجهول بصمت** (`/api/v1/app/perf`) — عمداً، كي لا
 * يُكتب في `runtime_errors` ما لم يُقرّ. فعلامةٌ تُضاف في مكانٍ وتُنسى في الآخر لا تكسر شيئاً **ولا تصل**،
 * ويُقرأ غيابُها «لم يحدث». هذا الفخُّ مكتوبٌ في `19` منذ D-1152؛ هنا يصير اختباراً.
 */

const APP = stripComments(read("apps/mobile/src/perfMarks.ts"));
const SERVER = stripComments(read("src/app/api/v1/app/perf/route.ts"));

function union(src: string, typeName: string): Set<string> {
  const m = new RegExp(`type\\s+${typeName}\\s*=([^;]*);`).exec(src);
  assert.ok(m, `لم يُعثر على ${typeName}`);
  return new Set([...m[1].matchAll(/"([\w.]+)"/g)].map((x) => x[1]));
}

function set(src: string, constName: string): Set<string> {
  const m = new RegExp(`const\\s+${constName}\\s*=\\s*new Set\\(\\[([\\s\\S]*?)\\]\\)`).exec(src);
  assert.ok(m, `لم يُعثر على ${constName}`);
  return new Set([...m[1].matchAll(/"([\w.]+)"/g)].map((x) => x[1]));
}

const sorted = (s: Set<string>) => [...s].sort();

test("أسماءُ العلامات في التطبيق = أسماؤها في الخادم (لا زائدَ ولا ناقص)", () => {
  const app = union(APP, "PerfName");
  const server = set(SERVER, "NAMES");
  assert.ok(app.size >= 20);
  assert.deepEqual(sorted(app), sorted(server));
});

test("كلُّ مفتاحٍ في `extra` يرسله التطبيقُ مقبولٌ في `EXTRA_KEYS`", () => {
  const allowed = set(SERVER, "EXTRA_KEYS");
  const used = new Set<string>();
  const files = [
    "apps/mobile/src/perfMarks.ts",
    "apps/mobile/app/web.tsx",
    "apps/mobile/src/WebLayer.tsx",
    "apps/mobile/src/TabSlide.tsx",
    "apps/mobile/src/title/TitleScreen.tsx",
    "apps/mobile/src/title/SeasonAccordion.tsx",
  ];
  for (const f of files) {
    const src = stripComments(read(f));
    /* `mark("name", ms, { k: … })` — الكائنُ الحرفيُّ وما في داخله من كائناتٍ شرطيّة (`...(k ? { tab: k } : {})`) */
    for (const m of src.matchAll(/\bmark\(\s*"[\w.]+"[^;]*?\{([^;]*)\}\s*\)/g)) {
      for (const k of m[1].matchAll(/[{,]\s*([A-Za-z_]\w*)\s*:/g)) used.add(k[1]);
    }
  }
  /* وما يمرّ عبر مستمعين (`own.onEvent` · `session.onWait`) مفاتيحُه في أنواعها */
  for (const [f, t] of [["apps/mobile/src/ownSession.ts", "EventExtra"]] as const) {
    const m = new RegExp(`type\\s+${t}\\s*=\\s*\\{([^}]*)\\}`).exec(stripComments(read(f)));
    assert.ok(m, `لم يُعثر على ${t}`);
    for (const k of m[1].matchAll(/(\w+)\??\s*:/g)) used.add(k[1]);
  }
  assert.ok(used.has("result") && used.has("src"), "الفاحصُ لم يرَ مفاتيحَ الدخول");
  const rejected = [...used].filter((k) => !allowed.has(k));
  assert.deepEqual(rejected, [], `مفاتيحُ يُسقطها الخادم: ${rejected.join(", ")}`);
});
