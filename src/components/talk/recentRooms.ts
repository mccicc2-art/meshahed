/**
 * 🆕 R264 — **غرفُ النقاش التي زرتَها مؤخّراً — نسخةُ الويب** (نظيرُ `apps/mobile/src/thread/recentRooms.ts`).
 *
 * التطبيقُ يحفظها في ملفٍّ على الجهاز، والويبُ في `localStorage` — **ذاكرةُ هذا المتصفّح وحدَه** كما هي هناك ذاكرةُ
 * الجهاز وحدَه (لا جدولَ ولا نداء). آخرُ خمسِ غرف، الأحدثُ أوّلاً. والفشلُ صمت: وضعُ التصفّح الخاصّ يرمي عند الكتابة،
 * **وقائمةٌ فارغةٌ أهونُ من صفحةٍ تسقط**.
 */
export type RecentRoom = { kind: "tv" | "movie"; id: number; title: string; poster: string | null };

const KEY = "loopz.talk.recent";
const MAX = 5;

export function readRecentRooms(): RecentRoom[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as RecentRoom[]) : [];
    return Array.isArray(list) ? list.filter((r) => r && (r.kind === "tv" || r.kind === "movie") && Number.isFinite(r.id)).slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function rememberRoom(r: RecentRoom) {
  try {
    const next = [r, ...readRecentRooms().filter((x) => !(x.kind === r.kind && x.id === r.id))].slice(0, MAX);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* تخزينٌ ممنوع — لا شيء يُحفظ، ولا شيء يسقط */
  }
}
