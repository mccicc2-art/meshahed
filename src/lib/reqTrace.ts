import { AsyncLocalStorage } from "node:async_hooks";

/**
 * ====== أثرُ الطلب البطيء — D-1336 ======
 *
 * **لماذا**: طلباتُ `/api/v1/discover/lists` و`/api/v1/me/home` تعلّق حتى يقطعها Vercel عند ٣٠٠ ثانية (٩ و١٠ أكتوبر
 * ٢٠٢٦، حسابان وجهازان)، وكلُّ ما في السجلّ سطرٌ واحد: «Task timed out after 300 seconds». سجلُّ قاعدة البيانات
 * أثبت أنّ مرحلتها تنتهي في أقلَّ من ثانية، وستُّ تجاربَ محلّيّة (مصدرٌ لا يردّ · يردّ نصفَ ردّ · يردّ ببطء — كلٌّ
 * منها مع عميلٍ يقطع اتّصالَه ومن دونه) لم تُعد التعليق. **فالنداءُ العالقُ لا يُعرف إلّا من داخل الإنتاج** —
 * وأحمد: «ما أبغى استنتاجات».
 *
 * 🔑 **قياسٌ لا إصلاح**: لا يغيّر ردّاً ولا مهلةً ولا ترتيباً. طلبٌ يتجاوز ١٠ث يكتب سطراً واحداً (ثمّ عند ٦٠ث
 * و٢٤٠ث — الأخيرُ قبل القطع بدقيقة): في أيِّ مرحلةٍ هو، وكم نداءً فتح وكم أُغلق، **وأيُّ النداءات ما زال مفتوحاً
 * وعمرُ كلٍّ منها**. الطلبُ السليم لا يكتب شيئاً ولا يدفع إلّا مؤقّتاً واحداً يُلغى.
 *
 * 🔑 **السياقُ من `AsyncLocalStorage`**: الطبقاتُ السفلى (`tmdb.ts`، عميلُ القاعدة) تسجّل نداءها بـ`op()` ولا تعرف
 * أيَّ مسارٍ ناداها — فلا يُمرَّر شيءٌ عبر ١٦٤ دالّة. خارج طلبِ `/api/v1` (صفحةٌ تُرسم، مهمّةٌ مجدولة) `op()` لا
 * تفعل شيئاً.
 *
 * ⚖️ **صفرُ هويّةٍ وصفرُ سرّ**: التسمياتُ اسمُ مضيفٍ ومسار — **الاستعلامُ يُحذف دائماً** (فيه مفتاحُ TMDB ونصُّ
 * البحث). لا معرّفَ مستخدمٍ ولا عنوان.
 *
 * ⚖️ **والفشلُ صمت**: بابُ تشخيصٍ يرمي استثناءً يضيف عطلاً إلى العطل (درسُ `instrumentation.ts`).
 */
const MARKS_MS = [10_000, 60_000, 240_000];
const OPEN_SHOWN = 12;
const LINE_MAX = 1900;

type Op = { label: string; t0: number };
export type Trace = {
  route: string;
  t0: number;
  ops: Map<number, Op>;
  /** كم نداءً بدأ وكم انتهى — الفرقُ هو المفتوح */
  seq: number;
  done: number;
  stage: string;
  stageAt: number;
  slow: boolean;
};

const als = new AsyncLocalStorage<Trace>();
/** هويّةُ نسخة الدالّة — عشوائيّةٌ لكلِّ تحميل: تقول هل الطلباتُ العالقةُ كلُّها في نسخةٍ واحدة */
const INSTANCE = Math.random().toString(36).slice(2, 8);
const BOOT = Date.now();
const active = new Set<Trace>();
const gauges = new Map<string, () => string>();

/** رقمٌ حيٌّ من طبقةٍ أخرى يُكتب مع كلِّ سطر (مثل عدد نداءات TMDB المشتركة العالقة) */
export function gauge(name: string, read: () => string) {
  gauges.set(name, read);
}

