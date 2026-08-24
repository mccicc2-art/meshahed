import { redirect } from "next/navigation";
import { getUser } from "@/lib/data";
import { getT } from "@/lib/locale";
import { SettingsPageLayout } from "@/components/settings/SettingsPageLayout";
import { SettingsGroup } from "@/components/settings/SettingsGroup";
import { SettingsRow } from "@/components/settings/SettingsRow";
import { SettingsSection } from "@/components/settings/SettingsSection";

/**
 * عن Loopz — **أبوابٌ موجودةٌ فعلاً ونسبةُ المصدرين** (D-462).
 *
 * ⚠️ **والنسبةُ إلى TMDB وJustWatch انتقلت إلى هنا من «المظهر»**:
 * كانت تحت «بلد المشاهدة» **لأن البيانات تأتي من هناك**، **وبلدُ
 * المشاهدة انتقل إلى «تفضيلات المحتوى»** — **ونصُّ الترخيص لا يتبع
 * مبدّلاً بل يتبع صفحةَ التعريف**، وهي الموضعُ الظاهرُ الذي تشترطه
 * شروطُ TMDB.
 *
 * 🆕 **والاسمُ ورقمُ البناء في الرأس** (D-555، مواصفةُ أحمد): **صفحةُ
 * «عن» بلا رقمِ بناءٍ لا تُجيب السؤالَ الوحيدَ الذي تُفتح لأجله حين
 * يُبلَّغ عن عطل** — «أيُّ نسخةٍ عندك؟». **والرقمُ هو `VERCEL_GIT_COMMIT_SHA`
 * نفسُه الذي يردّه `/api/build` ويستعمله `SwRegister`** — **مصدرٌ واحدٌ
 * لا ثالث** (القاعدة ٦).
 */
export default async function Page() {
  const user = await getUser();
  if (!user) redirect("/login");
  const { t } = await getT();

  /* سبعةُ أحرفٍ كما يكتبها Git — **والأربعون حرفاً لا تُقرأ ولا تُملى** */
  const build = (process.env.VERCEL_GIT_COMMIT_SHA ?? "dev").slice(0, 7);

  return (
    <SettingsPageLayout title={t.setAbout}>
      {/* الرأس: الاسمُ ورقمُ البناء — **بلا بطاقةٍ ولا حدّ**، فليس فيه
          ما يُضغط */}
      <div className="text-center pt-2 pb-1">
        {/* ⚖️ **الاستثناءُ الوحيد فوق ١٥** (D-560): وردماركٌ لا نصّ —
            **ونُزل من ٢٤ إلى ٢٠** ليهدأ مع السلّم دون أن يفقد هويّته */}
        <p className="text-20 font-black tracking-tight">Loopz</p>
        <p className="mt-1 text-12 text-muted" dir="ltr">
          {t.setAboutBuild} {build}
        </p>
      </div>

      <SettingsGroup>
        <SettingsRow href="/features" icon="sparkle-star" title={t.setAboutFeatures} />
        <SettingsRow href="/terms" icon="book" title={t.setAboutTerms} />
        <SettingsRow href="/privacy" icon="shield" title={t.setAboutPrivacy} />
      </SettingsGroup>

      <SettingsSection label={t.setAboutSources}>
        <div className="rounded-2xl border border-border bg-surface p-4 text-12 text-muted/80 leading-relaxed space-y-1.5">
          <p>{t.tmdbAttribution}</p>
          <p>{t.justwatchAttribution}</p>
        </div>
      </SettingsSection>
    </SettingsPageLayout>
  );
}
