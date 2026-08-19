import { redirect } from "next/navigation";
import { getUser } from "@/lib/data";
import { getT } from "@/lib/locale";
import { SettingsPageLayout } from "@/components/settings/SettingsPageLayout";
import { SettingsGroup } from "@/components/settings/SettingsGroup";
import { SettingsRow } from "@/components/settings/SettingsRow";

/**
 * عن Loopz — **أبوابٌ موجودةٌ فعلاً ونسبةُ المصدرين** (D-462).
 *
 * ⚠️ **والنسبةُ إلى TMDB وJustWatch انتقلت إلى هنا من «المظهر»**:
 * كانت تحت «بلد المشاهدة» **لأن البيانات تأتي من هناك**، **وبلدُ
 * المشاهدة انتقل إلى «تفضيلات المحتوى»** — **ونصُّ الترخيص لا يتبع
 * مبدّلاً بل يتبع صفحةَ التعريف**، وهي الموضعُ الظاهرُ الذي تشترطه
 * شروطُ TMDB.
 */
export default async function Page() {
  const user = await getUser();
  if (!user) redirect("/login");
  const { t } = await getT();

  return (
    <SettingsPageLayout title={t.setAbout}>
      <SettingsGroup>
        <SettingsRow href="/features" icon="sparkle-star" title={t.setAboutFeatures} />
        <SettingsRow href="/terms" icon="book" title={t.setAboutTerms} />
        <SettingsRow href="/privacy" icon="shield" title={t.setAboutPrivacy} />
      </SettingsGroup>

      <section>
        <h2 className="px-1 mb-2 text-12 font-semibold uppercase tracking-wide text-muted">
          {t.setAboutSources}
        </h2>
        <div className="rounded-2xl border border-border bg-surface p-4 text-12 text-muted/80 leading-relaxed space-y-1.5">
          <p>{t.tmdbAttribution}</p>
          <p>{t.justwatchAttribution}</p>
        </div>
      </section>
    </SettingsPageLayout>
  );
}
