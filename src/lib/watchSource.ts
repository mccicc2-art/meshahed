/**
 * ====== 🆕 D-1505 — مصدرُ المشاهدة: من سجّل هذا الصفّ؟ ======
 *
 * سجلُّ المشاهدة يكتب بجوار كلِّ صفٍّ شارةً صغيرة لما لم يسجّله صاحبُه بيده (تصميمُ «أ»، أحمد ٢٧ أكتوبر): **من يرى في
 * سجلّه حلقةً لا يذكرها يحتاج أن يعرف من أين جاءت** — وإلّا شكّ في السجلّ كلِّه.
 *
 * - العمودُ `source` في `watched_episodes` و`watched_movies` (`claude/D-1505-watch-source.sql` — DDL أحمد): `null` = بيده.
 * - **الوسمُ كتابةٌ ثانيةٌ بعد الإدراج لا حقلٌ فيه**: الإدراجُ يجب أن ينجح قبل أن يُضاف العمودُ وبعده؛ ووسمٌ يفشل (لا عمود
 *   بعد) يُبتلع — الصفُّ مسجَّلٌ والشارةُ تغيب، وهو أهونُ من حلقةٍ لا تُسجَّل.
 * - **بالمعرّفات التي أدرجها النداءُ نفسُه** (`upsert(...).select("id")`): صفٌّ قديمٌ سجّله بيده لا يُنسب إلى Stremio.
 */
import type { WatchSource } from "@/core/activityDays";
export type { WatchSource };
export const WATCH_SOURCES: readonly WatchSource[] = ["stremio", "widget", "import", "auto"];

type Db = { from: (t: string) => { update: (v: Record<string, unknown>) => { in: (c: string, v: unknown[]) => PromiseLike<unknown> } } };

export async function tagSource(db: unknown, table: "watched_episodes" | "watched_movies", rows: { id: number }[] | null | undefined, source: WatchSource): Promise<void> {
  const ids = (rows ?? []).map((r) => r.id).filter((n) => Number.isInteger(n));
  if (!ids.length) return;
  try {
    await (db as Db).from(table).update({ source }).in("id", ids);
  } catch {
    /* العمودُ لم يُضف بعد، أو الشبكة — الشارةُ وحدَها تغيب */
  }
}

/** ما يقرؤه السجلّ: قيمةٌ معروفةٌ أو `null` (بيده، أو قبل العمود) */
export function asSource(v: unknown): WatchSource | null {
  return typeof v === "string" && (WATCH_SOURCES as readonly string[]).includes(v) ? (v as WatchSource) : null;
}
