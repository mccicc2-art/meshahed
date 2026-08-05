"use client";

import {
  toggleEpisode,
  toggleMovieWatched,
  setDropped,
  markShowWatched,
  markNextEpisode,
} from "@/lib/actions";

/**
 * طابور الأوفلاين.
 *
 * الواجهة متفائلة أصلاً — تتقدّم قبل ردّ الخادم. هذه الطبقة تكمل الوعد:
 * الفعل الذي يفشل لانقطاع الشبكة لا يضيع، بل يدخل طابوراً محلياً
 * ويُعاد تشغيله عند عودة الاتصال (حدث online أو فتح التطبيق).
 *
 * الأفعال كلها idempotent — upsert على مفاتيح فريدة — فإعادة التشغيل
 * آمنة مهما تكررت، وآخر كتابة تكسب عبر الأجهزة.
 */

/**
 * المفتاح مُقسَّم على معرّف المستخدم — localStorage مشترك بين حسابات
 * الجهاز الواحد، والمفتاح الموحّد القديم كان يعني أن من يسجّل دخوله
 * بعدك على نفس المتصفح: يقرأ ما شاهدتَه من الطابور المعلّق، بل ويدفعه
 * إلى حسابه هو عند عودة الاتصال.
 */
const LEGACY_KEY = "loopz-offline-queue-v1";
const PREFIX = "loopz-offline-queue-v2:";

let uid: string | null = null;

/** يضبط صاحب الطابور، ويطهّر المفتاح القديم وطوابير الحسابات الأخرى */
export function setOfflineUser(id: string | null) {
  uid = id;
  try {
    localStorage.removeItem(LEGACY_KEY);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX) && k !== PREFIX + (id ?? "")) {
        localStorage.removeItem(k);
      }
    }
  } catch {
    /* لا شيء */
  }
}

function storageKey(): string | null {
  return uid ? PREFIX + uid : null;
}

const FNS = {
  toggleEpisode,
  toggleMovieWatched,
  setDropped,
  markShowWatched,
  markNextEpisode,
} as const;

type FnName = keyof typeof FNS;
interface QItem {
  fn: FnName;
  args: unknown[];
  ts: number;
}

function read(): QItem[] {
  const key = storageKey();
  if (!key) return [];
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]") as QItem[];
  } catch {
    return [];
  }
}

function write(q: QItem[]) {
  const key = storageKey();
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(q.slice(-100)));
  } catch {
    /* التخزين ممتلئ أو محجوب — الطابور تحسين لا التزام */
  }
}

/** خطأ شبكةٍ لا خطأ منطق: فقط هذا يستحق الطابور — أخطاء الخادم تُرمى */
function isNetworkError(e: unknown) {
  return (
    (typeof navigator !== "undefined" && !navigator.onLine) ||
    e instanceof TypeError ||
    (e instanceof Error && /fetch|network|load failed/i.test(e.message))
  );
}

/**
 * نفّذ الفعل، وإن قطعت الشبكة فاحفظه للطابور وأرجع "queued" —
 * الواجهة المتفائلة تكمل كأن شيئاً لم يكن.
 */
export async function runOrQueue<N extends FnName>(
  fn: N,
  ...args: Parameters<(typeof FNS)[N]>
): Promise<"done" | "queued"> {
  try {
    await (FNS[fn] as (...a: unknown[]) => Promise<unknown>)(...args);
    return "done";
  } catch (e) {
    // بلا صاحبٍ معروف لا طابور: لا نخاطر بدفع أفعال حسابٍ لحساب آخر
    if (isNetworkError(e) && storageKey()) {
      write([...read(), { fn, args, ts: Date.now() }]);
      return "queued";
    }
    throw e;
  }
}

/** أعد تشغيل الطابور — يُرجع عدد ما نجح. ما فشل شبكياً يبقى لدورةٍ قادمة. */
export async function flushQueue(): Promise<number> {
  const q = read();
  if (q.length === 0) return 0;
  const remaining: QItem[] = [];
  let ok = 0;
  for (const item of q) {
    try {
      await (FNS[item.fn] as (...a: unknown[]) => Promise<unknown>)(...item.args);
      ok++;
    } catch (e) {
      if (isNetworkError(e)) remaining.push(item);
      // خطأ منطقيّ (صفٌ زال مثلاً): يسقط من الطابور بصمت — التكرار لن يصلحه
    }
  }
  write(remaining);
  return ok;
}

export function queueSize(): number {
  return read().length;
}
