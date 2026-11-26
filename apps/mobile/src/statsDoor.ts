import { File, Paths } from "expo-file-system";
import type { useRouter } from "expo-router";
import { dayKey, weekStartKey } from "@/core/activityDays";

/**
 * ====== 🆕 بابُ «إحصائياتك» الواحد (ت٤ «ج» · ق٣ «أ» · س٤ «أ» — أحمد ٢٦ نوفمبر ٢٠٢٦) ======
 *
 * **لماذا بابٌ واحد**: كانت صفحتان باسمين متقاربين («الإحصائيات» و«إحصائياتك») تُفتحان من القائمة الجانبيّة والمكتبة والملفّ
 * بأبوابٍ مختلفة. الآن كلُّ مدخلٍ ينادي هذه الدالّة: **أوّلَ مرّةٍ في الأسبوع (من الأحد) تُفتح القصّة**، وبعدها الصفحةُ مباشرةً —
 * فلا تُتعب القصّةُ من يريد أرقامه سريعاً (س٤ «أ»).
 * ⚖️ **الأسبوعُ يُحفظ في ملفٍّ صغيرٍ على الجهاز** (حجّةُ `imageCacheGuard`): ليس سرّاً فلا مخزنَ آمن، ولا يستحقّ جلبةَ خادم —
 * جهازٌ جديدٌ يرى القصّةَ مرّةً زائدة، ولا ضرر.
 */
const MARK = "stats-story-week.txt";

function thisWeek(): string {
  return weekStartKey(dayKey(new Date().toISOString(), true));
}

/** هل رأى القصّةَ هذا الأسبوع؟ — خطأُ القراءة يُعدّ «لم يرَ» فتظهر مرّةً زائدة لا تختفي أبداً */
function seenThisWeek(): boolean {
  try {
    const f = new File(Paths.document, MARK);
    return f.exists && f.textSync().trim() === thisWeek();
  } catch {
    return false;
  }
}

export function markStorySeen() {
  try {
    new File(Paths.document, MARK).write(thisWeek());
  } catch {
    /* لم يُحفظ ⇒ تظهر القصّةُ في الفتح التالي مرّةً أخرى، لا ضرر */
  }
}

/** المدخلُ الواحد: القصّةُ أوّلَ مرّةٍ في الأسبوع، ثمّ الصفحة */
export function openStats(router: ReturnType<typeof useRouter>, from: string) {
  if (seenThisWeek()) router.push({ pathname: "/statistics", params: { from } });
  else router.push({ pathname: "/stats-story", params: { from } });
}
