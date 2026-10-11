import { queryClient } from "./api";
import { CONFIG } from "./config";
import { currentLocale } from "./i18n";

/**
 * ====== 🆕 D-1350 — الشاشةُ التاليةُ تُجلب برمز الدخول نفسِه قبل أن تُرفع ======
 *
 * بعد الدخول تُعرض شاشةُ الشعار (قرارُ أحمد ١١ أكتوبر) حتى يكتمل رسمُه **وتجهز الشاشةُ التي بعده** — الرئيسيّةُ لمن
 * أتمّ الترحيب، وخطوتُه الأولى لمن لم يُتمّه. الجلبُ هنا `fetch` خامٌّ برمز الدخول الذي في يد الشاشة، لا `api()`:
 * ذاك يطلب رمزَ الجلسة من الجسر إن لم يكن في الذاكرة، والجسرُ بعد الدخول لا يُجاب ثوانيَ (`token.wait`، مؤجَّلٌ في
 * `05`). الردُّ يوضع في كاش الاستعلام بمفتاح الشاشة، فتُفتح ممتلئةً ولا تسأل ثانيةً.
 *
 * ⚖️ السقفُ يحكم: ما لم يصل قبله يمضي المنادي، والشاشةُ تجلب بطريقها المعتاد كما كانت.
 */
export const WELCOME_KEY = ["welcome"] as const;

export function prime(access: string, path: string, key: readonly unknown[], capMs: number): Promise<boolean> {
  const ctl = new AbortController();
  const got = (async () => {
    const res = await fetch(`${CONFIG.apiBase}${path}`, {
      headers: { Accept: "application/json", "Accept-Language": currentLocale(), Authorization: `Bearer ${access}`, "Cache-Control": "no-cache" },
      signal: ctl.signal,
    });
    const json = (await res.json().catch(() => null)) as { data?: unknown; error?: unknown } | null;
    if (!res.ok || !json || json.error || json.data == null) return false;
    queryClient.setQueryData(key, json.data);
    return true;
  })().catch(() => false);
  return Promise.race([
    got,
    new Promise<boolean>((r) =>
      setTimeout(() => {
        ctl.abort();
        r(false);
      }, capMs),
    ),
  ]);
}
