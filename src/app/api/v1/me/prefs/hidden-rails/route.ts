import { setHiddenRails } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import type { HiddenRailsBody } from "@/core/contracts/library";

/**
 * `POST /api/v1/me/prefs/hidden-rails` — الصفوفُ المخفيّة (D-874).
 * ⚠️ **الفعلُ يكتب كوكيَ `loopz_rails`**: على أندرويد `fetch` في React Native
 * يتقاسم مخزنَ الكوكي مع الـWebView (`ForwardingCookieHandler`) فيصل
 * الإخفاءُ إلى الصفحات أيضاً — وهذا يُتحقّق منه على الجهاز (D-947).
 */
export const POST = bodyRoute<HiddenRailsBody, { ok: boolean; needsPlus?: true }>(
  (b) => setHiddenRails(Array.isArray(b.keys) ? b.keys.map(String) : []),
  () => ["me:library"],
);
