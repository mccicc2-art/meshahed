import * as SecureStore from "expo-secure-store";
import type { CommunityPrefs } from "../contracts";

/**
 * ====== اختياراتُ المجتمع على الجهاز — D-1461 ======
 *
 * **لماذا**: الويبُ يحفظ «الكل · من أتابعهم» و«الأحدث · الأكثر تفاعلاً» (والنقاشات) في كوكيز (`setFeedStrangers` …)،
 * والتطبيقُ لا يرسل كوكيز أصلاً (`NO_COOKIES` في `api.ts`) — فكان الاختيارُ يعيش في الكاش وحدَه، وأوّلُ سحبٍ للتحديث
 * يعيد الخادمُ فيه الأصلَ («الكل» + «الأكثر تفاعلاً») فيمحوه (تسجيلُ أحمد ١٨ أكتوبر).
 *
 * 🔑 **الجهازُ هو المرجع، والخادمُ يرسل الشرائحَ كلَّها** (D-1228): الاختيارُ يُطبَّق على كلِّ ردٍّ قبل أن يصل إلى الكاش،
 * فلا تغييرَ في الخادم ولا في قاعدة البيانات. ⚖️ الثمن: الاختيارُ لكلِّ جهازٍ وحدَه، لا يتزامن مع الويب.
 * القراءةُ متزامنة (نهجُ `flags.ts` و`fontScale.ts`)، والفشلُ يُبقي ما أرسله الخادم.
 */
export type FeedChoice = Partial<Pick<CommunityPrefs, "strangers" | "sort" | "talk_followed" | "talk_sort">>;

const KEY = "loopz.communityChoice";

function read(): FeedChoice {
  try {
    const raw = SecureStore.getItem(KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as Record<string, unknown> | null;
    const out: FeedChoice = {};
    if (typeof p?.strangers === "boolean") out.strangers = p.strangers;
    if (p?.sort === "smart" || p?.sort === "latest") out.sort = p.sort;
    if (typeof p?.talk_followed === "boolean") out.talk_followed = p.talk_followed;
    if (p?.talk_sort === "latest" || p?.talk_sort === "active") out.talk_sort = p.talk_sort;
    return out;
  } catch {
    return {};
  }
}

let current: FeedChoice = read();

/** يحفظ ما اختاره المستخدمُ من المفاتيح الأربعة وحدَها (الترجمةُ نصوصٌ من الخادم فلا تُحفظ هنا) */
export function rememberFeedChoice(patch: Record<string, unknown>): void {
  const next: FeedChoice = { ...current };
  if (typeof patch.strangers === "boolean") next.strangers = patch.strangers;
  if (patch.sort === "smart" || patch.sort === "latest") next.sort = patch.sort;
  if (typeof patch.talk_followed === "boolean") next.talk_followed = patch.talk_followed;
  if (patch.talk_sort === "latest" || patch.talk_sort === "active") next.talk_sort = patch.talk_sort;
  current = next;
  try {
    SecureStore.setItem(KEY, JSON.stringify(next));
  } catch {
    /* الحفظُ راحةٌ لا شرط: يبقى الاختيارُ في الذاكرة لهذه الجلسة */
  }
}

/** يلبس ردَّ الخادم اختيارَ الجهاز — الزائرُ بلا تفضيلات (`prefs` فارغة) يمرّ كما هو */
export function withFeedChoice<T extends { prefs: CommunityPrefs | null }>(d: T): T {
  if (!d.prefs || Object.keys(current).length === 0) return d;
  return { ...d, prefs: { ...d.prefs, ...current } };
}
