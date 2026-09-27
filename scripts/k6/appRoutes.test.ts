import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { MOBILE, V1, relPath, stripComments, walk } from "./source.ts";

/**
 * ====== K6b — كلُّ مسارٍ يناديه التطبيقُ موجودٌ في الخادم وبالطريقة نفسِها ======
 *
 * **لماذا**: التطبيقُ يُحدَّث عبر الهواء والويبُ يُنشر وحدَه — فمسارٌ أُعيدت تسميتُه أو نُقل في الويب لا يكسر
 * بناءَ أيٍّ منهما، **ويكسر التطبيقَ الذي في جيوب الناس** (`404` صامتٌ يصير شاشةً فارغة). `tsc` يحرس شكلَ
 * الحمولة (`satisfies …Body` من `src/core/contracts`)، ولا شيءَ كان يحرس **العنوان** — هذا يحرسه.
 */

type Call = { path: string; method: "GET" | "POST" | "?"; file: string };

const LITERAL = /(["'])((?:\/api\/v1\/)[^"'`\s]*)\1|`((?:\$\{CONFIG\.apiBase\})?\/api\/v1\/[^`]*)`/g;

function callsIn(file: string): Call[] {
  const src = stripComments(readFileSync(file, "utf8"));
  const out: Call[] = [];
  for (const m of src.matchAll(LITERAL)) {
    const at = m.index ?? 0;
    const before = src.slice(Math.max(0, at - 48), at);
    const after = src.slice(at, at + 260);
    const callee = /(\w+)\s*(?:<[^()]*>)?\s*\(\s*$/.exec(before)?.[1] ?? "";
    let method: Call["method"] = "?";
    if (callee === "write" || callee === "post") method = "POST";
    else if (callee === "api" || callee === "softGet" || callee === "fetch") method = /method:\s*"POST"/.test(after.split("\n").slice(0, 6).join("\n")) ? "POST" : "GET";
    /* `${…}` مقطعٌ ديناميكيّ — يُطوى قبل قطع الاستعلام (`${item?.kind}` فيه «?» ليس استعلاماً) */
    const path = (m[2] ?? m[3]).replace("${CONFIG.apiBase}", "").replace(/\$\{[^}]*\}/g, "${}").split("?")[0];
    out.push({ path, method, file: relPath(file) });
  }
  return out;
}

/** مقطعٌ حرفيّ ⇒ مجلّدُه؛ مقطعٌ من `${…}` ⇒ المجلّدُ الديناميكيُّ `[x]` */
function routeFile(path: string): string | null {
  const segs = path.replace(/^\/api\/v1\/?/, "").split("/").filter(Boolean);
  let dir = V1;
  for (const s of segs) {
    if (s.includes("${")) {
      const dyn = readdirSync(dir).find((n) => n.startsWith("[") && statSync(join(dir, n)).isDirectory());
      if (!dyn) return null;
      dir = join(dir, dyn);
    } else {
      if (!existsSync(join(dir, s))) return null;
      dir = join(dir, s);
    }
  }
  const f = join(dir, "route.ts");
  return existsSync(f) ? f : null;
}

function exported(routeSrc: string): Set<string> {
  const s = new Set<string>();
  for (const m of routeSrc.matchAll(/export\s+(?:async\s+function|const|function)\s+(GET|POST|PUT|PATCH|DELETE)\b/g)) s.add(m[1]);
  for (const m of routeSrc.matchAll(/export\s*\{([^}]*)\}/g)) for (const n of m[1].split(",")) {
    const name = n.trim().split(/\s+as\s+/).pop();
    if (name && /^(GET|POST|PUT|PATCH|DELETE)$/.test(name)) s.add(name);
  }
  return s;
}

const CALLS = [...walk(join(MOBILE, "src")), ...walk(join(MOBILE, "app"))].flatMap(callsIn);

test("التطبيقُ يُنادي مساراتٍ فعلاً (الفاحصُ نفسُه يعمل)", () => {
  assert.ok(CALLS.length >= 60, `وُجد ${CALLS.length} نداءً فقط — تغيّر شكلُ النداء في التطبيق؟`);
  for (const must of ["/api/v1/me/home", "/api/v1/session/mint", "/api/v1/app/flags", "/api/v1/app/perf"]) {
    assert.ok(CALLS.some((c) => c.path === must), `لم يُعثر على ${must}`);
  }
});

test("كلُّ مسارٍ يناديه التطبيقُ له `route.ts` في `src/app/api/v1`", () => {
  const missing = [...new Set(CALLS.filter((c) => !routeFile(c.path)).map((c) => `${c.path}  ← ${c.file}`))];
  assert.deepEqual(missing, [], `مساراتٌ بلا خادم:\n${missing.join("\n")}`);
});

test("والطريقةُ نفسُها: ما يرسله التطبيقُ POST يصدّره المسارُ POST، وGET كذلك", () => {
  const wrong: string[] = [];
  for (const c of CALLS) {
    if (c.method === "?") continue;
    const f = routeFile(c.path);
    if (!f) continue;
    const ex = exported(readFileSync(f, "utf8"));
    if (!ex.has(c.method)) wrong.push(`${c.method} ${c.path} (المسارُ يصدّر ${[...ex].join("/") || "لا شيء"})  ← ${c.file}`);
  }
  assert.deepEqual([...new Set(wrong)], []);
});
