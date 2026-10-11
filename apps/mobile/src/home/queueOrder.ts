import type { HomePayload, QueueOrderBody } from "../contracts";
import { applyQueueOrder } from "@/core/homePrefs";

/**
 * 🆕 D-1353 — **ترتيبُ صفٍّ يُطبَّق على الحمولة المحفوظة فوراً** (D-1094)، في مكانٍ واحد: كان في `HomeScreen` وحدَها،
 * وصفحةُ «الكلّ» (`HomeAllScreen`) صارت بابَ الترتيب — فالدالّةُ هنا يقرؤها الاثنان. الترتيبُ `applyQueueOrder` نفسُها
 * التي يرتّب بها الخادم، فالتفاؤلُ والجلبُ اللاحقُ يتّفقان حرفاً. `towatchlist` لا يُرسم ترتيبُه في الرئيسيّة فيكفيه الجلب.
 */
export function reorderHomePayload(prev: HomePayload, row: QueueOrderBody["row"], keys: string[]): HomePayload {
  if (row === "towatchlist") return prev;
  const byKey = <T,>(arr: T[], keyOf: (x: T) => string) => applyQueueOrder(arr, keyOf, keys);
  const s = prev.sections;
  const q = prev.queues;
  if (row === "continue") return { ...prev, sections: { ...s, continue: byKey(s.continue, (c) => c.key) }, queues: { ...q, continue: byKey(q.continue, (x) => x.key) } };
  if (row === "towatch") {
    const all = byKey(s.towatch.all, (x) => x.key);
    return { ...prev, sections: { ...s, towatch: { all, items: all.slice(0, s.towatch.items.length) } }, queues: { ...q, towatch: byKey(q.towatch, (x) => x.key) } };
  }
  /* صفُّ القوائم: البطاقاتُ بمعرّفها، وبطاقةُ الطابور موضعُها بين البطاقات = موضعُ مفتاحها الذي لا يطابق بطاقة */
  const cards = byKey(s.lists.cards, (c) => c.id);
  const ids = new Set(cards.map((c) => c.id));
  const at = s.lists.towatch_card ? keys.findIndex((k) => !ids.has(k)) : -1;
  return { ...prev, sections: { ...s, lists: { ...s.lists, cards, towatch_at: at } }, queues: { ...q, lists: byKey(q.lists, (x) => x.key) } };
}