/** اسمُ المسار كما يُقرأ في السجلّ — يُنادى أوّلَ المعالج */
export function routeName(name: string) {
  const t = als.getStore();
  if (t) t.route = name;
}

/** المرحلةُ التي دخلها الطلبُ الآن */
export function stage(name: string) {
  const t = als.getStore();
  if (!t) return;
  t.stage = name;
  t.stageAt = Date.now();
}

const NOOP = () => {};
/** نداءٌ بدأ — تُعاد دالّةُ إغلاقه (تُنادى مرّةً، والثانيةُ لا تفعل شيئاً) */
export function op(label: string): () => void {
  const t = als.getStore();
  if (!t) return NOOP;
  const id = ++t.seq;
  t.ops.set(id, { label, t0: Date.now() });
  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    t.ops.delete(id);
    t.done += 1;
  };
}

/** السطرُ المكتوب — مُصدَّرٌ للاختبار */
export function describe(t: Trace, now: number): string {
  const open = [...t.ops.values()].sort((a, b) => a.t0 - b.t0);
  const shown = open.slice(0, OPEN_SHOWN).map((o) => `${o.label} +${now - o.t0}`);
  const more = open.length > OPEN_SHOWN ? ` (+${open.length - OPEN_SHOWN} more)` : "";
  const g = [...gauges].map(([k, read]) => {
    try {
      return ` ${k}=${read()}`;
    } catch {
      return "";
    }
  });
  const line =
    `[slow] r=${t.route} age=${now - t.t0} stage=${t.stage}+${now - t.stageAt} ops=${t.seq}/${t.done}` +
    ` inst=${INSTANCE} up=${Math.round((now - BOOT) / 1000)}s act=${active.size}${g.join("")}` +
    ` open=[${shown.join("; ")}]${more}`;
  return line.length > LINE_MAX ? `${line.slice(0, LINE_MAX)}…` : line;
}

/** يشغّل معالجَ مسارٍ تحت الأثر. لا يغيّر ما يعيده ولا ما يرميه. */
export async function traced<T>(fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const t: Trace = { route: "v1", t0: now, ops: new Map(), seq: 0, done: 0, stage: "start", stageAt: now, slow: false };
  const timers = MARKS_MS.map((ms) => {
    const h = setTimeout(() => {
      t.slow = true;
      try {
        console.warn(describe(t, Date.now()));
      } catch {
        /* لا شيء */
      }
    }, ms);
    /* المؤقّتُ لا يُبقي نسخةَ الدالّة حيّةً لأجله */
    (h as { unref?: () => void }).unref?.();
    return h;
  });
  active.add(t);
  try {
    return await als.run(t, fn);
  } finally {
    for (const h of timers) clearTimeout(h);
    active.delete(t);
    if (t.slow) {
      try {
        console.warn(`[slow-done] r=${t.route} ms=${Date.now() - t.t0} ops=${t.seq}/${t.done} inst=${INSTANCE}`);
      } catch {
        /* لا شيء */
      }
    }
  }
}

/** مضيفٌ ومسارٌ بلا استعلام — عنوانُ القاعدة يُختصر `sb` */
function fetchLabel(input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): string {
  try {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const u = new URL(raw);
    const method = (init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET")).toUpperCase();
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const host = base && raw.startsWith(base) ? "sb" : u.hostname;
    return `${host} ${method} ${u.pathname}`;
  } catch {
    return "fetch ?";
  }
}

/**
 * `fetch` نفسُها، ونداؤها مسجَّلٌ في أثر الطلب من الإرسال إلى وصول الرأس. الوعدُ المُعاد هو وعدُ `fetch` بعينه —
 * لا يتغيّر نجاحٌ ولا فشل.
 */
export const tracedFetch: typeof fetch = (input, init) => {
  const end = op(fetchLabel(input, init));
  let p: Promise<Response>;
  try {
    p = fetch(input, init);
  } catch (e) {
    end();
    throw e;
  }
  p.then(end, end);
  return p;
};
