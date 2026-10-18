import { Platform } from "react-native";
import { Image } from "expo-image";
import { File, Paths } from "expo-file-system";
import * as Updates from "expo-updates";

/**
 * ====== 🔴 ذاكرةُ الصور تُمسح مرّةً بعد كلِّ بناءٍ أصليٍّ جديد (أندرويد) ======
 *
 * **ما حدث** (١٣ أكتوبر، أوّلُ تجربةٍ لبناء الودجتات على جوال خالد): الدوكُ رسم أيقونةَ «المكتبة» مكانَ «الرئيسية»،
 * و«أفلام» قلباً، و«أسبوعك» و«ماذا يشاهد أصدقاؤك» برموزٍ غيرِ رموزهما — وكلُّها عادت صحيحةً بمسح ذاكرة التطبيق المؤقّتة.
 *
 * **لماذا**: صورُ `require(...)` في بناء أندرويد موارد (`res/drawable`) يُشار إليها برقمٍ يولّده البناء، والبناءُ الذي
 * يضيف صورةً (رموزُ الودجت هنا) يُزيح الأرقام. و`expo-image` يحفظ على القرص ما رسمه بمفتاح المصدر، فبعد التحديث
 * يجد الرقمَ نفسَه في ذاكرته القديمة ويعيد صورةَ غيره. iOS يشير إلى ملفّاته بأسمائها فلا يصيبه هذا.
 *
 * **الحلّ**: نسخةُ التشغيل (`runtimeVersion` = بصمةُ الطبقة الأصليّة) لا تتغيّر إلّا ببناءٍ أصليٍّ جديد — وهو وحده ما
 * يغيّر الأرقام. فإن اختلفت عن آخرِ ما حُفظ مُسحت ذاكرتا الصور **قبل أوّل رسمة** ثمّ حُفظت النسخة. الثمن: الملصقاتُ تُنزَّل
 * من جديد مرّةً بعد كلِّ تحديثٍ من المتجر — لا بعد تحديثات OTA، فهي لا تغيّر البصمة.
 */

const MARK = "image-cache-runtime.txt";

function needsClear(): string | null {
  if (Platform.OS !== "android") return null;
  const runtime = Updates.runtimeVersion;
  if (!runtime) return null;
  try {
    const f = new File(Paths.document, MARK);
    const seen = f.exists ? f.textSync().trim() : "";
    return seen === runtime ? null : runtime;
  } catch {
    return runtime;
  }
}

function clear(runtime: string): Promise<void> {
  return Promise.all([Image.clearDiskCache(), Image.clearMemoryCache()])
    .then(() => {
      try {
        new File(Paths.document, MARK).write(runtime);
      } catch {
        /* لم يُحفظ ⇒ يُمسح مرّةً أخرى في الإقلاع التالي، لا ضرر */
      }
    })
    .catch(() => {
      /* فشلُ المسح لا يحبس التطبيق — أسوأُ الحالات رموزٌ خاطئةٌ حتّى يُمسح يدويّاً كما كان */
    });
}

const pending = needsClear();

/** `true` في كلِّ إقلاعٍ عاديّ — `false` لحظاتٍ في أوّلِ إقلاعٍ بعد تحديثٍ من المتجر */
export let imageCacheClean = pending === null;

/** يُنتظر قبل أيِّ تحميلٍ للصور (الجذرُ يحبس الرسمَ عليه، والرموزُ تُحمَّل مسبقاً بعده) */
export const imageCacheReady: Promise<void> = pending
  ? clear(pending).then(() => {
      imageCacheClean = true;
    })
  : Promise.resolve();
