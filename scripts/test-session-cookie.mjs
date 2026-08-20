/**
 * اختبارُ انحدارٍ لفكّ كوكي الجلسة (`src/lib/sessionCookie.ts`).
 *
 * التشغيل:  node scripts/test-session-cookie.mjs
 * (يحوّل TS إلى JS عبر esbuild — يُجلب بـnpx عند أوّل تشغيل.)
 *
 * ما يثبته: القرارات في D-508/D-514 — المشوَّهُ يعود null فيسقط
 * المستدعي إلى التحقّق الكامل، والمقسَّمُ يُجمع، والمنتهي يُبلَّغ
 * بـexp ليحكم المستدعي، و«sub المزوَّر» يُفكّ **قيمةً للفلترة لا
 * صلاحيةً** — الصلاحياتُ عند RLS/requireUser وحدها.
 */
import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = join(mkdtempSync(join(tmpdir(), "lz-sc-")), "sessionCookie.mjs");
execSync(
  `npx -y esbuild src/lib/sessionCookie.ts --format=esm --outfile=${out}`,
  { stdio: "pipe" },
);
const { decodeSessionCookie, sessionCookieParts } = await import(
  `file://${out}`
);

const b64u = (s) =>
  Buffer.from(s).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const jwt = (payload) => `${b64u('{"alg":"HS256"}')}.${b64u(JSON.stringify(payload))}.sig`;
const cookieValue = (token) =>
  "base64-" + Buffer.from(JSON.stringify({ access_token: token, refresh_token: "r" })).toString("base64");

let failed = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      got:  ${JSON.stringify(got)}\n      want: ${JSON.stringify(want)}`}`);
};

const SUB = "11111111-2222-3333-4444-555555555555";
const future = Math.floor(Date.now() / 1000) + 3600;
const past = Math.floor(Date.now() / 1000) - 3600;

// ١ — كوكي سليم بجزء واحد
check("valid single-part cookie", decodeSessionCookie([cookieValue(jwt({ sub: SUB, exp: future }))]), { sub: SUB, exp: future });

// ٢ — كوكي مقسَّم .0/.1 (تقسيم Supabase) يُجمع بالترتيب
{
  const v = cookieValue(jwt({ sub: SUB, exp: future }));
  const mid = Math.floor(v.length / 2);
  const all = [
    { name: "sb-ref-auth-token.1", value: v.slice(mid) },
    { name: "sb-ref-auth-token.0", value: v.slice(0, mid) },
    { name: "sb-ref-auth-token-code-verifier", value: "x" }, // يُستبعد
    { name: "theme", value: "daylight" }, // يُستبعد
  ];
  check("chunked cookie parts reassemble in order", decodeSessionCookie(sessionCookieParts(all)), { sub: SUB, exp: future });
}

// ٣ — JSON عارٍ بلا بادئة base64-
check("plain-JSON cookie (no base64- prefix)", decodeSessionCookie([JSON.stringify({ access_token: jwt({ sub: SUB, exp: future }) })]), { sub: SUB, exp: future });

// ٤ — المنتهي يُفكّ وexp يُبلَّغ — والحكمُ (السقوط إلى getUser) عند المستدعي
check("expired JWT decodes with its past exp", decodeSessionCookie([cookieValue(jwt({ sub: SUB, exp: past }))]), { sub: SUB, exp: past });

// ٥ — بلا exp: تعود null في exp فيرفضها getUserId (لا استعلام بتوكن مجهول العمر)
check("missing exp reported as null", decodeSessionCookie([cookieValue(jwt({ sub: SUB }))]), { sub: SUB, exp: null });

// ٦ → ١٠ — المشوَّه بكل صوره يعود null (فيسقط المستدعي للتحقّق الكامل)
check("garbage cookie -> null", decodeSessionCookie(["not-json-at-all"]), null);
check("base64- of garbage -> null", decodeSessionCookie(["base64-" + Buffer.from("häh").toString("base64")]), null);
check("no access_token -> null", decodeSessionCookie([JSON.stringify({ refresh_token: "r" })]), null);
check("token with 2 segments -> null", decodeSessionCookie([JSON.stringify({ access_token: "a.b" })]), null);
check("payload not JSON -> null", decodeSessionCookie([JSON.stringify({ access_token: `x.${b64u("not json")}.y` })]), null);
check("empty/whitespace sub -> null", decodeSessionCookie([cookieValue(jwt({ sub: "", exp: future }))]), null);
check("empty parts -> null", decodeSessionCookie([]), null);

// ١١ — حمولة بحروف غير لاتينية لا تشوّه الفكّ (TextDecoder لا atob وحدها)
check("unicode claims survive decoding", decodeSessionCookie([cookieValue(jwt({ sub: SUB, exp: future, name: "أحمد الحربي" }))]), { sub: SUB, exp: future });

// ١٢ — sub «مزوَّر»: يُفكّ كقيمة — **وليس صلاحية**. الاستعلام يُفلتر به
// وRLS يفلتر بالتوكن الموقَّع؛ تزويرُ sub مع توكن حسابٍ آخر = تقاطعٌ صفر صفوف.
check("forged sub decodes as a value (never an authorization)", decodeSessionCookie([cookieValue(jwt({ sub: "attacker-chosen", exp: future }))]), { sub: "attacker-chosen", exp: future });

console.log(failed === 0 ? "\nALL PASS" : `\n${failed} FAILURES`);
process.exit(failed === 0 ? 0 : 1);
