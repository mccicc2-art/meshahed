import { NextResponse, type NextRequest } from "next/server";
import { ANDROID_HREF, IOS_HREF, deviceOf } from "@/components/plus/plusStore";

/**
 * 🆕 **`/get` — بابُ رمز QR في نافذة الاشتراك على الحاسوب** (الجولة ٢ من مطابقة الويب للتطبيق، أحمد ١٨ نوفمبر «ج»).
 *
 * الرمزُ ثابتٌ مطبوعٌ في صورة (`public/qr-get-plus.svg`)، والجهازُ الذي يمسحه هو الذي يقرّر: آيفون إلى App Store،
 * وأندرويد إلى صفحة الانضمام للتجربة في Google Play (أو صفحة المتجر يومَ يُفتح للعموم — `ANDROID_PUBLIC`)، وغيرُهما
 * إلى صفحة الاشتراك نفسِها. **تحويلٌ عاديٌّ لا رابطُ `intent://`**: Chrome يرفض فتحَ التطبيق من تحويلٍ بلا لمسة، فيبقى
 * فتحُ شاشة الاشتراك داخل التطبيق لزرّ الصفحة على الجوّال (لمسةٌ حقيقيّة).
 * وهو مفتوحٌ بلا حساب (`proxy.ts` › `guestOpen`/`welcomeExempt`): الجوّالُ الذي يمسح الرمزَ قد لا يكون داخلاً في الموقع.
 */
export function GET(request: NextRequest) {
  const device = deviceOf(request.headers.get("user-agent") ?? "");
  const to = device === "ios" ? IOS_HREF : device === "android" ? ANDROID_HREF : new URL("/plus", request.url).toString();
  return NextResponse.redirect(to, 302);
}
