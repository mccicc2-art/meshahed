import * as SecureStore from "expo-secure-store";
import { CONFIG } from "./config";
import { flag } from "./flags";

/**
 * ====== الجلسةُ المملوكة — التطبيقُ يجدّد رمزَه بنفسه (Phase 11-K · K4b) ======
 *
 * **لماذا**: الرمزُ كان يُستعار من الـWebView عبر جسر (`session.ts`)، والجسرُ لا يُجاب والشاشاتُ الأصليّةُ
 * فوقه — `react-native-screens` ينزع الويب من العرض (D-1144)، فصفرُ رموزٍ على جهاز خالد يوماً كاملاً،
 * ولا إسعافَ للجسر يصلح (D-1146 نُقض، D-1147 يُصيب أحياناً). هنا يملك التطبيقُ **جلسةً ثانيةً للمستخدم
 * نفسِه** يسكّها الخادمُ مرّةً (`/api/v1/session/mint`) من أوّل رمزٍ يصل عبر الجسر، ثمّ يجدّدها بنفسه.
 *
 * 🔑 **عائلتان من رموز التجديد لا تلتقيان**: جلسةُ الويب في كوكيها، وهذه في SecureStore — كلٌّ يدوّر
 * رمزَه وحدَه، **فعطلُ ٧ سبتمبر** (عميلان يدوّران رمزاً واحداً — `refresh_token_already_used`، D-932)
 * **لا يعود بالتصميم**. والتجديدُ `fetch` خامٌّ إلى `/auth/v1/token` لا عميلُ supabase-js: عميلُ `auth.tsx`
 * مضبوطٌ ألّا يحفظ ولا يجدّد (D-922)، وعميلٌ ثانٍ مخزَّنٌ في الذاكرة هو ما نتجنّبه.
 *
 * 🔒 **ما يُحفظ**: رمزُ التجديد ومعرّفُ صاحبه فقط، في SecureStore (مشفَّرٌ بمفتاح الجهاز). رمزُ الوصول في
 * الذاكرة وحدَها كما كان (B1 §٢.٢-ب). **ولا يُرسل أيٌّ منهما في علامة أداءٍ أو `console`.**
 *
 * 🔑 **الخروج**: الويبُ يخرج بـ`signOut()` الافتراضيّ = `global` ⇒ Supabase يُبطل هذه الجلسةَ أيضاً ⇒ أوّلُ
 * تجديدٍ يُرفض فتُمسح هنا. و`session:clear` من الصفحة يمسحها فوراً (`session.signOut`). **ولا نداءَ خروجٍ
 * من هنا أبداً** — مسحٌ محلّيٌّ فقط، فلا يُخرج التطبيقُ أحداً من الويب بخطأٍ منه.
 *
 * ⚖️ **خلف مفتاح `k4`** (`/api/v1/app/flags`): مطفأٌ ⇒ هذا الملفُّ لا يفعل شيئاً والجسرُ كما كان حرفيّاً.
 */

const KEY = "loopz.own.v1";
/** قبل انتهاء الرمز بهذا يُعدّ شائخاً (كـ`session.get()`) */
const SKEW_MS = 30_000;
const TIMEOUT_MS = 8_000;
/** سكٌّ فشل لا يُعاد قبل هذا — الخادمُ يحدّ بستٍّ في الساعة، والفشلُ غالباً لا يزول في دقيقة */
const MINT_BACKOFF_MS = 10 * 60_000;

type Stored = { rt: string; uid: string };
type Why = string;
type EventName = "session.mint" | "session.renew";
/** من أين جاء رمزُ السكّ: الجسر · كوكي الويب · 🆕 K6a رمزُ الدخول نفسُه (كان يُوسَم `bridge` فيختلط بالجسر) */
type Src = "bridge" | "cookie" | "login";
type EventExtra = { result: "ok" | "none"; why?: Why; src?: Src };

