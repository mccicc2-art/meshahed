import * as SecureStore from "expo-secure-store";
import { AppState } from "react-native";
import { CONFIG } from "./config";

/**
 * ====== مفاتيحُ التطبيق من الخادم — D-1140 (Phase 11-K · K2) ======
 *
 * **لماذا**: K2 تنزل عبر الهواء **مطفأةً** وتُشغَّل من `/api/v1/app/flags` بلا تحديثٍ ثانٍ —
 * وتُطفأ منه في دقائق إن ساءت على هاتف أحدٍ.
 *
 * 🔑 **القراءةُ متزامنةٌ من آخر قيمةٍ محفوظة** (نهجُ `theme.ts` و`fontScale.ts`): الشاشةُ تقرأ
 * المفتاحَ لحظةَ تُركَّب، ولا تنتظر شبكة. والسؤالُ يجري في الخلفيّة بعد الإقلاع بثوانٍ (لا
 * يزاحم أوّلَ بيانات — `boot.fresh`) وعند كلِّ عودةٍ من الخلفيّة، **فالقيمةُ الجديدةُ تعمل من
 * الفتح التالي للشاشة**. وبلا شبكةٍ أو بخطأٍ تبقى القيمةُ السابقة — والأصلُ «مطفأ».
 *
 * ⚖️ **بلا رمز**: النداءُ عامٌّ لا يحمل هويّة (`fetch` مباشرةً لا `api()`) — كي لا يطلب رمزاً
 * من الـWebView لأجل مفتاح.
 */
export type AppFlags = { k2: boolean };

const KEY = "loopz.flags";
const OFF: AppFlags = { k2: false };
const MIN_GAP_MS = 60_000;

function read(): AppFlags {
  try {
    const raw = SecureStore.getItem(KEY);
    if (!raw) return OFF;
    const p = JSON.parse(raw) as Partial<AppFlags> | null;
    return { k2: p?.k2 === true };
  } catch {
    return OFF;
  }
}

let current = read();
let inflight = false;
let last = 0;

export function flag(name: keyof AppFlags): boolean {
  return current[name];
}

async function refresh() {
  if (inflight || Date.now() - last < MIN_GAP_MS) return;
  inflight = true;
  last = Date.now();
  try {
    const res = await fetch(`${CONFIG.apiBase}/api/v1/app/flags`);
    if (!res.ok) return;
    const j = (await res.json()) as { data?: Partial<AppFlags> } | null;
    const next: AppFlags = { k2: j?.data?.k2 === true };
    if (next.k2 === current.k2) return;
    current = next;
    SecureStore.setItem(KEY, JSON.stringify(next));
  } catch {
    /* المفتاحُ يبقى على آخر قيمةٍ عُرفت */
  } finally {
    inflight = false;
  }
}

setTimeout(() => void refresh(), 4_000);
AppState.addEventListener("change", (s) => {
  if (s === "active") void refresh();
});
