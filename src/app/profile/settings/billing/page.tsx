import { redirect } from "next/navigation";
import { getUser, getProfile } from "@/lib/data";
import { isPlus, planNameOf } from "@/lib/plan";
import { getT } from "@/lib/locale";
import { SettingsPageLayout } from "@/components/settings/SettingsPageLayout";
import { SettingsGroup } from "@/components/settings/SettingsGroup";
import { SettingsRow } from "@/components/settings/SettingsRow";

/**
 * الاشتراكُ والفوترة — **منقولٌ كما هو من تبويب `billing`** (D-462).
 *
 * ⚠️ **ولا شيءَ اختُرع هنا**: **لا جدولَ اشتراكاتٍ في القاعدة**، فبقي
 * اللوحُ يقول ذلك — **وصفحةُ المميزات بابُه الوحيد** لأن السؤال الذي
 * يجلب المستخدمَ إلى هذا القسم هو «ما المجّانيُّ وما المدفوع؟».
 */
export default async function Page() {
  const user = await getUser();
  if (!user) redirect("/login");
  const { t } = await getT();
  const profile = await getProfile();
  const plus = isPlus(profile);

  return (
    <SettingsPageLayout title={t.setBilling}>
      <SettingsGroup>
        {/* 🆕 **الصفُّ يقول خطّتَه لا خطّةً واحدةً للجميع** (D-633):
            كان مسمَّراً على «Loopz مجّاني» — **وسطرٌ ثابتٌ يكذب على
            المشترك** (D-217). والمؤسِّسُ يُنادى بصفته: **الأندرُ أصدقُ
            بصاحبه.**
            🆕 **والتعبيرُ غادر هذا السطرَ إلى `planNameOf`** (D-780):
            **صفحتان أخريان كانتا تسمّران «مجّاني» على البابِ نفسِه** —
            **وإصلاحُ الغرفةِ وحدَها يترك المقبضَ يكذب.** */}
        <SettingsRow
          icon="card"
          title={planNameOf(profile, t)}
          value={t.setPlanActive}
        />
        <SettingsRow
          href="/features"
          icon="sparkle-star"
          title={t.setViewPlans}
          /* **والثمنُ يُقال لمن لا يملكها، ويصمت لمن يملكها** — عرضُ
             السعر على مشتركٍ إعلانٌ لما اشتراه. */
          subtitle={plus ? t.plusIncludes : t.plusPrice}
        />
      </SettingsGroup>
    </SettingsPageLayout>
  );
}