let access: string | null = null;
let exp = 0; // ثوانٍ منذ الحقبة
/** `undefined` = لم يُقرأ بعد؛ `null` = لا جلسة */
let stored: Stored | null | undefined;
let renewing: Promise<string | null> | null = null;
let minting: Promise<void> | null = null;
let mintFailedAt = 0;

const changeListeners = new Set<() => void>();
const eventListeners = new Set<(name: EventName, ms: number, extra: EventExtra) => void>();

function report(name: EventName, t0: number, extra: EventExtra) {
  for (const l of eventListeners) l(name, Date.now() - t0, extra);
}
function changed() {
  for (const l of changeListeners) l();
}

function readStored(): Stored | null {
  if (stored !== undefined) return stored;
  try {
    const raw = SecureStore.getItem(KEY);
    const p = raw ? (JSON.parse(raw) as Partial<Stored> | null) : null;
    stored = p && typeof p.rt === "string" && p.rt && typeof p.uid === "string" && p.uid ? { rt: p.rt, uid: p.uid } : null;
  } catch {
    stored = null;
  }
  return stored;
}

function writeStored(s: Stored | null) {
  stored = s;
  try {
    if (s) SecureStore.setItem(KEY, JSON.stringify(s));
    else SecureStore.deleteItemAsync(KEY).catch(() => {});
  } catch {
    /* المخزنُ تعذّر: الجلسةُ تعيش في الذاكرة حتى الإغلاق، ثمّ يُسكّ غيرُها — لا أسوأ من اليوم */
  }
}

/**
 * صاحبُ الرمز (`sub`) — فكٌّ محلّيٌّ للمقارنة وحدَها، لا تحقّق (التحقّقُ عند الخادم). **بفكِّ base64 مكتوبٍ هنا**
 * لا `atob`: وجودُه في Hermes غيرُ مضمونٍ على كلِّ إصدار، وغيابُه كان سيُطفئ السكَّ بصمت. الحمولةُ تُقرأ بايتاتٍ
 * (الأسماءُ العربيّة في `user_metadata` تفسد نصَّها لا بنيتَها — بايتاتُ UTF-8 المتعدّدة ≥0x80 فلا تكون علامةَ
 * تنصيصٍ ولا شرطةً مائلة)، و`sub` معرّفٌ لاتينيّ.
 */
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
function b64urlToLatin1(s: string): string | null {
  let out = "";
  let buf = 0;
  let bits = 0;
  for (const ch of s) {
    const v = B64.indexOf(ch);
    if (v < 0) return null;
    buf = (buf << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((buf >> bits) & 0xff);
    }
  }
  return out;
}
export function subOf(jwt: string): string | null {
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;
    const json = b64urlToLatin1(parts[1]);
    if (!json) return null;
    const sub = (JSON.parse(json) as { sub?: unknown }).sub;
    return typeof sub === "string" && sub ? sub : null;
  } catch {
    return null;
  }
}

async function post(url: string, headers: Record<string, string>, body?: unknown): Promise<{ status: number; json: unknown }> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Accept: "application/json", ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctl.signal,
    });
    return { status: res.status, json: await res.json().catch(() => null) };
  } finally {
    clearTimeout(t);
  }
}

function adoptTokens(a: string, e: number, rt: string, uid: string) {
  access = a;
  exp = e;
  writeStored({ rt, uid });
  changed();
}

