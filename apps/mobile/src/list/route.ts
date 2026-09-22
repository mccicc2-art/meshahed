/**
 * D-1036 — **بابٌ واحدٌ يقرّر: قائمةٌ تُفتح أصليّةً أم ويبيّة.** كلُّ من يفتح قائمةً في الشاشتين يمرّ بـ`leaveTo`
 * (تبويبُ القوائم · صفوفُ «اكتشف» · ما بعد الإنشاء)، فالقرارُ هناك لا في كلِّ منادٍ. `/lists/<uuid>` **العاريةُ**
 * وحدَها أصليّة؛ ما يحمل استعلاماً يبقى ويبيّاً.
 */
const RE = /^\/lists\/([0-9a-f-]{36})$/i;
export const nativeListId = (path: string): string | null => RE.exec(path)?.[1] ?? null;

/**
 * D-1074 — الدالّتان أختا `nativeListId` للبابَين الآخرَين اللذين صارا أصليّين بعد D-1036:
 * صفحةُ العمل (D-956) وصفحةُ الشخص (D-983). كانت «فنّانون» وورقةُ المجموعة الآليّة في المكتبة
 * تمرّران `/person/…` و`/show|movie/…` إلى `leaveTo` فتفتح الويبَ فوق شاشةٍ أصليّةٍ قائمة —
 * تناقضٌ يراه المستخدم. القرارُ يبقى في الباب الواحد، لا في كلِّ منادٍ.
 */
const TITLE = /^\/(show|movie)\/(\d+)(?:[/?#]|$)/;
export const nativeTitle = (path: string): { kind: "tv" | "movie"; id: number } | null => {
  const m = TITLE.exec(path);
  return m ? { kind: m[1] === "show" ? "tv" : "movie", id: Number(m[2]) } : null;
};

const PERSON = /^\/person\/(\d+)(?:[/?#]|$)/;
export const nativePersonId = (path: string): number | null => {
  const m = PERSON.exec(path);
  return m ? Number(m[1]) : null;
};
