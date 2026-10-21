import { File, Paths } from "expo-file-system";

/**
 * ====== 🆕 R56 — غرفُ النقاش التي زرتُها مؤخّراً ======
 *
 * أحمد ٢١ أكتوبر («٢ أ»): بحثُ «Discussions» يفتح على «زرتها مؤخراً» ثمّ «الأنشط هذا الأسبوع». ذاكرةٌ في الجهاز وحدَه
 * (لا جدولَ ولا نداء): آخرُ خمسِ غرفٍ فُتحت، الأحدثُ أوّلاً. ملفٌّ صغيرٌ بنمط `perfMarks` (لا تبعيّةَ أصليّةَ جديدة)،
 * يُقرأ مرّةً عند أوّل طلب ويُكتب مع كلِّ زيارة؛ والفشلُ صمتٌ — قائمةٌ فارغةٌ أهونُ من شاشةٍ تسقط.
 */
export type RecentRoom = { kind: "tv" | "movie"; id: number; title: string; poster: string | null };

const MAX = 5;
let cache: RecentRoom[] | null = null;
const file = () => new File(Paths.document, "talk-recent.json");

export async function recentRooms(): Promise<RecentRoom[]> {
  if (cache) return cache;
  try {
    const f = file();
    cache = f.exists ? ((JSON.parse(await f.text()) as RecentRoom[]) ?? []).slice(0, MAX) : [];
  } catch {
    cache = [];
  }
  return cache;
}

export function rememberRoom(r: RecentRoom) {
  void recentRooms().then((list) => {
    cache = [r, ...list.filter((x) => !(x.kind === r.kind && x.id === r.id))].slice(0, MAX);
    try {
      const f = file();
      if (!f.exists) f.create();
      f.write(JSON.stringify(cache));
    } catch {
      /* الذاكرةُ تحسين — لا تُسقط الغرفة */
    }
  });
}
