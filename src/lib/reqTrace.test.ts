import { test, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { gauge, op, routeName, stage, traced, tracedFetch } from "./reqTrace.ts";

/* ساعةٌ ومؤقّتاتٌ مزيّفة: السطرُ يُكتب عند ١٠ث و٦٠ث و٢٤٠ث، ولا اختبارَ ينتظرها فعلاً */
let lines: string[] = [];
const realWarn = console.warn;
beforeEach(() => {
  lines = [];
  console.warn = (...a: unknown[]) => void lines.push(a.join(" "));
  mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1_000_000 });
});
afterEach(() => {
  mock.timers.reset();
  console.warn = realWarn;
});
/** وعدٌ يُفتح باليد — «نداءٌ عالق» */
function held<T = void>() {
  let release!: (v: T) => void;
  const p = new Promise<T>((r) => (release = r));
  return { p, release };
}
const settle = () => new Promise<void>((r) => setImmediate(r));

test("خارج طلبٍ متتبَّع: لا شيءَ يُسجَّل ولا شيءَ يُرمى", () => {
  const end = op("x");
  end();
  end();
  routeName("y");
  stage("z");
  assert.equal(lines.length, 0);
});

test("`traced` تعيد قيمةَ المعالج وترمي ما يرميه — والطلبُ السريع لا يكتب سطراً", async () => {
  assert.equal(await traced(async () => 7), 7);
  await assert.rejects(traced(async () => Promise.reject(new Error("boom"))), /boom/);
  mock.timers.tick(300_000);
  assert.equal(lines.length, 0);
});

test("طلبٌ عالق: سطرٌ عند ١٠ث يسمّي المرحلةَ والنداءَ المفتوح وعمرَه، ثمّ ٦٠ث و٢٤٠ث، ثمّ سطرُ الختام", async () => {
  const stuck = held();
  const p = traced(async () => {
    routeName("discover/lists");
    stage("db-stats");
    const quick = op("sb POST /rest/v1/rpc/curated_list_counts");
    quick();
    stage("franchises");
    const end = op("tmdb fetch /search/movie ar-SA #1");
    await stuck.p;
    end();
    return "ok";
  });
  mock.timers.tick(10_000);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^\[slow\] r=discover\/lists age=10000 stage=franchises\+10000 ops=2\/1 inst=\w+ up=-?\d+s act=1/);
  assert.match(lines[0], /open=\[tmdb fetch \/search\/movie ar-SA #1 \+10000\]$/);
  mock.timers.tick(50_000);
  mock.timers.tick(180_000);
  assert.equal(lines.length, 3);
  assert.match(lines[2], /age=240000 .*open=\[tmdb fetch \/search\/movie ar-SA #1 \+240000\]$/);
  stuck.release();
  assert.equal(await p, "ok");
  assert.match(lines[3], /^\[slow-done\] r=discover\/lists ms=240000 ops=2\/2 inst=\w+$/);
});

test("طلبان متزامنان: كلُّ سطرٍ يحمل نداءَ طلبه وحدَه", async () => {
  const a = held();
  const b = held();
  const run = (name: string, h: { p: Promise<void> }) =>
    traced(async () => {
      routeName(name);
      const end = op(`call-${name}`);
      await h.p;
      end();
    });
  const pa = run("a", a);
  const pb = run("b", b);
  mock.timers.tick(10_000);
  assert.equal(lines.length, 2);
  const la = lines.find((l) => l.includes("r=a "))!;
  const lb = lines.find((l) => l.includes("r=b "))!;
  assert.match(la, /act=2/);
  assert.match(la, /open=\[call-a \+10000\]$/);
  assert.match(lb, /open=\[call-b \+10000\]$/);
  a.release();
  b.release();
  await Promise.all([pa, pb]);
});

test("نداءاتٌ كثيرةٌ مفتوحة: الأقدمُ أوّلاً، والباقي عددٌ، والسطرُ لا يتجاوز حدَّه", async () => {
  const stuck = held();
  const p = traced(async () => {
    const ends = Array.from({ length: 40 }, (_, i) => {
      mock.timers.tick(1);
      return op(`tmdb fetch /movie/${i} en-US #1 ${"x".repeat(60)}`);
    });
    await stuck.p;
    for (const e of ends) e();
  });
  mock.timers.tick(10_000);
  assert.match(lines[0], /open=\[tmdb fetch \/movie\/0 /);
  assert.ok(lines[0].length <= 1901, `line is ${lines[0].length} chars`);
  stuck.release();
  await p;
});

test("`tracedFetch`: الوعدُ نفسُه، والتسميةُ مضيفٌ ومسارٌ بلا استعلام (لا مفتاحَ ولا نصَّ بحث)", async () => {
  const realFetch = globalThis.fetch;
  const reply = held<Response>();
  let calledWith = "";
  globalThis.fetch = ((input: string) => {
    calledWith = input;
    return reply.p;
  }) as typeof fetch;
  try {
    const p = traced(async () => {
      const res = await tracedFetch("https://api.example.org/3/search/movie?api_key=SECRET&query=private+words", { method: "post" });
      return res.status;
    });
    await settle();
    mock.timers.tick(10_000);
    assert.match(lines[0], /open=\[api\.example\.org POST \/3\/search\/movie \+10000\]$/);
    assert.doesNotMatch(lines[0], /SECRET|private/);
    assert.match(calledWith, /api_key=SECRET/);
    reply.release(new Response("{}", { status: 201 }));
    assert.equal(await p, 201);
    assert.match(lines[1], /^\[slow-done\] .* ops=1\/1 /);
    /* والفشلُ يمرّ كما هو ويُغلق النداء */
    globalThis.fetch = (() => Promise.reject(new Error("net down"))) as typeof fetch;
    await assert.rejects(traced(async () => tracedFetch("https://api.example.org/x")), /net down/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("`gauge`: رقمُ طبقةٍ أخرى يُكتب في السطر، وقارئٌ يرمي لا يكسره", async () => {
  gauge("tmdbShared", () => "3/9100");
  gauge("broken", () => {
    throw new Error("x");
  });
  const stuck = held();
  const p = traced(async () => {
    const end = op("held");
    await stuck.p;
    end();
  });
  mock.timers.tick(10_000);
  assert.match(lines[0], / tmdbShared=3\/9100 /);
  assert.match(lines[0], /open=\[held \+10000\]$/);
  stuck.release();
  await p;
});
