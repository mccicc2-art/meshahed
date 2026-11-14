import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Application from "expo-application";
import { inviteCodeFromReferrer } from "@/core/storeLinks";
import { pendingInvite } from "./pending";

/**
 * ====== 🆕 1.14.1 — مَن دعا العضوَ، من مصدر التثبيت في Google Play (قرارُ أحمد ١٠ نوفمبر «ب سجلها … ذكرني فيها» ثمّ ١٥ نوفمبر «٤أ») ======
 *
 * **لماذا**: زرُّ Google Play في صفحة الدعوة (`/invite/<code>`) يحمل الكودَ في `referrer=ref%3D<CODE>`، وGoogle Play يعيده للتطبيق
 * بعد التثبيت. فمن ذهب من صفحة الدعوة إلى المتجر مباشرةً ولم يرجع ليضغط «افتح الدعوة في التطبيق» تظهر له بطاقةُ «هل دعاك…؟»
 * في الترحيب بلا ضغطةٍ زائدة — الكودُ يُكتب في المخزن نفسِه الذي يكتب فيه ذلك الزرّ (`pending.ts`)، والترحيبُ يسمع التغيّر.
 * ⚖️ **أندرويد وحدَه**: Apple لا تعطي مصدرَ التثبيت، ومطابقةُ عنوان IP بصمةٌ تمنعها — فالآيفون يبقى على الزرّ والبحث بالاسم.
 * ⚖️ **مرّةً في عمر التثبيت**: المصدرُ لا يتغيّر بعد التثبيت، فيُقرأ أوّلَ إقلاعٍ ويُعلَّم. والفشلُ (خدمةُ Play مشغولةٌ أو انقطعت)
 * يُعاد في الفتحات التالية حتى ثلاث محاولات ثمّ يُترك (المراجعةُ المستقلّة: فشلٌ عابرٌ كان يُضيّع الدعوة) — ومتجرٌ غيرُ Play يفشل
 * كلَّ مرّةٍ فلا يُسأل أكثر من ثلاث. ومن ثبّت بلا دعوة يصل مصدرُه `utm_source=google-play&utm_medium=organic` فلا كود.
 * ⚖️ **لا يطغى على زرّ الصفحة**: كودٌ معلَّقٌ موجودٌ (جاء من الزرّ) لا يُستبدل بمصدر التثبيت.
 */
const DONE_KEY = "loopz.invite.referrerRead";

const MAX_TRIES = 3;

export async function readInstallReferrerOnce(): Promise<void> {
  if (Platform.OS !== "android") return;
  let state: string | null;
  try {
    state = SecureStore.getItem(DONE_KEY);
  } catch {
    return;
  }
  /* "1" قُرئ · "f<n>" فشل n مرّة */
  if (state === "1") return;
  const failed = state && state.startsWith("f") ? Number(state.slice(1)) || 0 : 0;
  if (failed >= MAX_TRIES) return;
  let raw: string;
  try {
    raw = await Application.getInstallReferrerAsync();
  } catch {
    /* خدمةُ Play لم تُجب — تُعاد في فتحةٍ قادمة */
    try {
      SecureStore.setItem(DONE_KEY, `f${failed + 1}`);
    } catch {
      /* لا شيء */
    }
    return;
  }
  try {
    SecureStore.setItem(DONE_KEY, "1");
  } catch {
    /* يُسأل مرّةً أخرى في الفتحة القادمة — لا ضرر */
  }
  const code = inviteCodeFromReferrer(raw);
  /* كودٌ جاء من زرّ الصفحة لا يُستبدل */
  if (code && !(await pendingInvite.get())) await pendingInvite.set(code);
}
