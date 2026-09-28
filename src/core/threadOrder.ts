/**
 * ====== ترتيبُ الخيط وشجرتُه — قواعدُ `ThreadReplies` (الويب) في النواة (Phase 11-M · M3) ======
 *
 * كانت داخل مكوّن الويب؛ **وشاشةُ التطبيق قارئُها الثاني** (D-376: الاستخراجُ عند القارئ الثاني) — ولا تُحسب في
 * الخادم وحدَه لأنّ الردَّ المتفائلَ يُدرج في العميل قبل رحلة الخادم فيجب أن يقع في موضعه نفسِه.
 *
 * القواعدُ حرفاً:
 * - **الزمنُ أوّلاً** (`createdAt` تصاعديّاً) — الحوارُ يُقرأ من أوّله.
 * - **الغرفةُ بالأصوات** (D-305): الجذورُ بمجموعها تنازليّاً (والفرزُ مستقرٌّ فالأقدمُ أوّلاً عند التعادل)، والأبناءُ بعدها.
 * - **الرأيُ بلا أصوات**: جذورُ مشتركي Plus قبل غيرهم (D-700) — ترتيبٌ لا إخفاء.
 * - **الشجرةُ للغرفة وحدَها**: ابنٌ أبوه غائبٌ (محذوفٌ أو محجوب) يُرفع جذراً لا يُسقط (D-145).
 * - **العمقُ ٣** (`MAX_DEPTH`): الردُّ متاحٌ ما دام العمقُ أقلَّ منه؛ وفي غير الغرفة ردٌّ واحدٌ تحت الجذر.
 */
import { isPlus } from "./plan.ts";

export const MAX_DEPTH = 3;
/** كم ردّاً يُرى تحت الجذر قبل «عرض N ردود أخرى» */
export const PEEK = 3;

export type OrderRow = {
  id: string;
  parent_id: string | null;
  created_at: string;
  score?: number;
  person?: { plan?: string | null; plus_until?: string | null } | null;
};

export function orderThread<T extends OrderRow>(rows: readonly T[], opts: { votes: boolean; plusFirst: boolean }): T[] {
  const all = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
  if (opts.votes) {
    const roots = all.filter((r) => !r.parent_id);
    const kids = all.filter((r) => r.parent_id);
    roots.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    return [...roots, ...kids];
  }
  if (opts.plusFirst) {
    const roots = all.filter((r) => !r.parent_id);
    const kids = all.filter((r) => r.parent_id);
    const first = roots.filter((r) => isPlus(r.person ?? null));
    const rest = roots.filter((r) => !isPlus(r.person ?? null));
    if (first.length && rest.length) return [...first, ...rest, ...kids];
  }
  return all;
}

export type ThreadTree<T extends OrderRow> = {
  roots: T[];
  kids: Map<string, T[]>;
  depth: Map<string, number>;
};

/** الشجرةُ من صفوفٍ مرتّبة — `nested = false` يجعل الكلَّ جذوراً (الرأيُ والمنشور) */
export function buildTree<T extends OrderRow>(rows: readonly T[], nested: boolean): ThreadTree<T> {
  const byId = new Set(rows.map((r) => r.id));
  const kids = new Map<string, T[]>();
  const roots: T[] = [];
  const depth = new Map<string, number>();
  for (const r of rows) {
    if (nested && r.parent_id && byId.has(r.parent_id)) {
      const list = kids.get(r.parent_id);
      if (list) list.push(r);
      else kids.set(r.parent_id, [r]);
      depth.set(r.id, (depth.get(r.parent_id) ?? 0) + 1);
    } else {
      roots.push(r);
      depth.set(r.id, 0);
    }
  }
  return { roots, kids, depth };
}

/** كلُّ ما تحت ردٍّ مهما عمق — رقمُ «ردّ» وزرُّ «عرض الردود» */
export function countUnder<T extends OrderRow>(tree: ThreadTree<T>, id: string): number {
  return (tree.kids.get(id) ?? []).reduce((n, c) => n + 1 + countUnder(tree, c.id), 0);
}

/** أيُمكن الردُّ على هذا السطر؟ — العمقُ في الغرفة، والجذرُ وحدَه في غيرها */
export function canReplyTo(row: OrderRow, depth: number, nested: boolean): boolean {
  return nested ? depth < MAX_DEPTH : !row.parent_id;
}
