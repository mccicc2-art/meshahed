import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/data";
import { LandingHero } from "@/components/LandingHero";
import { safeNext } from "@/lib/safeNext";

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

/**
 * 🆕 D-1373 — `?next=`: الحارسُ (`proxy.ts`) يحوّل الزائرَ إلى هنا من الصفحة التي طلبها، فيعود إليها بعد الدخول —
 * ومن دخل أصلاً يذهب إليها مباشرةً. القيمةُ تُفحص (`safeNext`): داخليّةٌ فقط.
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const raw = (await searchParams).next;
  const next = safeNext(Array.isArray(raw) ? raw[0] : raw);
  const user = await getUser();
  if (user) redirect(next);

  return <LandingHero variant="screen" next={next} />;
}
