import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/data";
import { LandingHero } from "@/components/LandingHero";

/**
 * صفحة الدخول — شاشةٌ واحدة لا تُمرَّر، كما هي منذ v3.
 *
 * بطلها انتقل إلى `LandingHero` لأن الجذر صار يستعمله أيضاً (D-122)،
 * والشكل لم يتغيّر: نفس الصيغة `screen` المثبّتة.
 *
 * وصارت غير قابلة للفهرسة عن قصد: هي والجذر يعرضان الشاشة نفسها، وترك
 * الاثنتين مفتوحتين يوزّع سلطة الفهرسة على رابطين ويجعل «Loopz» يظهر في
 * النتائج بعنوان `/login` — وهو أسوأ رابطٍ يمكن أن يُعرض على من يبحث عن
 * المنتج. `canonical` يشير إلى الجذر فتُجمع كل الإشارات هناك.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: true },
  alternates: { canonical: "/" },
};

export default async function LoginPage() {
  const user = await getUser();
  if (user) redirect("/");

  return <LandingHero variant="screen" />;
}
