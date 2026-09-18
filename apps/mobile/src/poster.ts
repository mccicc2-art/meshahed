import { PixelRatio } from "react-native";
import { posterSizeFor, posterUrl } from "@/core/media";

/**
 * D-1027 (F3) — بابُ الملصق الواحد في «المكتبة» و«اكتشف»: العرضُ بالـdp يدخل، والرابطُ
 * بالمقاس الذي تقرّره `posterSizeFor` يخرج. **العملُ نفسُه ⇒ الرابطُ نفسُه في الشاشتين** على
 * الجهاز الواحد، فيخدمه كاشُ الصور (ذاكرةً وقرصاً) مرّةً واحدة. الكثافةُ ثابتةٌ في عمر العمليّة.
 */
const RATIO = PixelRatio.get();

export function posterFor(path: string | null, widthDp: number) {
  return posterUrl(path, posterSizeFor(widthDp, RATIO));
}
