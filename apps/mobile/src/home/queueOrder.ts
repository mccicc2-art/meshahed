import type { HomePayload, HomeQueueItem, QueueOrderBody } from "../contracts";
import { applyQueueOrder } from "@/core/homePrefs";

/**
 * 🆕 D-1353 — **ترتيبُ صفٍّ يُطبَّق على الحمولة المحفوظة فوراً** (D-1094)، في مكانٍ واحد: كان في `HomeScreen` وحدَها،
 * وصفحةُ «الكلّ» (`HomeAllScreen`) صارت بابَ الترتيب — فالدالّةُ هنا يقرؤها الاثنان. الترتيبُ `applyQueueOrder` نفسُها
 * التي يرتّب بها الخادم، فالتفاؤلُ والجلبُ اللاحقُ يتّفقان حرفاً.
 * 🆕 R52 — و`towatchlist` صار يُرسم: ورقةُ «طابور الأفلام» (D-1507) تقرأ `queues.towatch_list`، وبطاقتُه في «تابِع المشاهدة»
 * «التالي» فيها رأسُ الطابور — كان يكفيه الجلبُ فبقيت الورقةُ على ترتيبها القديم بعد «تم» (بلاغُ أحمد ٢١ أكتوبر: «الترتيب لا يعمل»).
 */
export function reorderHomePayload(prev: HomePayload, row: QueueOrderBody["row"], keys: string[]): HomePayload {
  if (row === "towatchlist") {
    const list = applyQueueOrder(prev.queues.towatch_list, (x) => x.key, keys);
    const head = list[0];
    const id = head ? Number(/^tw-mv-(\d+)$/.exec(head.key)?.[1] ?? 0) : 0;
    const continueCards = prev.sections.continue.map((c) =>
      c.type === "towatch" && head && id ? { ...c, next: { ...c.next, kind: "movie" as const, id, title: head.title, poster_path: head.poster_path } } : c,
    );
    return { ...prev, sections: { ...prev.sections, continue: continueCards }, queues: { ...prev.queues, towatch_list: list } };
  }
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

/**
 * 🆕 D-1596 — **طابورُ «للمشاهدة» مشتقٌّ من القسم نفسِه**: بـ`?lite=1` لا يرسل الخادمُ `queues.towatch` (كان نسخةً ثانيةً من
 * `sections.towatch.all` بالترتيب نفسِه مع كلِّ فتحة). حمولةٌ محفوظةٌ أقدم ما زالت تحمله، فيُقرأ إن وُجد.
 */
export function towatchQueueOf(d: HomePayload): HomeQueueItem[] {
  if (d.queues.towatch.length) return d.queues.towatch;
  return d.sections.towatch.all.map((x) => ({ key: x.key, title: x.title, poster_path: x.poster_path, media_type: x.kind }));
}
