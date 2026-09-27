import { Platform } from "react-native";

/**
 * طرازُ الهاتف (`SM-S928B`…) — **ليس هويّةً ولا سرّاً**. تحمله علاماتُ الأداء منذ F0، ويحصر به الخادمُ
 * تجربةَ مفتاحٍ على أجهزةٍ بأسمائها قبل أن يصير عامّاً (K4b). في ملفٍّ وحدَه لأنّ `flags.ts` يُحمَّل قبل
 * `perfMarks.ts` واستيرادُه من هناك دائرة (`perfMarks` ⇢ `session` ⇢ `ownSession` ⇢ `flags`).
 */
export const MODEL = Platform.OS === "android" ? String((Platform.constants as { Model?: string }).Model ?? "android") : Platform.OS;
