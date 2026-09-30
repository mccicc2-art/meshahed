import { redirect } from "next/navigation";
import { getUser } from "@/lib/data";
import { getMyActivityItems } from "@/lib/activityCore";
import { getT } from "@/lib/locale";
import { ActivityScreen } from "@/components/ActivityScreen";

/**
 * **النشاط — سجلُّك أنت** (D-537، تصميمُ أحمد).
 *
 * ⚖️ **وهي بديلةُ `‎/diary` بقرارِه**: تلك عرضت المشاهدةَ وحدَها،
 * **وهذه تعرض الأربعةَ** — مشاهدةً وتقييماً ورأياً وإضافةً إلى قائمة —
 * **والمسارُ القديم يُحوَّل إلى هنا** فلا رابطٌ يكسر.
 *
 * 🆕 D-1213 — **بناءُ الصفوف في `lib/activityCore.ts`** (الجلبُ الثلاثيّ والتسميةُ بلا TMDB كما كانا هنا حرفاً)،
 * لأنّ التطبيقَ يرسم الشاشةَ نفسَها أصليّةً من `GET /api/v1/me/activity`.
 *
 * **والتشكيلُ هنا والقسمةُ في العميل**: حدُّ اليوم يتبع ساعةَ القارئ
 * (انظر رأس `ActivityScreen`).
 */
export default async function ActivityPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();
  const items = await getMyActivityItems(locale);

  return (
    <div>
      <h1 className="sr-only">{t.activityTitle}</h1>
      <ActivityScreen items={items} locale={locale} />
    </div>
  );
}
