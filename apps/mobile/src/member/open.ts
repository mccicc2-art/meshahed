import type { useRouter } from "expo-router";

type Router = ReturnType<typeof useRouter>;
import type { NativeRoot } from "../shell";
import { warmProfile } from "./profileData";

/**
 * ====== بابُ ملفّ الشخص الأصليّ — مكانٌ واحدٌ لكلِّ من يفتحه (🆕 Phase 11-N · N1) ======
 *
 * كان كلُّ من يفتح ملفّاً يكتب `openWeb("/u/<اسم>")` بنفسه (ثمانيةُ مواضع — ملحق 04). الآن **الشاشاتُ تسأل هذا الملفّ**:
 * `profileHandleOf(path)` يعرف رابطَ الملفّ (بلا تبويبٍ فرعيٍّ ولا `/stats` — تلك وجهاتٌ داخل الصفحة لم تُنقل)، و`openProfile`
 * يدفع الشاشةَ بـ`from` من فتحها — الرجوعُ يعود إليه (الجذر · صفحةُ الويب `from=web`).
 */
export function profileHandleOf(path: string): string | null {
  const m = /^\/u\/([^/?#]+)\/?$/.exec(path);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return null;
  }
}

export function openProfile(router: Router, username: string, from: NativeRoot | "web") {
  /* 🆕 D-1325 — صورُ الشاشة الأولى تبدأ مع الضغطة لا بعد التركيب (تسجيلُ أحمد ٨ أكتوبر: ملصقاتُ صفٍّ وأيقوناتُ الأرقام
     تظهر بعد وصول الملفّ بإطارات — «لقلقة»). كان ذلك لملفّ صاحب الحساب وحدَه (D-1243). */
  warmProfile(username);
  router.push({ pathname: "/u/[username]", params: { username, from } });
}
