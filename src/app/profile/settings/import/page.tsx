import { redirect } from "next/navigation";
import { getUser } from "@/lib/data";
import { getT } from "@/lib/locale";
import { traktConfigured } from "@/lib/trakt";
import { SettingsPageLayout } from "@/components/settings/SettingsPageLayout";
import { ImportPanel } from "@/components/ImportPanel";
import { PrivacyData } from "@/components/PrivacyData";
import { Icon } from "@/components/Icon";
import { webWords } from "@/components/webWords";

/**
 * الاستيرادُ والتصدير — **بياناتُك داخلةً وخارجة** (D-462).
 *
 * **والتصديرُ انتقل إلى هنا من «الخصوصية»**: كان بجوار حذفِ الحساب
 * **لأن كليهما «بياناتُك»** — **والسؤالُ الذي يجمعه بالاستيراد أقربُ**:
 * كيف تدخل مكتبتُك وكيف تخرج.
 */
export default async function Page() {
  const user = await getUser();
  if (!user) redirect("/login");
  const { locale, t } = await getT();

  return (
    <SettingsPageLayout title={t.setImport}>
      <ImportPanel locale={locale} traktReady={traktConfigured()} />
      {/* 🆕 R273 — على الحاسوب: «تصدير بياناتك» وجملةُ «يُقرأ في جهازك» جنباً إلى جنب تحت البطاقات — وتحت ١٢٨٠ كما كان */}
      <div className="desk:grid desk:grid-cols-2 desk:items-start desk:gap-4">
        <PrivacyData locale={locale} only={["export"]} />
        <p className="hidden desk:flex items-center gap-3 rounded-2xl border border-dashed border-border p-4 text-12 leading-relaxed text-muted">
          <Icon name="info" size={20} className="shrink-0 text-accent" />
          {webWords(locale).importLocalNote}
        </p>
      </div>
    </SettingsPageLayout>
  );
}
