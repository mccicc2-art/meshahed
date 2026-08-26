import { Suspense } from "react";
import type { Metadata } from "next";
import { getProfileByUsername, displayNameOf } from "@/lib/data";
import { getT } from "@/lib/locale";
import { LibraryAnalysisSkeleton } from "@/components/LibraryAnalysis";
import { MemberAnalysis } from "@/components/MemberAnalysis";
import { SettingsHeader } from "@/components/settings/SettingsHeader";

/**
 * 🆕 **إحصائياتُ عضو** (D-649، طلبُ أحمد: «كل الحسابات خلي الكارد
 * الأساسي فيها مسلسلات أفلام احصائيات»).
 *
 * 🔴 **ولماذا سطحٌ ثانٍ و`/stats` قائمة**: تلك تقرأ **صاحبَ الجلسة** —
 * **فتوجيهُ زائرٍ إليها يريه أرقامَ نفسِه في ملفِّ غيره** (D-217).
 * **والوجهُ واحدٌ** (`AnalysisView`)، **والمختلفُ القارئُ وحدَه** (D-145).
 *
 * ⚠️ **والحارسُ في القاعدة لا هنا**: كلُّ دوالِّ القراءة محروسةٌ
 * بـ`can_view_profile` (الهجرات ١٤٢/١٤٥) — **فحسابٌ خاصٌّ لا تخرج منه
 * صفوفٌ أصلاً**، وهذه الصفحةُ ترسم «لا شيء بعد» لا قفلاً كاذباً.
 *
 * ⚠️ **والترويسةُ ترويسةُ `/stats` نفسُها** (`SettingsHeader`): رجوعٌ ·
 * اسمٌ في المنتصف — **وشريطُ التطبيق مخفيٌّ تحت `/u/` أصلاً** (D-643)،
 * **وترويستان في شاشةٍ واحدة سهما رجوعٍ وعنوانان** (D-462).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const { t } = await getT();
  const profile = await getProfileByUsername(decodeURIComponent(username));
  if (!profile) return { title: t.userNotFound };
  const name = displayNameOf(profile, t.anonymousUser);
  return { title: `${t.statsPageTitle} — ${name}`, robots: { index: false } };
}

export default async function MemberStatsPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { locale, t } = await getT();
  const { username } = await params;

  const profile = await getProfileByUsername(decodeURIComponent(username));
  if (!profile) {
    return <p className="text-center text-muted py-24">{t.userNotFound}</p>;
  }

  const name = displayNameOf(profile, t.anonymousUser);

  return (
    <div>
      {/* 🆕 D-682: العنوانُ اسمُ الصفحة لا اسمُ العضو — الاسمُ صار في
          البطاقة السينمائيّة نفسِها، **وتكرارُه في الترويسة يقول شيئاً
          مرّتين ويترك الصفحةَ بلا اسم** (مواصفةُ أحمد: العنوان Statistics) */}
      <SettingsHeader title={t.statsPageTitle} fallbackHref={`/u/${username}`} />

      <h1 className="sr-only">{`${t.statsPageTitle} — ${name}`}</h1>

      {/* المفتاحُ معرّفُ العضو: انتقالٌ من ملفٍّ إلى ملفٍّ يبدّل الهيكلَ
          العظميّ أيضاً فلا تبقى أرقامُ الأوّل معروضةً بينما تُجلب الثانية */}
      <Suspense key={profile.id} fallback={<LibraryAnalysisSkeleton />}>
        <MemberAnalysis userId={profile.id} locale={locale} />
      </Suspense>
    </div>
  );
}