/** التجديدُ بنفسه — رمزٌ رُفض (4xx) يعني جلسةً انتهت (خروجٌ من الويب، إيقاف…) ⇒ تُمسح، والجسرُ يعود */
async function renew(s: Stored): Promise<string | null> {
  const t0 = Date.now();
  try {
    const r = await post(
      `${CONFIG.supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
      { apikey: CONFIG.supabasePublishableKey },
      { refresh_token: s.rt },
    );
    const j = r.json as { access_token?: unknown; refresh_token?: unknown; expires_at?: unknown; user?: { id?: unknown }; error_code?: unknown } | null;
    if (r.status >= 200 && r.status < 300 && j && typeof j.access_token === "string" && typeof j.refresh_token === "string" && typeof j.expires_at === "number") {
      if (j.user?.id !== s.uid) {
        own.clear();
        report("session.renew", t0, { result: "none", why: "user" });
        return null;
      }
      adoptTokens(j.access_token, j.expires_at, j.refresh_token, s.uid);
      report("session.renew", t0, { result: "ok" });
      return j.access_token;
    }
    if (r.status >= 400 && r.status < 500 && r.status !== 429) {
      own.clear();
      report("session.renew", t0, { result: "none", why: typeof j?.error_code === "string" ? j.error_code.slice(0, 16) : `h${r.status}` });
      return null;
    }
    /* 5xx أو 429: الرمزُ ما زال صالحاً على الأرجح — يبقى، والجسرُ يحاول هذه المرّة */
    report("session.renew", t0, { result: "none", why: `h${r.status}` });
    return null;
  } catch {
    report("session.renew", t0, { result: "none", why: "net" });
    return null;
  }
}

/**
 * السكُّ من رمزٍ وصل عبر الجسر (`bridgeAccess` + صاحبُه) — **أو من كوكي الويب** حين يكونان `null` (K4b-c):
 * `fetch` هنا يمرّ بمخزن كوكي الـWebView على أندرويد، فيحمل جلسةَ الويب بلا جسر؛ والخادمُ يقرأ منها رمزَ الوصول
 * ولا يجدّده. `X-Loopz-App` ترويسةُ هذا الباب الإلزاميّة (حارسُ التزوير عبر المواقع عند الخادم).
 */
async function mint(bridgeAccess: string | null, sub: string | null, from?: "login"): Promise<void> {
  const t0 = Date.now();
  const src: Src = from ?? (bridgeAccess ? "bridge" : "cookie");
  try {
    const r = await post(`${CONFIG.apiBase}/api/v1/session/mint`, bridgeAccess ? { Authorization: `Bearer ${bridgeAccess}` } : { "X-Loopz-App": "1" });
    const d = (r.json as { data?: { access_token?: unknown; refresh_token?: unknown; expires_at?: unknown; user_id?: unknown }; error?: { code?: unknown } } | null) ?? null;
    const m = d?.data;
    const uid = typeof m?.user_id === "string" && m.user_id ? m.user_id : null;
    if (r.status === 200 && m && uid && typeof m.access_token === "string" && typeof m.refresh_token === "string" && typeof m.expires_at === "number" && (sub === null || uid === sub)) {
      adoptTokens(m.access_token, m.expires_at, m.refresh_token, uid);
      report("session.mint", t0, { result: "ok", src });
      return;
    }
    mintFailedAt = Date.now();
    report("session.mint", t0, { result: "none", src, why: typeof d?.error?.code === "string" ? d.error.code.slice(0, 16) : `h${r.status}` });
  } catch {
    mintFailedAt = Date.now();
    report("session.mint", t0, { result: "none", src, why: "net" });
  }
}

export const own = {
  enabled(): boolean {
    return flag("k4");
  },
  /** رمزُ الجلسة المملوكة إن كان صالحاً لثلاثين ثانيةً أخرى */
  get(): string | null {
    if (!own.enabled() || !access) return null;
    if (exp * 1000 - Date.now() < SKEW_MS) return null;
    return access;
  },
  /** الرمزُ الآن، أو بعد تجديدٍ واحدٍ مشترك إن كان عندنا رمزُ تجديد — وإلّا `null` (فيعمل الجسر) */
  ensure(): Promise<string | null> {
    if (!own.enabled()) return Promise.resolve(null);
    const t = own.get();
    if (t) return Promise.resolve(t);
    const s = readStored();
    if (!s) return Promise.resolve(null);
    if (!renewing) {
      renewing = renew(s).finally(() => {
        renewing = null;
      });
    }
    return renewing;
  },
  /**
   * رمزٌ وصل عبر الجسر ⇒ يُسكّ منه جلسةٌ مملوكة (مرّةً — لا شيءَ إن كانت لصاحبه نفسِه). صاحبٌ آخر ⇒ تُمسح
   * القديمةُ أوّلاً: تبدّلُ المستخدم في الويب ينقل التطبيقَ معه ولا يبقي جلسةَ غيره.
   */
  adopt(bridgeAccess: string, from?: "login") {
    if (!own.enabled() || minting) return;
    const sub = subOf(bridgeAccess);
    if (!sub) return;
    const s = readStored();
    if (s && s.uid === sub) return;
    if (s) own.clear();
    if (Date.now() - mintFailedAt < MINT_BACKOFF_MS) return;
    minting = mint(bridgeAccess, sub, from).finally(() => {
      minting = null;
    });
  },
  /**
   * 🆕 K4b-c — **السكُّ من كوكي الويب** لحظةَ تجهز صفحتُه (`web.tsx`): الصفحةُ حُمِّلت للتوّ فالخادمُ جدّد كوكيَها
   * إن لزم، ورمزُ الوصول فيه طازج. مرّةً — لا شيء إن كانت عندنا جلسة، أو في مهلة فشلٍ سابق، أو والمفتاحُ مطفأ.
   */
  mintFromCookie() {
    if (!own.enabled() || minting || readStored()) return;
    if (Date.now() - mintFailedAt < MINT_BACKOFF_MS) return;
    minting = mint(null, null).finally(() => {
      minting = null;
    });
  },
  /**
   * 🆕 D-1152 — **السكُّ من رمز الدخول نفسِه، لحظةَ الدخول** (تسجيلُ ٢٧ سبتمبر: بعد الدخول ~٤٠ ثانيةً بلا بيانات —
   * الشاشاتُ الأصليّةُ فُتحت (D-1151) ولا رمزَ لها: الجلسةُ المملوكةُ لم تُسكّ، والجسرُ لا يُجيب، **وسكٌّ من الكوكي
   * فشل وخالدٌ خارجٌ بعد** فحبس كلَّ سكٍّ عشرَ دقائق). التطبيقُ يملك الرمزَ ساعةَ الدخول (هو من دخل بـGoogle قبل أن
   * يسلّمه للويب) — فيُسكّ منه فوراً، وتُصفَّر مهلةُ فشلٍ سبقت الدخول: فشلٌ وهو خارجٌ لا يعاقبه وهو داخل.
   */
  fresh(access: string) {
    mintFailedAt = 0;
    own.adopt(access, "login");
  },
  /** 🆕 D-1151 — جلسةٌ مملوكةٌ محفوظةٌ على الجهاز (رمزُ تجديدٍ لم يُرفض بعد) — دليلُ دخولٍ لـ`session.seen()` */
  hasStored(): boolean {
    return readStored() !== null;
  },
  /** `401` من الخادم: رمزُ الوصول وحدَه يسقط؛ رمزُ التجديد يبقى فيُجدَّد في الطلب التالي */
  dropAccess() {
    access = null;
    exp = 0;
  },
  /** خروجٌ أو تبدّلُ مستخدمٍ أو جلسةٌ رُفضت — **محلّيٌّ فقط**، بلا نداء خروج */
  clear() {
    const had = !!access || !!readStored();
    access = null;
    exp = 0;
    /* D-1152 — الخروجُ يصفّر مهلةَ الفشل أيضاً: الدخولُ التالي يبدأ نظيفاً */
    mintFailedAt = 0;
    writeStored(null);
    if (had) changed();
  },
  onChange(l: () => void): () => void {
    changeListeners.add(l);
    return () => changeListeners.delete(l);
  },
  onEvent(l: (name: EventName, ms: number, extra: EventExtra) => void): () => void {
    eventListeners.add(l);
    return () => eventListeners.delete(l);
  },
};
